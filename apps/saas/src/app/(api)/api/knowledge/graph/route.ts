import { handleEffectExitWithOptions, runApiEffect } from '@nuclom/lib/api-handler';
import { CachePresets, getCacheControlHeader } from '@nuclom/lib/api-utils';
import { KnowledgeGraphRepository } from '@nuclom/lib/effect';
import { Auth } from '@nuclom/lib/effect/services/auth';
import { validateQueryParams } from '@nuclom/lib/validation';
import { Effect, Schema } from 'effect';
import { connection, type NextRequest } from 'next/server';

// =============================================================================
// Query Schema
// =============================================================================

const getGraphQuerySchema = Schema.Struct({
  organizationId: Schema.String,
  centerId: Schema.optional(Schema.String),
  centerType: Schema.optional(Schema.Literal('person', 'topic', 'artifact', 'decision', 'video')),
  depth: Schema.optionalWith(Schema.NumberFromString.pipe(Schema.int(), Schema.between(1, 5)), { default: () => 2 }),
  relationshipTypes: Schema.optional(Schema.String), // comma-separated list
  limit: Schema.optionalWith(
    Schema.NumberFromString.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1), Schema.lessThanOrEqualTo(500)),
    { default: () => 200 },
  ),
});

// =============================================================================
// GET /api/knowledge/graph - Get knowledge graph visualization data
// =============================================================================

export async function GET(request: NextRequest) {
  await connection();
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Validate query params
    const params = yield* validateQueryParams(getGraphQuerySchema, request.url);

    // Parse relationship types if provided
    const relationshipTypes = params.relationshipTypes
      ? params.relationshipTypes.split(',').map((t) => t.trim())
      : undefined;

    // Fetch graph data
    const repo = yield* KnowledgeGraphRepository;
    const { nodes, edges } = yield* repo.getGraph({
      organizationId: params.organizationId,
      centerId: params.centerId,
      centerType: params.centerType,
      depth: params.depth,
      relationshipTypes,
      limit: params.limit,
    });

    // Transform to visualization-friendly format
    return {
      nodes: nodes.map((node) => ({
        id: node.id,
        type: node.type,
        name: node.name,
        description: node.description,
        externalId: node.externalId,
        metadata: node.metadata,
      })),
      edges: edges.map((edge) => ({
        id: edge.id,
        source: edge.sourceNodeId,
        target: edge.targetNodeId,
        relationship: edge.relationship,
        weight: edge.weight,
        metadata: edge.metadata,
      })),
      stats: {
        nodeCount: nodes.length,
        edgeCount: edges.length,
      },
    };
  });

  const exit = await runApiEffect(effect);
  return handleEffectExitWithOptions(exit, {
    successHeaders: {
      'Cache-Control': getCacheControlHeader(CachePresets.shortWithSwr()),
    },
  });
}
