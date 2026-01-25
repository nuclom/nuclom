import { createFullLayer, handleEffectExit } from '@nuclom/lib/api-handler';
import { Auth } from '@nuclom/lib/effect/services/auth';
import { SearchRepository } from '@nuclom/lib/effect/services/search-repository';
import { validateRequestBody } from '@nuclom/lib/validation';
import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// PATCH /api/search/saved/[id] - Update a saved search
// =============================================================================

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const { id } = yield* Effect.promise(() => params);

    // Parse request body
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

    const SavedSearchUpdateSchema = Schema.Struct({
      name: Schema.optional(Schema.String),
      query: Schema.optional(Schema.String),
      filters: Schema.optional(SearchFiltersSchema),
    });

    const body = yield* validateRequestBody(SavedSearchUpdateSchema, request);
    const { name, query, filters } = body;

    // Update saved search
    const searchRepo = yield* SearchRepository;
    return yield* searchRepo.updateSavedSearch(id, user.id, {
      name,
      query,
      filters,
    });
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}

// =============================================================================
// DELETE /api/search/saved/[id] - Delete a saved search
// =============================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const { id } = yield* Effect.promise(() => params);

    // Delete saved search
    const searchRepo = yield* SearchRepository;
    yield* searchRepo.deleteSavedSearch(id, user.id);

    return { success: true };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}
