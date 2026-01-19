/**
 * Relationship Detection API Routes
 *
 * POST /api/knowledge/relationships/detect - Detect relationships for content items
 * GET /api/knowledge/relationships - List relationships for an organization
 */

import { Schema } from 'effect';
import { Effect } from 'effect';
import type { NextRequest } from 'next/server';
import {
  Auth,
  createFullLayer,
  handleEffectExit,
  handleEffectExitWithStatus,
} from '@nuclom/lib/api-handler';
import { ContentRepository } from '@nuclom/lib/effect/services/content';
import {
  RelationshipDetector,
  detectRelationships,
} from '@nuclom/lib/effect/services/knowledge';
import { OrganizationRepository } from '@nuclom/lib/effect';
import { validateQueryParams, validateRequestBody } from '@nuclom/lib/validation';

// =============================================================================
// Schemas
// =============================================================================

const GetRelationshipsQuerySchema = Schema.Struct({
  organizationId: Schema.String,
  sourceId: Schema.optional(Schema.String),
  itemId: Schema.optional(Schema.String),
  relationshipType: Schema.optional(Schema.String),
  limit: Schema.optional(Schema.NumberFromString),
  offset: Schema.optional(Schema.NumberFromString),
});

const DetectRelationshipsSchema = Schema.Struct({
  organizationId: Schema.String,
  sourceId: Schema.optional(Schema.String),
  itemIds: Schema.optional(Schema.Array(Schema.String)),
  minConfidence: Schema.optional(Schema.Number),
  maxResults: Schema.optional(Schema.Number),
  strategies: Schema.optional(
    Schema.Array(Schema.Literal('explicit', 'semantic', 'temporal', 'entity')),
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

    // Get relationships
    const contentRepo = yield* ContentRepository;
    const relationships = yield* contentRepo.getRelationships({
      organizationId: params.organizationId,
      sourceId: params.sourceId,
      itemId: params.itemId,
      relationshipType: params.relationshipType as 'references' | 'mentions' | 'similar_to' | 'related_to' | 'replies_to' | 'parent_of' | 'implements' | 'supersedes' | undefined,
    }, {
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
    });

    return relationships;
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
