import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';
import {
  createFullLayer,
  generatePresignedThumbnailUrl,
  generatePresignedVideoUrl,
  handleEffectExit,
  handleEffectExitWithOptions,
  Storage,
} from '@/lib/api-handler';
import { CachePresets, getCacheControlHeader } from '@/lib/api-utils';
import { Auth } from '@/lib/effect/services/auth';
import { CollectionRepository } from '@/lib/effect/services/collection-repository';
import { validateRequestBody } from '@/lib/validation';

const UpdateCollectionSchema = Schema.Struct({
  name: Schema.optional(Schema.String.pipe(Schema.minLength(1))),
  description: Schema.optional(Schema.NullOr(Schema.String)),
  thumbnailUrl: Schema.optional(Schema.NullOr(Schema.String)),
  type: Schema.optional(Schema.Literal('folder', 'playlist')),
  isPublic: Schema.optional(Schema.Boolean),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * @summary Get collection details
 * @description Get a collection with all its videos
 * @response 200 CollectionWithVideos - Collection with videos
 * @response 401 - Unauthorized
 * @response 404 - Collection not found
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const { id } = params;

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Fetch collection with videos using repository
    const collectionRepo = yield* CollectionRepository;
    const collection = yield* collectionRepo.getCollectionWithVideos(id);

    // Generate presigned URLs for collection and videos
    const storage = yield* Storage;

    const presignedThumbnailUrl = yield* generatePresignedThumbnailUrl(storage, collection.thumbnailUrl);

    const videosWithPresignedUrls = yield* Effect.all(
      collection.videos.map((cv) =>
        Effect.gen(function* () {
          const [presignedVideoThumbnail, presignedVideoUrl] = yield* Effect.all([
            generatePresignedThumbnailUrl(storage, cv.video.thumbnailUrl),
            generatePresignedVideoUrl(storage, cv.video.videoUrl),
          ]);
          return {
            ...cv,
            video: {
              ...cv.video,
              thumbnailUrl: presignedVideoThumbnail,
              videoUrl: presignedVideoUrl,
            },
          };
        }),
      ),
      { concurrency: 10 },
    );

    return {
      ...collection,
      thumbnailUrl: presignedThumbnailUrl,
      videos: videosWithPresignedUrls,
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExitWithOptions(exit, {
    successHeaders: { 'Cache-Control': getCacheControlHeader(CachePresets.shortWithSwr()) },
  });
}

/**
 * @summary Update collection
 * @description Update collection metadata
 * @response 200 Collection - Updated collection
 * @response 400 - Invalid request body
 * @response 401 - Unauthorized
 * @response 404 - Collection not found
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const { id } = params;

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Parse and validate request body
    const data = yield* validateRequestBody(UpdateCollectionSchema, request);

    // Update collection using repository
    const collectionRepo = yield* CollectionRepository;
    return yield* collectionRepo.updateCollection(id, data);
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}

/**
 * @summary Delete collection
 * @description Delete a collection (videos are not deleted, only the grouping)
 * @response 200 - Collection deleted successfully
 * @response 401 - Unauthorized
 * @response 404 - Collection not found
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const { id } = params;

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Delete collection using repository
    const collectionRepo = yield* CollectionRepository;
    yield* collectionRepo.deleteCollection(id);

    return { deleted: true };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}
