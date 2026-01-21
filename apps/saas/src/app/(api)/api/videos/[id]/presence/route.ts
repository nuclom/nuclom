import { handleEffectExit, handleEffectExitWithStatus, runApiEffect } from '@nuclom/lib/api-handler';
import { ValidationError, VideoRepository } from '@nuclom/lib/effect';
import { Auth } from '@nuclom/lib/effect/services/auth';
import { Presence } from '@nuclom/lib/effect/services/presence';
import { validateOptional } from '@nuclom/lib/validation';
import { Effect, Option, Schema } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// GET /api/videos/[id]/presence - Get all users currently watching a video
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const videoId = resolvedParams.id;

    // Get video presence
    const presenceService = yield* Presence;
    const viewers = yield* presenceService.getVideoPresence(videoId);

    return {
      success: true,
      data: viewers,
    };
  });

  const exit = await runApiEffect(effect);
  return handleEffectExit(exit);
}

// =============================================================================
// POST /api/videos/[id]/presence - Update current user's presence (heartbeat)
// =============================================================================

const UpdatePresenceBodySchema = Schema.Struct({
  currentTime: Schema.optional(Schema.Number),
  status: Schema.optional(Schema.Literal('online', 'away', 'busy')),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const videoId = resolvedParams.id;

    // Authenticate user
    const authService = yield* Auth;
    const sessionOption = yield* authService.getSessionOption(request.headers);

    // Allow anonymous users to be tracked (for view counts)
    const userId = Option.isSome(sessionOption) ? sessionOption.value.user.id : null;

    // If no user, skip presence update (require authentication for presence)
    if (!userId) {
      return yield* Effect.fail(
        new ValidationError({
          message: 'Authentication required for presence tracking',
        }),
      );
    }

    // Get video to ensure it exists and get organizationId
    const videoRepo = yield* VideoRepository;
    const video = yield* videoRepo.getVideo(videoId);

    // Parse request body (optional)
    const bodyOption = yield* Effect.tryPromise({
      try: async () => {
        try {
          return await request.json();
        } catch {
          return null;
        }
      },
      catch: () => null,
    });

    const body = yield* validateOptional(UpdatePresenceBodySchema, bodyOption);

    // Update presence
    const presenceService = yield* Presence;
    yield* presenceService.updatePresence(userId, video.organizationId, {
      videoId,
      status: body?.status || 'online',
      currentTime: body?.currentTime,
    });

    return {
      success: true,
      data: { updated: true },
    };
  });

  const exit = await runApiEffect(effect);
  return handleEffectExitWithStatus(exit, 201);
}
