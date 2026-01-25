import { handleEffectExit, runApiEffect } from '@nuclom/lib/api-handler';
import type { SearchFilters } from '@nuclom/lib/db/schema';
import { MissingFieldError } from '@nuclom/lib/effect/errors';
import { Auth } from '@nuclom/lib/effect/services/auth';
import { SearchRepository } from '@nuclom/lib/effect/services/search-repository';
import { createLogger } from '@nuclom/lib/logger';
import { Effect } from 'effect';
import type { NextRequest } from 'next/server';
import { connection } from 'next/server';

const logger = createLogger('api:search');

// =============================================================================
// GET /api/search - Search videos with full-text search
// =============================================================================

export async function GET(request: NextRequest) {
  await connection();

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Parse query params
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const organizationId = searchParams.get('organizationId');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);

    // Parse filters
    const authorId = searchParams.get('authorId');
    const channelId = searchParams.get('channelId');
    const collectionId = searchParams.get('collectionId');
    const processingStatus = searchParams.get('processingStatus');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const hasTranscript = searchParams.get('hasTranscript');
    const hasAiSummary = searchParams.get('hasAiSummary');
    const sortBy = searchParams.get('sortBy') as SearchFilters['sortBy'];
    const sortOrder = searchParams.get('sortOrder') as SearchFilters['sortOrder'];

    const filters: SearchFilters = {
      ...(authorId && { authorId }),
      ...(channelId && { channelId }),
      ...(collectionId && { collectionId }),
      ...(processingStatus && { processingStatus }),
      ...(dateFrom && { dateFrom }),
      ...(dateTo && { dateTo }),
      ...(hasTranscript === 'true' && { hasTranscript: true }),
      ...(hasAiSummary === 'true' && { hasAiSummary: true }),
      ...(sortBy && { sortBy }),
      ...(sortOrder && { sortOrder }),
    };

    if (!organizationId) {
      return yield* Effect.fail(
        new MissingFieldError({
          field: 'organizationId',
          message: 'Organization ID is required',
        }),
      );
    }

    // Perform search
    const searchRepo = yield* SearchRepository;
    const results = yield* searchRepo.search({
      query,
      organizationId,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      page,
      limit,
    });

    // Save search to history if query is not empty (non-blocking, log errors)
    if (query.trim()) {
      yield* searchRepo
        .saveSearchHistory({
          userId: user.id,
          organizationId,
          query: query.trim(),
          filters: Object.keys(filters).length > 0 ? filters : undefined,
          resultsCount: results.total,
        })
        .pipe(
          Effect.catchAll((err) => {
            logger.warn('Failed to save search history', { error: err, userId: user.id });
            return Effect.succeed(null);
          }),
        );
    }

    return results;
  });

  const exit = await runApiEffect(effect);
  return handleEffectExit(exit);
}
