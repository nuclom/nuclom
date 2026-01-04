import { Effect } from "effect";
import type { NextRequest } from "next/server";
import { connection } from "next/server";
import { createFullLayer, handleEffectExit } from "@/lib/api-handler";
import { getVideo, MissingFieldError } from "@/lib/effect";
import { Auth } from "@/lib/effect/services/auth";
import { SemanticSearchRepository } from "@/lib/effect/services/semantic-search-repository";

// =============================================================================
// GET /api/videos/[videoId]/similar - Find similar videos
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

    // Parse query params
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "5", 10), 20);
    const threshold = parseFloat(searchParams.get("threshold") || "0.7");

    // Get video to verify it exists and get organizationId
    const video = yield* getVideo(videoId);

    // Find similar videos
    const searchRepo = yield* SemanticSearchRepository;
    const similarVideos = yield* searchRepo.findSimilarVideos({
      videoId,
      organizationId: video.organizationId,
      limit,
      threshold,
    });

    return {
      videoId,
      similarVideos,
      total: similarVideos.length,
      threshold,
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}
