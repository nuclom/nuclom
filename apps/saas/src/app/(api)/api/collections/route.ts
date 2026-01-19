import {
  createFullLayer,
  generatePresignedThumbnailUrl,
  handleEffectExitWithOptions,
  handleEffectExitWithStatus,
  Storage,
} from '@nuclom/lib/api-handler';
import { CachePresets, getCacheControlHeader, parsePaginationParams } from '@nuclom/lib/api-utils';
import type { CollectionType } from '@nuclom/lib/db/schema';
import { MissingFieldError } from '@nuclom/lib/effect';
import { Auth } from '@nuclom/lib/effect/services/auth';
import { CollectionRepository } from '@nuclom/lib/effect/services/collection-repository';
import { validateRequestBody } from '@nuclom/lib/validation';
import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';

const CreateCollectionSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1)),
  description: Schema.optional(Schema.String),
  thumbnailUrl: Schema.optional(Schema.String),
  organizationId: Schema.String,
  type: Schema.optional(Schema.Literal('folder', 'playlist')),
  isPublic: Schema.optional(Schema.Boolean),
});

/**
 * @summary List collections
 * @description Get a paginated list of collections for an organization.
 * Use `type` query param to filter by collection type (folder or playlist).
 * @response 200 PaginatedCollections - List of collections with pagination
 * @response 400 - Invalid request parameters
 * @response 401 - Unauthorized
 */
export async function GET(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Parse query params with validation
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const type = searchParams.get('type') as CollectionType | null;
    const { page, limit } = parsePaginationParams(searchParams);

    if (!organizationId) {
      return yield* Effect.fail(
        new MissingFieldError({
          field: 'organizationId',
          message: 'Organization ID is required',
        }),
      );
    }

    // Validate type if provided
    if (type && type !== 'folder' && type !== 'playlist') {
      return yield* Effect.fail(
        new MissingFieldError({
          field: 'type',
          message: 'Invalid collection type. Must be "folder" or "playlist"',
        }),
      );
    }

    // Fetch collections using repository
    const collectionRepo = yield* CollectionRepository;
    const collectionsData = yield* collectionRepo.getCollections(organizationId, {
      type: type ?? undefined,
      page,
      limit,
    });

    // Generate presigned thumbnail URLs for all collections
    const storage = yield* Storage;
    const collectionsWithPresignedUrls = yield* Effect.all(
      collectionsData.data.map((collection) =>
        Effect.gen(function* () {
          const presignedThumbnailUrl = yield* generatePresignedThumbnailUrl(storage, collection.thumbnailUrl);
          return {
            ...collection,
            thumbnailUrl: presignedThumbnailUrl,
          };
        }),
      ),
      { concurrency: 10 },
    );

    return {
      data: collectionsWithPresignedUrls,
      pagination: collectionsData.pagination,
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExitWithOptions(exit, {
    successHeaders: { 'Cache-Control': getCacheControlHeader(CachePresets.shortWithSwr()) },
  });
}

/**
 * @summary Create collection
 * @description Create a new collection. Use `type: "folder"` for simple grouping,
 * `type: "playlist"` for ordered videos with progress tracking.
 * @response 201 Collection - Collection created successfully
 * @response 400 - Invalid request body
 * @response 401 - Unauthorized
 */
export async function POST(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Parse and validate request body
    const { name, description, thumbnailUrl, organizationId, type, isPublic } = yield* validateRequestBody(
      CreateCollectionSchema,
      request,
    );

    // Create collection using repository
    const collectionRepo = yield* CollectionRepository;
    return yield* collectionRepo.createCollection({
      name,
      description,
      thumbnailUrl,
      organizationId,
      createdById: user.id,
      type: type ?? 'folder',
      isPublic: isPublic ?? false,
    });
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExitWithStatus(exit, 201);
}
