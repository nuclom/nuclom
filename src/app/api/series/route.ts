import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';
import {
  createFullLayer,
  generatePresignedThumbnailUrl,
  handleEffectExitWithOptions,
  handleEffectExitWithStatus,
  Storage,
} from '@/lib/api-handler';
import { CachePresets, getCacheControlHeader, parsePaginationParams } from '@/lib/api-utils';
import { MissingFieldError, SeriesRepository } from '@/lib/effect';
import { Auth } from '@/lib/effect/services/auth';
import { validateRequestBody } from '@/lib/validation';

const CreateSeriesSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1)),
  description: Schema.optional(Schema.String),
  thumbnailUrl: Schema.optional(Schema.String),
  organizationId: Schema.String,
  isPublic: Schema.optional(Schema.Boolean),
});

/**
 * @summary List series
 * @description Get a paginated list of video series for an organization
 * @response 200 PaginatedSeries - List of series with pagination
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
    const { page, limit } = parsePaginationParams(searchParams);

    if (!organizationId) {
      return yield* Effect.fail(
        new MissingFieldError({
          field: 'organizationId',
          message: 'Organization ID is required',
        }),
      );
    }

    // Fetch series using repository
    const seriesRepo = yield* SeriesRepository;
    const seriesData = yield* seriesRepo.getSeries(organizationId, page, limit);

    // Generate presigned thumbnail URLs for all series
    const storage = yield* Storage;
    const seriesWithPresignedUrls = yield* Effect.all(
      seriesData.data.map((series) =>
        Effect.gen(function* () {
          const presignedThumbnailUrl = yield* generatePresignedThumbnailUrl(storage, series.thumbnailUrl);
          return {
            ...series,
            thumbnailUrl: presignedThumbnailUrl,
          };
        }),
      ),
      { concurrency: 10 },
    );

    return {
      data: seriesWithPresignedUrls,
      pagination: seriesData.pagination,
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExitWithOptions(exit, {
    successHeaders: { 'Cache-Control': getCacheControlHeader(CachePresets.shortWithSwr()) },
  });
}

/**
 * @summary Create series
 * @description Create a new video series/playlist
 * @response 201 Series - Series created successfully
 * @response 400 - Invalid request body
 * @response 401 - Unauthorized
 */
export async function POST(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Parse and validate request body
    const { name, description, thumbnailUrl, organizationId, isPublic } = yield* validateRequestBody(
      CreateSeriesSchema,
      request,
    );

    // Create series using repository
    const seriesRepo = yield* SeriesRepository;
    return yield* seriesRepo.createSeries({
      name,
      description,
      thumbnailUrl,
      organizationId,
      createdById: user.id,
      isPublic: isPublic ?? false,
    });
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExitWithStatus(exit, 201);
}
