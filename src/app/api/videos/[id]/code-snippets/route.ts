import { asc, eq } from "drizzle-orm";
import { Effect } from "effect";
import type { NextRequest } from "next/server";
import { createPublicLayer, handleEffectExit } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { videoCodeSnippets, videos } from "@/lib/db/schema";
import { DatabaseError, NotFoundError } from "@/lib/effect";
import type { ApiResponse } from "@/lib/types";

// =============================================================================
// GET /api/videos/[id]/code-snippets - Get video code snippets
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const videoId = resolvedParams.id;

    // Check if video exists
    const video = yield* Effect.tryPromise({
      try: () =>
        db.query.videos.findFirst({
          where: eq(videos.id, videoId),
          columns: { id: true },
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

    // Get code snippets
    const codeSnippets = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(videoCodeSnippets)
          .where(eq(videoCodeSnippets.videoId, videoId))
          .orderBy(asc(videoCodeSnippets.timestamp)),
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch code snippets",
          operation: "getCodeSnippets",
          cause: error,
        }),
    });

    const response: ApiResponse = {
      success: true,
      data: {
        videoId,
        codeSnippets,
        count: codeSnippets.length,
      },
    };
    return response;
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
