import { Effect } from "effect";
import type { NextRequest } from "next/server";
import { connection } from "next/server";
import { createFullLayer, handleEffectExit, handleEffectExitWithStatus } from "@/lib/api-handler";
import { getVideo, MissingFieldError, ValidationError } from "@/lib/effect";
import { Auth } from "@/lib/effect/services/auth";
import { Embedding } from "@/lib/effect/services/embedding";
import { SemanticSearchRepository } from "@/lib/effect/services/semantic-search-repository";

// =============================================================================
// GET /api/videos/[videoId]/embeddings - Get embedding status for a video
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ videoId: string }> }) {
  await connection();

  const { videoId } = await params;

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    if (!videoId) {
      return yield* Effect.fail(
        new MissingFieldError({
          field: "videoId",
          message: "Video ID is required",
        }),
      );
    }

    // Check if video has embeddings
    const searchRepo = yield* SemanticSearchRepository;
    const hasEmbeddings = yield* searchRepo.hasEmbeddings(videoId);
    const chunks = yield* searchRepo.getTranscriptChunks(videoId);

    return {
      videoId,
      hasEmbeddings,
      chunkCount: chunks.length,
      chunks: chunks.map((c) => ({
        id: c.id,
        chunkIndex: c.chunkIndex,
        tokenCount: c.tokenCount,
        timestampStart: c.timestampStart,
        timestampEnd: c.timestampEnd,
        textPreview: c.text.substring(0, 200) + (c.text.length > 200 ? "..." : ""),
      })),
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}

// =============================================================================
// POST /api/videos/[videoId]/embeddings - Generate embeddings for a video
// =============================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ videoId: string }> }) {
  await connection();

  const { videoId } = await params;

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    if (!videoId) {
      return yield* Effect.fail(
        new MissingFieldError({
          field: "videoId",
          message: "Video ID is required",
        }),
      );
    }

    // Get the video
    const video = yield* getVideo(videoId);

    // Verify video has a transcript
    if (!video.transcript) {
      return yield* Effect.fail(
        new ValidationError({
          message: "Video does not have a transcript. Please wait for processing to complete.",
          field: "transcript",
        }),
      );
    }

    // Generate embeddings
    const embeddingService = yield* Embedding;
    const chunkEmbeddings = yield* embeddingService.processTranscript(
      video.transcript,
      video.transcriptSegments || undefined,
    );

    // Save to database
    const searchRepo = yield* SemanticSearchRepository;
    const savedChunks = yield* searchRepo.saveTranscriptChunks(videoId, video.organizationId, chunkEmbeddings);

    return {
      videoId,
      success: true,
      chunksCreated: savedChunks.length,
      message: `Generated embeddings for ${savedChunks.length} transcript chunks`,
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExitWithStatus(exit, 201);
}

// =============================================================================
// DELETE /api/videos/[videoId]/embeddings - Delete embeddings for a video
// =============================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ videoId: string }> }) {
  await connection();

  const { videoId } = await params;

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    if (!videoId) {
      return yield* Effect.fail(
        new MissingFieldError({
          field: "videoId",
          message: "Video ID is required",
        }),
      );
    }

    // Verify video exists
    yield* getVideo(videoId);

    // Delete embeddings
    const searchRepo = yield* SemanticSearchRepository;
    yield* searchRepo.deleteTranscriptChunks(videoId);

    return {
      videoId,
      success: true,
      message: "Embeddings deleted successfully",
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}
