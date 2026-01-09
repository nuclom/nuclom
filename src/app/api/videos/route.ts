import { type Context, Effect } from 'effect';
import type { NextRequest } from 'next/server';
import { handleEffectExitWithOptions, handleEffectExitWithStatus, runApiEffect } from '@/lib/api-handler';
import { CachePresets, getCacheControlHeader } from '@/lib/api-utils';
import { Storage, VideoRepository } from '@/lib/effect';
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
 * Generate presigned thumbnail URL from stored URL/key
 */
function generatePresignedThumbnailUrl(
  storage: Context.Tag.Service<typeof Storage>,
  thumbnailUrl: string | null,
): Effect.Effect<string | null, never, never> {
  if (!thumbnailUrl) return Effect.succeed(null);

  return Effect.gen(function* () {
    // Extract key from full URL if needed, otherwise use as-is
    const thumbnailKey = thumbnailUrl.includes('.r2.cloudflarestorage.com/')
      ? storage.extractKeyFromUrl(thumbnailUrl)
      : thumbnailUrl;

    if (!thumbnailKey) return null;

    return yield* storage.generatePresignedDownloadUrl(thumbnailKey, 3600);
  }).pipe(Effect.catchAll(() => Effect.succeed(null)));
}

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

    // Validate query params with Zod schema
    const { organizationId, page, limit } = yield* validateQueryParams(GetVideosSchema, request.url);

    // Fetch videos using repository
    const videoRepo = yield* VideoRepository;
    const videosData = yield* videoRepo.getVideos(organizationId, page, limit);

    // Generate presigned thumbnail URLs for all videos
    const storage = yield* Storage;
    const videosWithPresignedUrls = yield* Effect.all(
      videosData.data.map((video) =>
        Effect.gen(function* () {
          const presignedThumbnailUrl = yield* generatePresignedThumbnailUrl(storage, video.thumbnailUrl);
          return {
            ...video,
            thumbnailUrl: presignedThumbnailUrl,
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

    // Validate request body with Zod schema
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
      channelId: validatedData.channelId ?? undefined,
      collectionId: validatedData.collectionId ?? undefined,
      transcript: validatedData.transcript ?? undefined,
      aiSummary: validatedData.aiSummary ?? undefined,
    });
  });

  const exit = await runApiEffect(effect);
  return handleEffectExitWithStatus(exit, 201);
}
