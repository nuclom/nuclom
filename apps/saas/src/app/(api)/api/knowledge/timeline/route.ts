import { handleEffectExitWithOptions, runApiEffect } from '@nuclom/lib/api-handler';
import { CachePresets, getCacheControlHeader } from '@nuclom/lib/api-utils';
import { Auth } from '@nuclom/lib/effect/services/auth';
import { KnowledgeGraphRepository } from '@nuclom/lib/effect/services/knowledge-graph-repository';
import { validateQueryParams } from '@nuclom/lib/validation';
import { Effect, Schema } from 'effect';
import { connection, type NextRequest } from 'next/server';

// =============================================================================
// Query Schema
// =============================================================================

const getTimelineQuerySchema = Schema.Struct({
  organizationId: Schema.String,
  topic: Schema.optional(Schema.String),
  personId: Schema.optional(Schema.String),
  from: Schema.optional(Schema.String), // ISO date string
  to: Schema.optional(Schema.String), // ISO date string
  page: Schema.optionalWith(Schema.NumberFromString.pipe(Schema.int(), Schema.positive()), { default: () => 1 }),
  limit: Schema.optionalWith(
    Schema.NumberFromString.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1), Schema.lessThanOrEqualTo(100)),
    { default: () => 50 },
  ),
});

// =============================================================================
// GET /api/knowledge/timeline - Get decision timeline
// =============================================================================

export async function GET(request: NextRequest) {
  await connection();
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Validate query params
    const params = yield* validateQueryParams(getTimelineQuerySchema, request.url);

    // Parse dates if provided
    const from = params.from ? new Date(params.from) : undefined;
    const to = params.to ? new Date(params.to) : undefined;

    // Fetch timeline
    const repo = yield* KnowledgeGraphRepository;
    const timeline = yield* repo.getDecisionTimeline(params.organizationId, {
      topic: params.topic,
      personId: params.personId,
      from,
      to,
      limit: params.limit,
      offset: (params.page - 1) * params.limit,
    });

    return {
      timeline,
      page: params.page,
      limit: params.limit,
      hasMore: timeline.length === params.limit,
    };
  });

  const exit = await runApiEffect(effect);
  return handleEffectExitWithOptions(exit, {
    successHeaders: {
      'Cache-Control': getCacheControlHeader(CachePresets.shortWithSwr),
    },
  });
}
