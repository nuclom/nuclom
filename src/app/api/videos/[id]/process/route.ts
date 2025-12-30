import { eq } from "drizzle-orm";
import { Cause, Effect, Exit, Layer } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { videos } from "@/lib/db/schema";
import { AppLive, DatabaseError, NotFoundError } from "@/lib/effect";
import { Auth, makeAuthLayer } from "@/lib/effect/services/auth";
import { TranscriptionLive } from "@/lib/effect/services/transcription";
import {
  VideoAIProcessingError,
  VideoAIProcessor,
  VideoAIProcessorLive,
} from "@/lib/effect/services/video-ai-processor";
import type { ApiResponse } from "@/lib/types";

// =============================================================================
// Error Response Handler
// =============================================================================

const mapErrorToResponse = (error: unknown): NextResponse => {
  if (error && typeof error === "object" && "_tag" in error) {
    const taggedError = error as { _tag: string; message: string };

    switch (taggedError._tag) {
      case "NotFoundError":
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 404 });
      case "UnauthorizedError":
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 401 });
      case "VideoAIProcessingError":
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 500 });
      case "TranscriptionError":
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 500 });
      default:
        console.error(`[${taggedError._tag}]`, taggedError);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
  }
  console.error("[Error]", error);
  return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
};

// Build the layer with all required dependencies
const VideoAIProcessorWithDeps = VideoAIProcessorLive.pipe(Layer.provide(Layer.mergeAll(AppLive, TranscriptionLive)));

const ProcessingLayer = Layer.mergeAll(AppLive, TranscriptionLive, VideoAIProcessorWithDeps);

// =============================================================================
// POST /api/videos/[id]/process - Trigger AI processing
// =============================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const AuthLayer = makeAuthLayer(auth);
  const FullLayer = Layer.merge(ProcessingLayer, AuthLayer);

  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const videoId = resolvedParams.id;

    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Get video details
    const video = yield* Effect.tryPromise({
      try: () =>
        db.query.videos.findFirst({
          where: eq(videos.id, videoId),
        }),
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch video",
          operation: "getVideo",
          cause: error,
        }),
    });

    if (!video) {
      return yield* Effect.fail(
        new NotFoundError({
          message: "Video not found",
          entity: "Video",
          id: videoId,
        }),
      );
    }

    // Check if video has a URL
    if (!video.videoUrl) {
      return yield* Effect.fail(
        new VideoAIProcessingError({
          message: "Video URL not available for processing",
          videoId,
        }),
      );
    }

    // Check if already processing
    if (video.processingStatus === "transcribing" || video.processingStatus === "analyzing") {
      return {
        message: "Video is already being processed",
        status: video.processingStatus,
      };
    }

    // Get the processor and start processing
    const processor = yield* VideoAIProcessor;

    // Check if we already have a transcript
    if (video.transcript && video.transcriptSegments) {
      // Process from existing transcript
      const result = yield* processor.processFromTranscript(
        videoId,
        video.transcript,
        video.transcriptSegments,
        video.title,
      );

      return {
        message: "AI analysis completed",
        status: "completed",
        summary: result.summary,
        tags: result.tags,
        actionItems: result.actionItems,
        chapters: result.chapters.length,
        codeSnippets: result.codeSnippets.length,
      };
    }

    // Full processing with transcription
    const result = yield* processor.processVideo(videoId, video.videoUrl, video.title);

    return {
      message: "Video processing completed",
      status: "completed",
      summary: result.summary,
      tags: result.tags,
      actionItems: result.actionItems,
      chapters: result.chapters.length,
      codeSnippets: result.codeSnippets.length,
    };
  });

  const runnable = Effect.provide(effect, FullLayer);
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === "Some") {
        return mapErrorToResponse(error.value);
      }
      return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    },
    onSuccess: (data) => {
      const response: ApiResponse = {
        success: true,
        data,
      };
      return NextResponse.json(response);
    },
  });
}

// =============================================================================
// GET /api/videos/[id]/process - Get processing status
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const videoId = resolvedParams.id;

    // Get video processing status
    const video = yield* Effect.tryPromise({
      try: () =>
        db.query.videos.findFirst({
          where: eq(videos.id, videoId),
          columns: {
            id: true,
            processingStatus: true,
            processingError: true,
            transcript: true,
            aiSummary: true,
            aiTags: true,
            aiActionItems: true,
          },
        }),
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch video",
          operation: "getVideo",
          cause: error,
        }),
    });

    if (!video) {
      return yield* Effect.fail(
        new NotFoundError({
          message: "Video not found",
          entity: "Video",
          id: videoId,
        }),
      );
    }

    return {
      videoId: video.id,
      status: video.processingStatus,
      error: video.processingError,
      hasTranscript: !!video.transcript,
      hasSummary: !!video.aiSummary,
      tags: video.aiTags || [],
      actionItems: video.aiActionItems || [],
    };
  });

  const runnable = Effect.provide(effect, AppLive);
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === "Some") {
        return mapErrorToResponse(error.value);
      }
      return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    },
    onSuccess: (data) => {
      const response: ApiResponse = {
        success: true,
        data,
      };
      return NextResponse.json(response);
    },
  });
}
