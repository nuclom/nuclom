import { and, count, desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { videos } from "@/lib/db/schema";
import type { ApiResponse, CreateVideoData } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    const channelId = searchParams.get("channelId");
    const collectionId = searchParams.get("collectionId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    const conditions = [];
    if (workspaceId) conditions.push(eq(videos.workspaceId, workspaceId));
    if (channelId) conditions.push(eq(videos.channelId, channelId));
    if (collectionId) conditions.push(eq(videos.collectionId, collectionId));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [videosData, totalResult] = await Promise.all([
      db.query.videos.findMany({
        where: whereClause,
        with: {
          author: true,
          workspace: true,
          channel: true,
          collection: true,
        },
        orderBy: desc(videos.createdAt),
        offset,
        limit,
      }),
      db.select({ count: count() }).from(videos).where(whereClause),
    ]);

    const total = totalResult[0]?.count || 0;

    const response: ApiResponse = {
      success: true,
      data: {
        videos: videosData,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching videos:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch videos" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateVideoData & { authorId: string; workspaceId: string } =
      await request.json();

    const [insertedVideo] = await db
      .insert(videos)
      .values({
        title: body.title,
        description: body.description,
        duration: body.duration,
        thumbnailUrl: body.thumbnailUrl,
        videoUrl: body.videoUrl,
        authorId: body.authorId,
        workspaceId: body.workspaceId,
        channelId: body.channelId,
        collectionId: body.collectionId,
      })
      .returning();

    const videoData = await db.query.videos.findFirst({
      where: eq(videos.id, insertedVideo.id),
      with: {
        author: true,
        workspace: true,
        channel: true,
        collection: true,
      },
    });

    const response: ApiResponse = {
      success: true,
      data: videoData,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Error creating video:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create video" },
      { status: 500 },
    );
  }
}
