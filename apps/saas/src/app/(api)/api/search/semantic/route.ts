import { createFullLayer, handleEffectExit } from '@nuclom/lib/api-handler';
import { MissingFieldError } from '@nuclom/lib/effect/errors';
import { Auth } from '@nuclom/lib/effect/services/auth';
import { Embedding } from '@nuclom/lib/effect/services/embedding';
import { SemanticSearchRepository } from '@nuclom/lib/effect/services/semantic-search-repository';
import { validateRequestBody } from '@nuclom/lib/validation';
import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';
import { connection } from 'next/server';

// =============================================================================
// POST /api/search/semantic - Semantic search using embeddings
// =============================================================================

export async function POST(request: NextRequest) {
  await connection();

  const SemanticSearchBodySchema = Schema.Struct({
    query: Schema.optional(Schema.String),
    organizationId: Schema.optional(Schema.String),
    limit: Schema.optional(Schema.Number),
    threshold: Schema.optional(Schema.Number),
    contentTypes: Schema.optional(Schema.Array(Schema.Literal('transcript_chunk', 'decision'))),
    videoIds: Schema.optional(Schema.Array(Schema.String)),
    channelIds: Schema.optional(Schema.Array(Schema.String)),
  });

  const effect = Effect.gen(function* () {
    const body = yield* validateRequestBody(SemanticSearchBodySchema, request);

    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    const { query, organizationId, limit = 20, threshold = 0.7, contentTypes, videoIds } = body;

    if (!query || !query.trim()) {
      return yield* Effect.fail(
        new MissingFieldError({
          field: 'query',
          message: 'Search query is required',
        }),
      );
    }

    if (!organizationId) {
      return yield* Effect.fail(
        new MissingFieldError({
          field: 'organizationId',
          message: 'Organization ID is required',
        }),
      );
    }

    // Generate embedding for the query
    const embeddingService = yield* Embedding;
    const queryEmbedding = yield* embeddingService.generateEmbedding(query.trim());

    // Perform semantic search
    const searchRepo = yield* SemanticSearchRepository;
    const results = yield* searchRepo.semanticSearchWithVideos({
      queryEmbedding,
      organizationId,
      limit,
      threshold,
      contentTypes,
      videoIds,
    });

    return {
      results,
      query: query.trim(),
      total: results.length,
      threshold,
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}

// =============================================================================
// GET /api/search/semantic - Simple semantic search via query params
// =============================================================================

export async function GET(request: NextRequest) {
  await connection();

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Parse query params
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const organizationId = searchParams.get('organizationId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const threshold = parseFloat(searchParams.get('threshold') || '0.7');

    if (!query.trim()) {
      return yield* Effect.fail(
        new MissingFieldError({
          field: 'q',
          message: 'Search query is required',
        }),
      );
    }

    if (!organizationId) {
      return yield* Effect.fail(
        new MissingFieldError({
          field: 'organizationId',
          message: 'Organization ID is required',
        }),
      );
    }

    // Generate embedding for the query
    const embeddingService = yield* Embedding;
    const queryEmbedding = yield* embeddingService.generateEmbedding(query.trim());

    // Perform semantic search
    const searchRepo = yield* SemanticSearchRepository;
    const results = yield* searchRepo.semanticSearchWithVideos({
      queryEmbedding,
      organizationId,
      limit,
      threshold,
    });

    return {
      results,
      query: query.trim(),
      total: results.length,
      threshold,
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}
