import { createFullLayer, handleEffectExit } from '@nuclom/lib/api-handler';
import { MissingFieldError } from '@nuclom/lib/effect/errors';
import { Auth } from '@nuclom/lib/effect/services/auth';
import { UnifiedSearch } from '@nuclom/lib/effect/services/search';
import { Effect } from 'effect';
import type { NextRequest } from 'next/server';
import { connection } from 'next/server';

// =============================================================================
// GET /api/search/unified - Unified search across videos and content items
// =============================================================================

export async function GET(request: NextRequest) {
  await connection();

  const effect = Effect.gen(function* () {
    // Authenticate - verify user is logged in
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Parse query params
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const organizationId = searchParams.get('organizationId');

    // Pagination
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Source filtering
    const sourcesParam = searchParams.get('sources');
    const sources = sourcesParam ? sourcesParam.split(',') : undefined;
    const sourceIdsParam = searchParams.get('sourceIds');
    const sourceIds = sourceIdsParam ? sourceIdsParam.split(',') : undefined;

    // Content type filtering
    const contentTypesParam = searchParams.get('contentTypes');
    const contentTypes = contentTypesParam ? contentTypesParam.split(',') : undefined;

    // Date range filtering
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const dateRange =
      dateFrom || dateTo
        ? {
            from: dateFrom ? new Date(dateFrom) : undefined,
            to: dateTo ? new Date(dateTo) : undefined,
          }
        : undefined;

    // Topic filtering
    const topicIdsParam = searchParams.get('topicIds');
    const topicIds = topicIdsParam ? topicIdsParam.split(',') : undefined;

    // Search mode and configuration
    const mode = (searchParams.get('mode') as 'keyword' | 'semantic' | 'hybrid') || 'hybrid';
    const semanticWeight = parseFloat(searchParams.get('semanticWeight') || '0.5');
    const semanticThreshold = parseFloat(searchParams.get('semanticThreshold') || '0.6');

    // Include options
    const includeVideos = searchParams.get('includeVideos') !== 'false';
    const includeContentItems = searchParams.get('includeContentItems') !== 'false';
    const includeFacets = searchParams.get('includeFacets') === 'true';
    const includeHighlights = searchParams.get('includeHighlights') !== 'false';

    if (!organizationId) {
      return yield* Effect.fail(
        new MissingFieldError({
          field: 'organizationId',
          message: 'Organization ID is required',
        }),
      );
    }

    // Perform unified search
    const unifiedSearch = yield* UnifiedSearch;
    const results = yield* unifiedSearch.search({
      query,
      organizationId,
      sources: sources as Parameters<typeof unifiedSearch.search>[0]['sources'],
      sourceIds,
      contentTypes: contentTypes as Parameters<typeof unifiedSearch.search>[0]['contentTypes'],
      dateRange,
      topicIds,
      mode,
      semanticWeight,
      semanticThreshold,
      includeVideos,
      includeContentItems,
      includeFacets,
      includeHighlights,
      limit,
      offset,
    });

    return results;
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}
