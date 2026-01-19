import {
  createFullLayer,
  generatePresignedThumbnailUrl,
  handleEffectExit,
  handleEffectExitWithStatus,
  Storage,
} from '@nuclom/lib/api-handler';
import { MissingFieldError } from '@nuclom/lib/effect';
import { Auth } from '@nuclom/lib/effect/services/auth';
import { CollectionRepository } from '@nuclom/lib/effect/services/collection-repository';
import { validateRequestBody } from '@nuclom/lib/validation';
import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';

const AddVideoSchema = Schema.Struct({
  videoId: Schema.String,
  position: Schema.optional(Schema.Number),
});

const ReorderVideosSchema = Schema.Struct({
  videoIds: Schema.Array(Schema.String),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * @summary Get available videos
 * @description Get videos that can be added to this collection (not already in it)
 * @response 200 Video[] - List of available videos
 * @response 401 - Unauthorized
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const { id } = params;

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Get organizationId from query params
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return yield* Effect.fail(
        new MissingFieldError({
          field: 'organizationId',
          message: 'Organization ID is required',
        }),
      );
    }

    // Fetch available videos using repository
    const collectionRepo = yield* CollectionRepository;
    const availableVideos = yield* collectionRepo.getAvailableVideos(organizationId, id);

    // Generate presigned thumbnail URLs
    const storage = yield* Storage;
    const videosWithPresignedUrls = yield* Effect.all(
      availableVideos.map((video) =>
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

    return videosWithPresignedUrls;
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}

/**
 * @summary Add video to collection
 * @description Add a video to this collection. For playlists, you can specify position.
 * @response 201 CollectionVideo - Video added to collection
 * @response 400 - Invalid request body
 * @response 401 - Unauthorized
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const { id } = params;

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Parse and validate request body
    const { videoId, position } = yield* validateRequestBody(AddVideoSchema, request);

    // Add video to collection using repository
    const collectionRepo = yield* CollectionRepository;
    return yield* collectionRepo.addVideoToCollection(id, videoId, position);
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExitWithStatus(exit, 201);
}

/**
 * @summary Reorder videos in collection
 * @description Reorder videos in a playlist collection. Pass all video IDs in desired order.
 * @response 200 - Videos reordered successfully
 * @response 400 - Invalid request body
 * @response 401 - Unauthorized
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const { id } = params;

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Parse and validate request body
    const { videoIds } = yield* validateRequestBody(ReorderVideosSchema, request);

    // Reorder videos using repository
    const collectionRepo = yield* CollectionRepository;
    yield* collectionRepo.reorderVideos(id, videoIds);

    return { reordered: true };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}
