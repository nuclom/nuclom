import { Cause, Effect, Exit } from 'effect';
import { type NextRequest, NextResponse } from 'next/server';
import { Auth, createFullLayer, handleEffectExit, mapErrorToApiResponse } from '@/lib/api-handler';
import { CachePresets, getCacheControlHeader } from '@/lib/api-utils';
import { MissingFieldError, SeriesRepository } from '@/lib/effect';

// =============================================================================
// GET /api/series/[id]/progress - Get user's progress for a series
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: seriesId } = await params;
  const FullLayer = createFullLayer();

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Get progress
    const seriesRepo = yield* SeriesRepository;
    return yield* seriesRepo.getSeriesProgress(user.id, seriesId);
  });

  const runnable = Effect.provide(effect, FullLayer);
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === 'Some') {
        return mapErrorToApiResponse(error.value);
      }
      return mapErrorToApiResponse(new Error('Internal server error'));
    },
    onSuccess: (data) =>
      NextResponse.json(data, {
        headers: {
          // Progress changes frequently, use very short cache
          'Cache-Control': getCacheControlHeader(CachePresets.progress()),
        },
      }),
  });
}

// =============================================================================
// POST /api/series/[id]/progress - Update user's progress
// =============================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: seriesId } = await params;
  const FullLayer = createFullLayer();

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Parse request body
    const body = yield* Effect.tryPromise({
      try: () => request.json(),
      catch: () =>
        new MissingFieldError({
          field: 'body',
          message: 'Invalid request body',
        }),
    });

    const { lastVideoId, lastPosition, completed } = body;

    const seriesRepo = yield* SeriesRepository;

    // If marking a video as completed
    if (completed && lastVideoId) {
      return yield* seriesRepo.markVideoCompleted(user.id, seriesId, lastVideoId);
    }

    // Otherwise update progress
    if (!lastVideoId) {
      return yield* Effect.fail(new MissingFieldError({ field: 'lastVideoId', message: 'Last video ID is required' }));
    }

    return yield* seriesRepo.updateSeriesProgress(user.id, seriesId, lastVideoId, lastPosition ?? 0);
  });

  const runnable = Effect.provide(effect, FullLayer);
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
