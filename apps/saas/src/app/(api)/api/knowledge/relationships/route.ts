/**
 * Relationship Detection API Routes
 *
 * POST /api/knowledge/relationships/detect - Detect relationships for content items
 * GET /api/knowledge/relationships - List relationships for an organization
 */

import { Auth, createFullLayer, handleEffectExit, handleEffectExitWithStatus } from '@nuclom/lib/api-handler';
import { ContentRepository } from '@nuclom/lib/effect/services/content';
import { detectRelationships } from '@nuclom/lib/effect/services/knowledge';
import { OrganizationRepository } from '@nuclom/lib/effect/services/organization-repository';
import { validateQueryParams, validateRequestBody } from '@nuclom/lib/validation';
import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// Schemas
// =============================================================================

const GetRelationshipsQuerySchema = Schema.Struct({
  organizationId: Schema.String,
  itemId: Schema.optional(Schema.String),
  direction: Schema.optional(Schema.Literal('outgoing', 'incoming', 'both')),
});

const DetectRelationshipsSchema = Schema.Struct({
  organizationId: Schema.String,
  sourceId: Schema.optional(Schema.String),
  itemIds: Schema.optional(Schema.mutable(Schema.Array(Schema.String))),
  minConfidence: Schema.optional(Schema.Number),
  maxResults: Schema.optional(Schema.Number),
  strategies: Schema.optional(
    Schema.mutable(Schema.Array(Schema.Literal('explicit', 'semantic', 'temporal', 'entity'))),
  ),
  createRelationships: Schema.optional(Schema.Boolean),
});

// =============================================================================
// GET - List Relationships
// =============================================================================

export async function GET(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Validate query params
    const params = yield* validateQueryParams(GetRelationshipsQuerySchema, request.url);

    // Verify user has access to the organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, params.organizationId);

    // Get relationships for an item if specified
    const contentRepo = yield* ContentRepository;

    if (params.itemId) {
      // Get relationships for a specific item
      const relationships = yield* contentRepo.getRelationships(params.itemId, params.direction ?? 'both');
      return { relationships, total: relationships.length };
    }

    // Without itemId, return empty - relationships must be queried by item
    return { relationships: [], total: 0, message: 'Provide itemId to query relationships' };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}

// =============================================================================
// POST - Detect Relationships
// =============================================================================

export async function POST(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Validate request body
    const data = yield* validateRequestBody(DetectRelationshipsSchema, request);

    // Verify user has access to the organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, data.organizationId);

    // Detect relationships
    const result = yield* detectRelationships({
      organizationId: data.organizationId,
      sourceId: data.sourceId,
      itemIds: data.itemIds,
      minConfidence: data.minConfidence,
      maxResults: data.maxResults,
      strategies: data.strategies,
    });

    return result;
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExitWithStatus(exit, 200);
}
