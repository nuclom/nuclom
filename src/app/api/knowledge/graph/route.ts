import { Cause, Effect, Exit, Layer, Schema } from "effect";
import { connection, type NextRequest, NextResponse } from "next/server";
import { mapErrorToApiResponse } from "@/lib/api-errors";
import { CachePresets, getCacheControlHeader } from "@/lib/api-utils";
import { auth } from "@/lib/auth";
import { AppLive, KnowledgeGraphRepository } from "@/lib/effect";
import { Auth, makeAuthLayer } from "@/lib/effect/services/auth";
import { validateQueryParams } from "@/lib/validation";

// =============================================================================
// Query Schema
// =============================================================================

const getGraphQuerySchema = Schema.Struct({
  organizationId: Schema.String,
  centerId: Schema.optional(Schema.String),
  centerType: Schema.optional(Schema.Literal("person", "topic", "artifact", "decision", "video")),
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

  const AuthLayer = makeAuthLayer(auth);
  const FullLayer = Layer.merge(AppLive, AuthLayer);

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Validate query params
    const params = yield* validateQueryParams(getGraphQuerySchema, request.url);

    // Parse relationship types if provided
    const relationshipTypes = params.relationshipTypes
      ? params.relationshipTypes.split(",").map((t) => t.trim())
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

  const runnable = Effect.provide(effect, FullLayer);
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === "Some") {
        return mapErrorToApiResponse(error.value);
      }
      return mapErrorToApiResponse(new Error("Internal server error"));
    },
    onSuccess: (data) =>
      NextResponse.json(data, {
        headers: {
          "Cache-Control": getCacheControlHeader(CachePresets.shortWithSwr()),
        },
      }),
  });
}
