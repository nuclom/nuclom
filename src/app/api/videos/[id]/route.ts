import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ApiResponse, UpdateVideoData } from "@/lib/types";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const video = await prisma.video.findUnique({
      where: { id: params.id },
      include: {
        author: true,
        workspace: true,
        channel: true,
        series: true,
        comments: {
          include: {
            author: true,
            replies: {
              include: {
                author: true,
              },
            },
          },
          where: {
            parentId: null, // Only top-level comments
          },
          orderBy: { createdAt: "asc" },
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
  { params }: { params: { id: string } },
) {
  try {
    const body: UpdateVideoData = await request.json();

    const video = await prisma.video.update({
      where: { id: params.id },
      data: body,
      include: {
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
  { params }: { params: { id: string } },
) {
  try {
    await prisma.video.delete({
      where: { id: params.id },
    });

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
