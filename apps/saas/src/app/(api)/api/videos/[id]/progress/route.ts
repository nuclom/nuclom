import { handleEffectExit, handleEffectExitWithOptions, runApiEffect } from '@nuclom/lib/api-handler';
import { CachePresets, getCacheControlHeader } from '@nuclom/lib/api-utils';
import { ValidationError, VideoProgressRepository } from '@nuclom/lib/effect';
import { Auth } from '@nuclom/lib/effect/services/auth';
import { validateRequestBody } from '@nuclom/lib/validation';
import { Effect, Option, Schema } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// GET /api/videos/[id]/progress - Get video progress for current user
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const videoId = resolvedParams.id;

    // Try to get session (optional - return null progress if not authenticated)
    const authService = yield* Auth;
    const sessionOption = yield* authService.getSessionOption(request.headers);

    // If not authenticated, return null progress
    if (Option.isNone(sessionOption)) {
      return null;
    }

    const { user } = sessionOption.value;

    // Get progress using repository
    const progressRepo = yield* VideoProgressRepository;
    return yield* progressRepo.getProgress(videoId, user.id);
  });

  const exit = await runApiEffect(effect);
  return handleEffectExitWithOptions(exit, {
    successHeaders: {
      // Progress changes frequently, use very short cache
      'Cache-Control': getCacheControlHeader(CachePresets.progress()),
    },
  });
}

// =============================================================================
// PATCH /api/videos/[id]/progress - Update video progress for current user
// =============================================================================

const UpdateProgressBodySchema = Schema.Struct({
  currentTime: Schema.Number,
  completed: Schema.optional(Schema.Boolean),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const videoId = resolvedParams.id;

    // Authenticate - required for saving progress
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Parse request body
    const body = yield* validateRequestBody(UpdateProgressBodySchema, request);

    // Validate currentTime
    if (typeof body.currentTime !== 'number' || body.currentTime < 0) {
      return yield* Effect.fail(
        new ValidationError({
          message: 'currentTime must be a non-negative number',
        }),
      );
    }

    // Save progress using repository
    const progressRepo = yield* VideoProgressRepository;
    const progress = yield* progressRepo.saveProgress({
      videoId,
      userId: user.id,
      currentTime: body.currentTime,
      completed: body.completed ?? false,
    });

    return {
      success: true,
      data: progress,
    };
  });

  const exit = await runApiEffect(effect);
  return handleEffectExit(exit);
}

// =============================================================================
// DELETE /api/videos/[id]/progress - Delete video progress for current user
// =============================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const videoId = resolvedParams.id;

    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Delete progress using repository
    const progressRepo = yield* VideoProgressRepository;
    yield* progressRepo.deleteProgress(videoId, user.id);

    return { message: 'Progress deleted successfully' };
  });

  const exit = await runApiEffect(effect);
  return handleEffectExit(exit);
}
