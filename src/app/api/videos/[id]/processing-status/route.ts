import { type NextRequest, NextResponse } from "next/server";
import { Effect, Exit, Cause } from "effect";
import { AppLive, VideoRepository, NotFoundError, ValidationError } from "@/lib/effect";
import type { ApiResponse } from "@/lib/types";

// =============================================================================
// Types
// =============================================================================

interface ProcessingStatusUpdate {
  status: string;
  progress: number;
  error?: string;
}

// =============================================================================
// GET /api/videos/[id]/processing-status - Get video processing status
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const effect = Effect.gen(function* () {
    const videoRepo = yield* VideoRepository;
    const video = yield* videoRepo.getVideo(id);

    return {
      videoId: video.id,
      processingStatus: video.processingStatus,
      processingProgress: video.processingProgress,
      processingError: video.processingError,
      thumbnailUrl: video.thumbnailUrl,
      duration: video.duration,
      width: video.width,
      height: video.height,
      codec: video.codec,
      fps: video.fps,
      bitrate: video.bitrate,
      processedAt: video.processedAt,
    };
  });

  const runnable = Effect.provide(effect, AppLive);
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === "Some") {
        const err = error.value;
        if (err instanceof NotFoundError) {
          return NextResponse.json({ success: false, error: "Video not found" }, { status: 404 });
        }
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
      }
      return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    },
    onSuccess: (data) => {
      return NextResponse.json({ success: true, data }, { status: 200 });
    },
  });
}

// =============================================================================
// PATCH /api/videos/[id]/processing-status - Update video processing status
// =============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const effect = Effect.gen(function* () {
    // Parse request body
    const body = yield* Effect.tryPromise({
      try: () => request.json() as Promise<ProcessingStatusUpdate>,
      catch: () => new ValidationError({ message: "Invalid request body" }),
    });

    // Validate status
    const validStatuses = [
      "pending",
      "uploading",
      "processing",
      "extracting_metadata",
      "generating_thumbnails",
      "transcribing",
      "analyzing",
      "completed",
      "failed",
    ];

    if (!validStatuses.includes(body.status)) {
      return yield* Effect.fail(
        new ValidationError({ message: `Invalid status. Must be one of: ${validStatuses.join(", ")}` }),
      );
    }

    // Update video processing status
    const videoRepo = yield* VideoRepository;
    const updatedVideo = yield* videoRepo.updateVideo(id, {
      processingStatus: body.status as
        | "pending"
        | "uploading"
        | "processing"
        | "extracting_metadata"
        | "generating_thumbnails"
        | "transcribing"
        | "analyzing"
        | "completed"
        | "failed",
      processingProgress: body.progress,
      processingError: body.error || null,
    });

    return {
      videoId: updatedVideo.id,
      processingStatus: updatedVideo.processingStatus,
      processingProgress: updatedVideo.processingProgress,
    };
  });

  const runnable = Effect.provide(effect, AppLive);
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === "Some") {
        const err = error.value;
        if (err instanceof NotFoundError) {
          return NextResponse.json({ success: false, error: "Video not found" }, { status: 404 });
        }
        if (err instanceof ValidationError) {
          return NextResponse.json({ success: false, error: err.message }, { status: 400 });
        }
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
      }
      return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    },
    onSuccess: (data) => {
      return NextResponse.json({ success: true, data }, { status: 200 });
    },
  });
}
