import { createFullLayer, handleEffectExit, handleEffectExitWithStatus } from '@nuclom/lib/api-handler';
import { db } from '@nuclom/lib/db';
import { videos } from '@nuclom/lib/db/schema';
import { DatabaseError, NotFoundError, ValidationError } from '@nuclom/lib/effect';
import { Auth } from '@nuclom/lib/effect/services/auth';
import { Presence } from '@nuclom/lib/effect/services/presence';
import { validateOptional } from '@nuclom/lib/validation';
import { eq } from 'drizzle-orm';
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

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
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
    const video = yield* Effect.tryPromise({
      try: () =>
        db.query.videos.findFirst({
          where: eq(videos.id, videoId),
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

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExitWithStatus(exit, 201);
}
