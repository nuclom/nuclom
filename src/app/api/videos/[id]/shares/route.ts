/**
 * Video Shares API - Direct sharing with users and teams
 *
 * This endpoint handles sharing private videos with specific users or teams.
 * Different from /share which creates public share links.
 *
 * GET /api/videos/[id]/shares - List all shares for a video
 * POST /api/videos/[id]/shares - Create a share with a user or team
 */

import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';
import { Auth, createFullLayer, handleEffectExit, handleEffectExitWithStatus } from '@/lib/api-handler';
import { ForbiddenError, ValidationError } from '@/lib/effect';
import { VideoRepository } from '@/lib/effect/services/video-repository';
import { VideoSharesRepository } from '@/lib/effect/services/video-shares-repository';
import type { ApiResponse } from '@/lib/types';
import { validateRequestBody } from '@/lib/validation';

// =============================================================================
// GET /api/videos/[id]/shares - List shares for a video
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate user
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const { id } = yield* Effect.promise(() => params);

    // Check if user can access the video (must be author to see shares)
    const videoRepo = yield* VideoRepository;
    const accessCheck = yield* videoRepo.canAccessVideo(id, user.id);

    if (!accessCheck.canAccess || accessCheck.accessLevel !== 'download') {
      // Only author (with download access) can see shares
      return yield* Effect.fail(
        new ForbiddenError({
          message: 'Only the video author can view shares',
        }),
      );
    }

    // Get all shares for the video
    const sharesRepo = yield* VideoSharesRepository;
    const shares = yield* sharesRepo.getVideoShares(id);

    const response: ApiResponse = {
      success: true,
      data: shares,
    };
    return response;
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}

// =============================================================================
// POST /api/videos/[id]/shares - Create a share
// =============================================================================

const CreateShareBodySchema = Schema.Struct({
  // Either userId or teamId must be provided, but not both
  userId: Schema.optional(Schema.String),
  teamId: Schema.optional(Schema.String),
  accessLevel: Schema.optional(Schema.Literal('view', 'comment', 'download')),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate user
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const { id } = yield* Effect.promise(() => params);

    // Parse request body
    const body = yield* validateRequestBody(CreateShareBodySchema, request);

    // Validate that either userId or teamId is provided, but not both
    if (!body.userId && !body.teamId) {
      return yield* Effect.fail(
        new ValidationError({
          message: 'Either userId or teamId must be provided',
          field: 'userId',
        }),
      );
    }

    if (body.userId && body.teamId) {
      return yield* Effect.fail(
        new ValidationError({
          message: 'Cannot share with both user and team at the same time',
          field: 'userId',
        }),
      );
    }

    const sharesRepo = yield* VideoSharesRepository;

    // Create the share based on type
    const share = body.userId
      ? yield* sharesRepo.shareWithUser({
          videoId: id,
          userId: body.userId,
          accessLevel: body.accessLevel ?? 'view',
          sharedBy: user.id,
        })
      : yield* sharesRepo.shareWithTeam({
          videoId: id,
          teamId: body.teamId as string,
          accessLevel: body.accessLevel ?? 'view',
          sharedBy: user.id,
        });

    const response: ApiResponse = {
      success: true,
      data: share,
    };
    return response;
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExitWithStatus(exit, 201);
}

// =============================================================================
// DELETE /api/videos/[id]/shares - Remove a share by ID (query param: shareId)
// =============================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate user
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const { id } = yield* Effect.promise(() => params);
    const { searchParams } = new URL(request.url);
    const shareId = searchParams.get('shareId');

    if (!shareId) {
      return yield* Effect.fail(
        new ValidationError({
          message: 'shareId query parameter is required',
          field: 'shareId',
        }),
      );
    }

    // Check if user can access the video (must be author to remove shares)
    const videoRepo = yield* VideoRepository;
    const accessCheck = yield* videoRepo.canAccessVideo(id, user.id);

    if (!accessCheck.canAccess || accessCheck.accessLevel !== 'download') {
      return yield* Effect.fail(
        new ForbiddenError({
          message: 'Only the video author can remove shares',
        }),
      );
    }

    // Remove the share
    const sharesRepo = yield* VideoSharesRepository;
    yield* sharesRepo.removeShare(shareId);

    const response: ApiResponse = {
      success: true,
      data: { deleted: true },
    };
    return response;
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
