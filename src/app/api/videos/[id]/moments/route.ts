import { eq } from "drizzle-orm";
import { Effect } from "effect";
import type { NextRequest } from "next/server";
import { createPublicLayer, handleEffectExit } from "@/lib/api-handler";
import { videos } from "@/lib/db/schema";
import { ClipRepository, NotFoundError } from "@/lib/effect";
import { DatabaseError } from "@/lib/effect/errors";
import { Database } from "@/lib/effect/services/database";

// =============================================================================
// GET /api/videos/[id]/moments - Get auto-detected moments for a video
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const { id: videoId } = yield* Effect.promise(() => params);
    const { db } = yield* Database;

    // Check if video exists
    const video = yield* Effect.tryPromise({
      try: () =>
        db.query.videos.findFirst({
          where: eq(videos.id, videoId),
          columns: { id: true, organizationId: true },
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

    // Parse query params for filtering
    const url = new URL(request.url);
    const minConfidence = url.searchParams.get("minConfidence");
    const confidence = minConfidence ? Number.parseInt(minConfidence, 10) : 50; // Default 50% confidence threshold

    // Get moments
    const clipRepo = yield* ClipRepository;
    const moments = yield* clipRepo.getMoments(videoId, confidence);

    return {
      success: true,
      data: {
        videoId,
        moments,
        count: moments.length,
      },
    };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}
