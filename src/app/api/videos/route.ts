import { Effect } from 'effect';
import type { NextRequest } from 'next/server';
import {
  generatePresignedThumbnailUrl,
  generatePresignedVideoUrl,
  handleEffectExitWithOptions,
  handleEffectExitWithStatus,
  runApiEffect,
  Storage,
} from '@/lib/api-handler';
import { CachePresets, getCacheControlHeader } from '@/lib/api-utils';
import { VideoRepository } from '@/lib/effect';
import { Auth } from '@/lib/effect/services/auth';
import {
  CreateVideoSchema,
  GetVideosSchema,
  sanitizeDescription,
  sanitizeTitle,
  validateQueryParams,
  validateRequestBody,
} from '@/lib/validation';

/**
 * @summary List videos
 * @description Get a paginated list of videos for an organization
 * @response 200 PaginatedVideos - List of videos with pagination
 * @response 400 - Invalid request parameters
 * @response 401 - Unauthorized
 */
export async function GET(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Validate query params with Effect Schema
    const { organizationId, page, limit } = yield* validateQueryParams(GetVideosSchema, request.url);

    // Fetch videos using repository
    const videoRepo = yield* VideoRepository;
    const videosData = yield* videoRepo.getVideos(organizationId, page, limit);

    // Generate presigned URLs for thumbnails and videos
    const storage = yield* Storage;
    const videosWithPresignedUrls = yield* Effect.all(
      videosData.data.map((video) =>
        Effect.gen(function* () {
          const [presignedThumbnailUrl, presignedVideoUrl] = yield* Effect.all([
            generatePresignedThumbnailUrl(storage, video.thumbnailUrl),
            generatePresignedVideoUrl(storage, video.videoUrl),
          ]);
          return {
            ...video,
            thumbnailUrl: presignedThumbnailUrl,
            videoUrl: presignedVideoUrl,
          };
        }),
      ),
      { concurrency: 10 },
    );

    return {
      data: videosWithPresignedUrls,
      pagination: videosData.pagination,
    };
  });

  const exit = await runApiEffect(effect);
  return handleEffectExitWithOptions(exit, {
    successHeaders: {
      'Cache-Control': getCacheControlHeader(CachePresets.shortWithSwr()),
    },
  });
}

/**
 * @summary Create video
 * @description Create a new video entry with metadata
 * @response 201 Video - Video created successfully
 * @response 400 - Invalid request body
 * @response 401 - Unauthorized
 */
export async function POST(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Validate request body with Effect Schema
    const validatedData = yield* validateRequestBody(CreateVideoSchema, request);

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
      transcript: validatedData.transcript ?? undefined,
      aiSummary: validatedData.aiSummary ?? undefined,
    });
  });

  const exit = await runApiEffect(effect);
  return handleEffectExitWithStatus(exit, 201);
}
