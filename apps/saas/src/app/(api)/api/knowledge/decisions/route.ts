import { handleEffectExitWithOptions, handleEffectExitWithStatus, runApiEffect } from '@nuclom/lib/api-handler';
import { CachePresets, getCacheControlHeader } from '@nuclom/lib/api-utils';
import { Auth } from '@nuclom/lib/effect/services/auth';
import { KnowledgeGraphRepository } from '@nuclom/lib/effect/services/knowledge-graph-repository';
import { validateQueryParams, validateRequestBody } from '@nuclom/lib/validation';
import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// Query/Body Schemas
// =============================================================================

const getDecisionsQuerySchema = Schema.Struct({
  organizationId: Schema.String,
  videoId: Schema.optional(Schema.String),
  status: Schema.optional(Schema.Literal('proposed', 'decided', 'revisited', 'superseded')),
  decisionType: Schema.optional(Schema.Literal('technical', 'process', 'product', 'team', 'other')),
  topic: Schema.optional(Schema.String),
  personId: Schema.optional(Schema.String),
  search: Schema.optional(Schema.String),
  minConfidence: Schema.optional(Schema.NumberFromString.pipe(Schema.int(), Schema.between(0, 100))),
  page: Schema.optionalWith(Schema.NumberFromString.pipe(Schema.int(), Schema.positive()), { default: () => 1 }),
  limit: Schema.optionalWith(
    Schema.NumberFromString.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1), Schema.lessThanOrEqualTo(100)),
    { default: () => 20 },
  ),
});

const createDecisionSchema = Schema.Struct({
  organizationId: Schema.String,
  videoId: Schema.String,
  summary: Schema.String.pipe(Schema.maxLength(500)),
  context: Schema.optional(Schema.String.pipe(Schema.maxLength(2000))),
  reasoning: Schema.optional(Schema.String.pipe(Schema.maxLength(1000))),
  timestampStart: Schema.optional(Schema.Number),
  timestampEnd: Schema.optional(Schema.Number),
  decisionType: Schema.optionalWith(Schema.Literal('technical', 'process', 'product', 'team', 'other'), {
    default: () => 'other' as const,
  }),
  status: Schema.optionalWith(Schema.Literal('proposed', 'decided', 'revisited', 'superseded'), {
    default: () => 'decided' as const,
  }),
  confidence: Schema.optional(Schema.Number.pipe(Schema.between(0, 100))),
  tags: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
});

// =============================================================================
// GET /api/knowledge/decisions - List decisions for an organization
// =============================================================================

export async function GET(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Validate query params
    const params = yield* validateQueryParams(getDecisionsQuerySchema, request.url);

    // Fetch decisions
    const repo = yield* KnowledgeGraphRepository;
    const decisions = yield* repo.listDecisions({
      organizationId: params.organizationId,
      videoId: params.videoId,
      status: params.status,
      decisionType: params.decisionType,
      topic: params.topic,
      personId: params.personId,
      search: params.search,
      minConfidence: params.minConfidence,
      limit: params.limit,
      offset: (params.page - 1) * params.limit,
    });

    return {
      decisions,
      page: params.page,
      limit: params.limit,
      hasMore: decisions.length === params.limit,
    };
  });

  const exit = await runApiEffect(effect);
  return handleEffectExitWithOptions(exit, {
    successHeaders: {
      'Cache-Control': getCacheControlHeader(CachePresets.shortWithSwr()),
    },
  });
}

// =============================================================================
// POST /api/knowledge/decisions - Create a new decision
// =============================================================================

export async function POST(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Validate request body
    const data = yield* validateRequestBody(createDecisionSchema, request);

    // Create decision
    const repo = yield* KnowledgeGraphRepository;
    const decision = yield* repo.createDecision({
      organizationId: data.organizationId,
      videoId: data.videoId,
      summary: data.summary,
      context: data.context,
      reasoning: data.reasoning,
      timestampStart: data.timestampStart ?? null,
      timestampEnd: data.timestampEnd ?? null,
      decisionType: data.decisionType,
      status: data.status,
      confidence: data.confidence ?? null,
      tags: data.tags ? [...data.tags] : [],
    });

    return decision;
  });

  const exit = await runApiEffect(effect);
  return handleEffectExitWithStatus(exit, 201);
}
