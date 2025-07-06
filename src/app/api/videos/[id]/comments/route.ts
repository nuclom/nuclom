import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { comments, users } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";

const createCommentSchema = z.object({
  content: z.string().min(1).max(1000),
  timestamp: z.string().optional(), // Video timestamp for the comment
  parentId: z.string().optional(), // For threaded comments
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: videoId } = await params;

    // Get session
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get comments for the video with author information
    const videoComments = await db
      .select({
        id: comments.id,
        content: comments.content,
        timestamp: comments.timestamp,
        parentId: comments.parentId,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
        author: {
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
        },
      })
      .from(comments)
      .innerJoin(users, eq(comments.authorId, users.id))
      .where(eq(comments.videoId, videoId))
      .orderBy(desc(comments.createdAt));

    // Organize comments into threads
    const commentMap = new Map();
    const rootComments: any[] = [];

    // First pass: create comment objects and map them
    videoComments.forEach((comment) => {
      const commentWithReplies = {
        ...comment,
        replies: [],
      };
      commentMap.set(comment.id, commentWithReplies);

      if (!comment.parentId) {
        rootComments.push(commentWithReplies);
      }
    });

    // Second pass: organize replies under parent comments
    videoComments.forEach((comment) => {
      if (comment.parentId) {
        const parent = commentMap.get(comment.parentId);
        if (parent) {
          parent.replies.push(commentMap.get(comment.id));
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: rootComments,
    });
  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: videoId } = await params;

    // Get session
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const validatedData = createCommentSchema.parse(body);

    // Create comment
    const [newComment] = await db
      .insert(comments)
      .values({
        content: validatedData.content,
        timestamp: validatedData.timestamp || null,
        authorId: session.user.id,
        videoId,
        parentId: validatedData.parentId || null,
      })
      .returning();

    // Get the comment with author information
    const commentWithAuthor = await db
      .select({
        id: comments.id,
        content: comments.content,
        timestamp: comments.timestamp,
        parentId: comments.parentId,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
        author: {
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
        },
      })
      .from(comments)
      .innerJoin(users, eq(comments.authorId, users.id))
      .where(eq(comments.id, newComment.id))
      .limit(1);

    return NextResponse.json(
      {
        success: true,
        data: commentWithAuthor[0],
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating comment:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid comment data", details: error.errors }, { status: 400 });
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
