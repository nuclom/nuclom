import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ApiResponse, CreateVideoData } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    const channelId = searchParams.get("channelId");
    const seriesId = searchParams.get("seriesId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: any = {};
    if (workspaceId) where.workspaceId = workspaceId;
    if (channelId) where.channelId = channelId;
    if (seriesId) where.seriesId = seriesId;

    const [videos, total] = await Promise.all([
      prisma.video.findMany({
        where,
        include: {
          author: true,
          workspace: true,
          channel: true,
          series: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.video.count({ where }),
    ]);

    const response: ApiResponse = {
      success: true,
      data: {
        videos,
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

    const video = await prisma.video.create({
      data: {
        title: body.title,
        description: body.description,
        duration: body.duration,
        thumbnailUrl: body.thumbnailUrl,
        videoUrl: body.videoUrl,
        authorId: body.authorId,
        workspaceId: body.workspaceId,
        channelId: body.channelId,
        seriesId: body.seriesId,
      },
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

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Error creating video:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create video" },
      { status: 500 },
    );
  }
}
