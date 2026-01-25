import {
  handleEffectExit,
  handleEffectExitWithStatus,
  runApiEffect,
  runPublicApiEffect,
} from '@nuclom/lib/api-handler';
import { videos, videoViews } from '@nuclom/lib/db/schema';
import { DatabaseError, NotFoundError, ValidationError } from '@nuclom/lib/effect/errors';
import { Auth } from '@nuclom/lib/effect/services/auth';
import { Database } from '@nuclom/lib/effect/services/database';
import { validateRequestBody } from '@nuclom/lib/validation';
import { and, eq } from 'drizzle-orm';
import { Effect, Option, Schema } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// POST /api/videos/[id]/views - Track view start
// =============================================================================

const TrackViewBodySchema = Schema.Struct({
  sessionId: Schema.String,
  source: Schema.optional(Schema.Literal('direct', 'share_link', 'embed')),
});
type TrackViewBody = Schema.Schema.Type<typeof TrackViewBodySchema>;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const { db } = yield* Database;
    const resolvedParams = yield* Effect.promise(() => params);
    const videoId = resolvedParams.id;

    // Parse request body
    const body = yield* validateRequestBody(TrackViewBodySchema, request);

    // Validate sessionId
    if (!body.sessionId || typeof body.sessionId !== 'string') {
      return yield* Effect.fail(
        new ValidationError({
          message: 'sessionId is required',
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

    // Try to get user session (optional - anonymous views are allowed)
    const authService = yield* Auth;
    const sessionOption = yield* authService.getSessionOption(request.headers);
    const userId = Option.isSome(sessionOption) ? sessionOption.value.user.id : null;

    // Check if view already exists for this session+video
    const existingView = yield* Effect.tryPromise({
      try: () =>
        db.query.videoViews.findFirst({
          where: and(eq(videoViews.videoId, videoId), eq(videoViews.sessionId, body.sessionId)),
        }),
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to check existing view',
          operation: 'checkView',
          cause: error,
        }),
    });

    // If view already exists, return success without creating a new one
    if (existingView) {
      return { success: true, viewId: existingView.id, isNewView: false };
    }

    // Determine source from referrer if not provided
    const referrer = request.headers.get('referer') || null;
    const source: TrackViewBody['source'] = body.source ?? (referrer?.includes('share') ? 'share_link' : 'direct');

    // Create new view
    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .insert(videoViews)
          .values({
            videoId,
            sessionId: body.sessionId,
            userId,
            organizationId: video.organizationId,
            source,
            referrer,
            userAgent: request.headers.get('user-agent'),
          })
          .returning(),
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to track view',
          operation: 'createView',
          cause: error,
        }),
    });

    return { success: true, viewId: result[0].id, isNewView: true };
  });

  const exit = await runApiEffect(effect);
  return handleEffectExitWithStatus(exit, 201);
}

// =============================================================================
// PATCH /api/videos/[id]/views - Update watch progress
// =============================================================================

const UpdateViewBodySchema = Schema.Struct({
  sessionId: Schema.String,
  watchDuration: Schema.Number,
  completionPercent: Schema.Number,
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const { db } = yield* Database;
    const resolvedParams = yield* Effect.promise(() => params);
    const videoId = resolvedParams.id;

    // Parse request body
    const body = yield* validateRequestBody(UpdateViewBodySchema, request);

    // Validate fields
    if (!body.sessionId || typeof body.sessionId !== 'string') {
      return yield* Effect.fail(
        new ValidationError({
          message: 'sessionId is required',
        }),
      );
    }

    if (typeof body.watchDuration !== 'number' || body.watchDuration < 0) {
      return yield* Effect.fail(
        new ValidationError({
          message: 'watchDuration must be a non-negative number',
        }),
      );
    }

    if (typeof body.completionPercent !== 'number' || body.completionPercent < 0 || body.completionPercent > 100) {
      return yield* Effect.fail(
        new ValidationError({
          message: 'completionPercent must be between 0 and 100',
        }),
      );
    }

    // Update the view record
    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .update(videoViews)
          .set({
            watchDuration: Math.floor(body.watchDuration),
            completionPercent: Math.floor(body.completionPercent),
            updatedAt: new Date(),
          })
          .where(and(eq(videoViews.videoId, videoId), eq(videoViews.sessionId, body.sessionId)))
          .returning(),
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to update view',
          operation: 'updateView',
          cause: error,
        }),
    });

    if (result.length === 0) {
      return yield* Effect.fail(
        new NotFoundError({
          message: 'View not found for this session',
          entity: 'VideoView',
          id: `${videoId}:${body.sessionId}`,
        }),
      );
    }

    return { updated: true };
  });

  const exit = await runPublicApiEffect(effect);
  return handleEffectExit(exit);
}

// =============================================================================
// GET /api/videos/[id]/views - Get view count for a video
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const { db } = yield* Database;
    const resolvedParams = yield* Effect.promise(() => params);
    const videoId = resolvedParams.id;

    // Get view count and stats
    const views = yield* Effect.tryPromise({
      try: () =>
        db.query.videoViews.findMany({
          where: eq(videoViews.videoId, videoId),
        }),
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch views',
          operation: 'getViews',
          cause: error,
        }),
    });

    const viewCount = views.length;
    const uniqueViewers = new Set(views.filter((v) => v.userId).map((v) => v.userId)).size;
    const totalWatchTime = views.reduce((sum, v) => sum + (v.watchDuration || 0), 0);
    const avgCompletionPercent =
      viewCount > 0 ? Math.round(views.reduce((sum, v) => sum + (v.completionPercent || 0), 0) / viewCount) : 0;

    return {
      viewCount,
      uniqueViewers,
      totalWatchTime,
      avgCompletionPercent,
    };
  });

  const exit = await runPublicApiEffect(effect);
  return handleEffectExit(exit);
}
