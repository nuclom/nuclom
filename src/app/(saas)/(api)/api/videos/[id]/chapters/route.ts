import { asc, eq } from 'drizzle-orm';
import { Effect } from 'effect';
import type { NextRequest } from 'next/server';
import { createPublicLayer, handleEffectExit } from '@/lib/api-handler';
import { db } from '@/lib/db';
import { videoChapters, videos } from '@/lib/db/schema';
import { DatabaseError, NotFoundError } from '@/lib/effect';

// =============================================================================
// GET /api/videos/[id]/chapters - Get video chapters
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
          message: 'Failed to fetch video',
          operation: 'getVideo',
          cause: error,
        }),
    });

    if (!video) {
      return yield* Effect.fail(
        new NotFoundError({
          message: 'Video not found',
          entity: 'Video',
          id: videoId,
        }),
      );
    }

    // Get chapters
    const chapters = yield* Effect.tryPromise({
      try: () =>
        db.select().from(videoChapters).where(eq(videoChapters.videoId, videoId)).orderBy(asc(videoChapters.startTime)),
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch chapters',
          operation: 'getChapters',
          cause: error,
        }),
    });

    return {
      success: true,
      data: {
        videoId,
        chapters,
        count: chapters.length,
      },
    };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}
