import { asc, eq, isNull } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  channels,
  comments,
  series,
  users,
  videos,
  workspaces,
} from "@/lib/db/schema";
import type { ApiResponse, UpdateVideoData } from "@/lib/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const resolvedParams = await params;
    const video = await db.query.videos.findFirst({
      where: eq(videos.id, resolvedParams.id),
      with: {
        author: true,
        workspace: true,
        channel: true,
        series: true,
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

    if (!video) {
      return NextResponse.json(
        { success: false, error: "Video not found" },
        { status: 404 },
      );
    }

    const response: ApiResponse = {
      success: true,
      data: video,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching video:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch video" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const resolvedParams = await params;
    const body: UpdateVideoData = await request.json();

    await db.update(videos).set(body).where(eq(videos.id, resolvedParams.id));

    const video = await db.query.videos.findFirst({
      where: eq(videos.id, resolvedParams.id),
      with: {
        author: true,
        workspace: true,
        channel: true,
        series: true,
      },
    });

    const response: ApiResponse = {
      success: true,
      data: video,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error updating video:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update video" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
    return NextResponse.json(
      { success: false, error: "Failed to delete video" },
      { status: 500 },
    );
  }
}
