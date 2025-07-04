import { type NextRequest, NextResponse } from "next/server";
import { VideoProcessor } from "@/lib/video-processor";
import { db } from "@/lib/db";
import { videos } from "@/lib/db/schema";
import type { ApiResponse } from "@/lib/types";

// Handle file upload size limit
export const maxDuration = 300; // 5 minutes
export const dynamic = "force-dynamic";

interface UploadResponse {
  videoId: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration: string;
}

export async function POST(request: NextRequest) {
  try {
    // Check content type
    const contentType = request.headers.get("content-type");
    if (!contentType?.includes("multipart/form-data")) {
      return NextResponse.json(
        {
          success: false,
          error: "Content-Type must be multipart/form-data",
        },
        { status: 400 },
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("video") as File;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const workspaceId = formData.get("workspaceId") as string;
    const authorId = formData.get("authorId") as string;
    const channelId = formData.get("channelId") as string;
    const seriesId = formData.get("seriesId") as string;

    // Validate required fields
    if (!file || !title || !workspaceId || !authorId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: video, title, workspaceId, authorId",
        },
        { status: 400 },
      );
    }

    // Validate file type
    if (!VideoProcessor.isSupportedVideoFormat(file.name)) {
      return NextResponse.json(
        {
          success: false,
          error: "Unsupported video format. Supported formats: MP4, MOV, AVI, MKV, WebM, FLV, WMV",
        },
        { status: 400 },
      );
    }

    // Validate file size
    if (file.size > VideoProcessor.getMaxFileSize()) {
      return NextResponse.json(
        {
          success: false,
          error: `File size exceeds maximum limit of ${VideoProcessor.getMaxFileSize() / (1024 * 1024)}MB`,
        },
        { status: 400 },
      );
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Process video (upload, generate thumbnail, etc.)
    const processingResult = await VideoProcessor.processVideo(
      buffer,
      file.name,
      workspaceId,
      // Progress callback could be used with WebSockets in the future
    );

    // Save video metadata to database
    const [insertedVideo] = await db
      .insert(videos)
      .values({
        title,
        description,
        duration: processingResult.duration,
        thumbnailUrl: processingResult.thumbnailUrl,
        videoUrl: processingResult.videoUrl,
        authorId,
        workspaceId,
        channelId: channelId || null,
        seriesId: seriesId || null,
      })
      .returning();

    const response: ApiResponse<UploadResponse> = {
      success: true,
      data: {
        videoId: insertedVideo.id,
        videoUrl: processingResult.videoUrl,
        thumbnailUrl: processingResult.thumbnailUrl,
        duration: processingResult.duration,
      },
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Error uploading video:", error);
    
    // Return appropriate error message
    let errorMessage = "Failed to upload video";
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}