import { handleEffectExit, runApiEffect } from '@nuclom/lib/api-handler';
import { MissingFieldError } from '@nuclom/lib/effect/errors';
import { Auth } from '@nuclom/lib/effect/services/auth';
import { SearchRepository } from '@nuclom/lib/effect/services/search-repository';
import { validateRequestBody } from '@nuclom/lib/validation';
import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// GET /api/search/saved - Get saved searches
// =============================================================================

export async function GET(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Parse query params
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

    // Get saved searches
    const searchRepo = yield* SearchRepository;
    return yield* searchRepo.getSavedSearches(user.id, organizationId);
  });

  const exit = await runApiEffect(effect);
  return handleEffectExit(exit);
}

// =============================================================================
// POST /api/search/saved - Create a saved search
// =============================================================================

export async function POST(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Parse request body with required fields validated by schema
    const SearchFiltersSchema = Schema.Struct({
      types: Schema.optional(Schema.Array(Schema.Literal('video', 'collections'))),
      authorId: Schema.optional(Schema.String),
      collectionId: Schema.optional(Schema.String),
      dateFrom: Schema.optional(Schema.String),
      dateTo: Schema.optional(Schema.String),
      hasTranscript: Schema.optional(Schema.Boolean),
      hasAiSummary: Schema.optional(Schema.Boolean),
      processingStatus: Schema.optional(Schema.String),
      tags: Schema.optional(Schema.Array(Schema.String)),
      sortBy: Schema.optional(Schema.Literal('relevance', 'date', 'title')),
      sortOrder: Schema.optional(Schema.Literal('asc', 'desc')),
    });

    const SavedSearchBodySchema = Schema.Struct({
      name: Schema.String,
      query: Schema.String,
      organizationId: Schema.String,
      filters: Schema.optional(SearchFiltersSchema),
    });

    const { name, query, organizationId, filters } = yield* validateRequestBody(SavedSearchBodySchema, request);

    // Create saved search
    const searchRepo = yield* SearchRepository;
    return yield* searchRepo.createSavedSearch({
      userId: user.id,
      organizationId,
      name,
      query,
      filters,
    });
  });

  const exit = await runApiEffect(effect);
  return handleEffectExit(exit);
}
