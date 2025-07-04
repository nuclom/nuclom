import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getVideos, createVideo } from "@/lib/api/videos";

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    if (!workspaceId) {
      return NextResponse.json(
        { error: "Workspace ID is required" },
        { status: 400 },
      );
    }

    const result = await getVideos(workspaceId, page, limit);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching videos:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      description,
      duration,
      thumbnailUrl,
      videoUrl,
      workspaceId,
      channelId,
      collectionId,
      transcript,
      aiSummary,
    } = body;

    if (!title || !duration || !workspaceId) {
      return NextResponse.json(
        { error: "Title, duration, and workspace ID are required" },
        { status: 400 },
      );
    }

    const video = await createVideo({
      title,
      description,
      duration,
      thumbnailUrl,
      videoUrl,
      authorId: session.user.id,
      workspaceId,
      channelId,
      collectionId,
      transcript,
      aiSummary,
    });

    return NextResponse.json(video);
  } catch (error) {
    console.error("Error creating video:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
