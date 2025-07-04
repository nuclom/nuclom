import { db } from "@/lib/db";
import { comments, videos } from "@/lib/db/schema";
import type { ApiResponse } from "@/lib/types";
import type { NewVideo } from "@/lib/db/schema";
import { asc, eq, isNull } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const videoData = await db.query.videos.findFirst({
      where: eq(videos.id, resolvedParams.id),
      with: {
        author: true,
        organization: true,
        channel: true,
        collection: true,
        comments: {
          with: {
            author: true,
            replies: {
              with: {
                author: true,
              },
            },
          },
          where: isNull(comments.parentId),
          orderBy: asc(comments.createdAt),
        },
      },
    });

    if (!videoData) {
      return NextResponse.json({ success: false, error: "Video not found" }, { status: 404 });
    }

    const response: ApiResponse = {
      success: true,
      data: videoData,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching video:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch video" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const body: Partial<NewVideo> = await request.json();

    await db.update(videos).set(body).where(eq(videos.id, resolvedParams.id));

    const videoData = await db.query.videos.findFirst({
      where: eq(videos.id, resolvedParams.id),
      with: {
        author: true,
        organization: true,
        channel: true,
        collection: true,
      },
    });

    const response: ApiResponse = {
      success: true,
      data: videoData,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error updating video:", error);
    return NextResponse.json({ success: false, error: "Failed to update video" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    await db.delete(videos).where(eq(videos.id, resolvedParams.id));

    const response: ApiResponse = {
      success: true,
      data: { message: "Video deleted successfully" },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error deleting video:", error);
    return NextResponse.json({ success: false, error: "Failed to delete video" }, { status: 500 });
  }
}
