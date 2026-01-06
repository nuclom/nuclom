import { Cause, Effect, Exit } from 'effect';
import { type NextRequest, NextResponse } from 'next/server';
import { mapErrorToApiResponse } from '@/lib/api-errors';
import { createFullLayer, handleEffectExitWithStatus } from '@/lib/api-handler';
import { CachePresets, getCacheControlHeader } from '@/lib/api-utils';
import { VideoRepository } from '@/lib/effect';
import { Auth } from '@/lib/effect/services/auth';
import {
  createVideoSchema,
  getVideosSchema,
  sanitizeDescription,
  sanitizeTitle,
  validateQueryParams,
  validateRequestBody,
} from '@/lib/validation';

// =============================================================================
// GET /api/videos - Fetch paginated videos for an organization
// =============================================================================

export async function GET(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Validate query params with Zod schema
    const { organizationId, page, limit } = yield* validateQueryParams(getVideosSchema, request.url);

    // Fetch videos using repository
    const videoRepo = yield* VideoRepository;
    return yield* videoRepo.getVideos(organizationId, page, limit);
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  // Custom handling for cache headers
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
          'Cache-Control': getCacheControlHeader(CachePresets.shortWithSwr()),
        },
      }),
  });
}

// =============================================================================
// POST /api/videos - Create a new video
// =============================================================================

export async function POST(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Validate request body with Zod schema
    const validatedData = yield* validateRequestBody(createVideoSchema, request);

    // Sanitize user-provided content to prevent XSS
    const sanitizedTitle = sanitizeTitle(validatedData.title);
    const sanitizedDescription = validatedData.description ? sanitizeDescription(validatedData.description) : undefined;

    // Create video using repository
    const videoRepo = yield* VideoRepository;
    return yield* videoRepo.createVideo({
      title: sanitizedTitle,
      description: sanitizedDescription,
      duration: validatedData.duration,
      thumbnailUrl: validatedData.thumbnailUrl ?? undefined,
      videoUrl: validatedData.videoUrl ?? undefined,
      authorId: user.id,
      organizationId: validatedData.organizationId,
      channelId: validatedData.channelId ?? undefined,
      collectionId: validatedData.collectionId ?? undefined,
      transcript: validatedData.transcript ?? undefined,
      aiSummary: validatedData.aiSummary ?? undefined,
    });
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExitWithStatus(exit, 201);
}
