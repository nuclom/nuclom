import {
  createFullLayer,
  createPublicLayer,
  handleEffectExit,
  handleEffectExitWithStatus,
} from '@nuclom/lib/api-handler';
import type { MomentType } from '@nuclom/lib/db/schema';
import { ClipRepository, VideoRepository } from '@nuclom/lib/effect';
import { Auth } from '@nuclom/lib/effect/services/auth';
import { validateQueryParams, validateRequestBody } from '@nuclom/lib/validation';
import { CreateClipSchema, PaginationSchema } from '@nuclom/lib/validation/schemas';
import { Effect } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// GET /api/videos/[id]/clips - List all clips for a video
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const { id: videoId } = yield* Effect.promise(() => params);

    // Validate pagination params
    const queryParams = yield* validateQueryParams(PaginationSchema, request.url);

    // Get clips
    const clipRepo = yield* ClipRepository;
    const result = yield* clipRepo.getClips(videoId, queryParams.page, queryParams.limit);

    return {
      success: true,
      data: result.data,
      pagination: result.pagination,
    };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}

// =============================================================================
// POST /api/videos/[id]/clips - Create a new clip from a video
// =============================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate user
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const { id: videoId } = yield* Effect.promise(() => params);

    // Verify video exists and get organization
    const videoRepo = yield* VideoRepository;
    const video = yield* videoRepo.getVideo(videoId);

    // Validate request body
    const validatedData = yield* validateRequestBody(CreateClipSchema, request);

    // Create clip
    const clipRepo = yield* ClipRepository;
    const newClip = yield* clipRepo.createClip({
      videoId,
      organizationId: video.organizationId,
      title: validatedData.title,
      description: validatedData.description ?? undefined,
      startTime: validatedData.startTime,
      endTime: validatedData.endTime,
      momentId: validatedData.momentId ?? undefined,
      momentType: validatedData.momentType as MomentType | undefined,
      transcriptExcerpt: validatedData.transcriptExcerpt ?? undefined,
      createdBy: user.id,
    });

    return { success: true, data: newClip };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExitWithStatus(exit, 201);
}
