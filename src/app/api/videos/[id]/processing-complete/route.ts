import { type NextRequest, NextResponse } from "next/server";
import { Effect, Exit, Cause } from "effect";
import { AppLive, VideoRepository, NotFoundError, ValidationError } from "@/lib/effect";
import type { ApiResponse } from "@/lib/types";

// =============================================================================
// Types
// =============================================================================

interface ProcessingCompleteData {
  duration: string;
  width?: number;
  height?: number;
  codec?: string;
  fps?: number;
  bitrate?: number;
  thumbnailUrl?: string;
  thumbnailAlternates?: string[];
  transcript?: string;
  aiSummary?: string;
  processingStatus: string;
  processingProgress: number;
  processedAt?: Date;
  processingError?: string;
}

// =============================================================================
// POST /api/videos/[id]/processing-complete - Complete video processing
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const effect = Effect.gen(function* () {
    // Parse request body
    const body = yield* Effect.tryPromise({
      try: () => request.json() as Promise<ProcessingCompleteData>,
      catch: () => new ValidationError({ message: "Invalid request body" }),
    });

    // Validate required fields
    if (!body.processingStatus) {
      return yield* Effect.fail(new ValidationError({ message: "processingStatus is required" }));
    }

    // Update video with all processing results
    const videoRepo = yield* VideoRepository;
    const updatedVideo = yield* videoRepo.updateVideo(id, {
      duration: body.duration,
      width: body.width || null,
      height: body.height || null,
      codec: body.codec || null,
      fps: body.fps || null,
      bitrate: body.bitrate || null,
      thumbnailUrl: body.thumbnailUrl || null,
      thumbnailAlternates: body.thumbnailAlternates ? JSON.stringify(body.thumbnailAlternates) : null,
      transcript: body.transcript || null,
      aiSummary: body.aiSummary || null,
      processingStatus: body.processingStatus as
        | "pending"
        | "uploading"
        | "processing"
        | "extracting_metadata"
        | "generating_thumbnails"
        | "transcribing"
        | "analyzing"
        | "completed"
        | "failed",
      processingProgress: body.processingProgress,
      processingError: body.processingError || null,
      processedAt: body.processedAt ? new Date(body.processedAt) : new Date(),
    });

    return {
      videoId: updatedVideo.id,
      processingStatus: updatedVideo.processingStatus,
      thumbnailUrl: updatedVideo.thumbnailUrl,
      duration: updatedVideo.duration,
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
        console.error("[ProcessingComplete Error]", err);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
      }
      return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    },
    onSuccess: (data) => {
      return NextResponse.json({ success: true, data }, { status: 200 });
    },
  });
}
