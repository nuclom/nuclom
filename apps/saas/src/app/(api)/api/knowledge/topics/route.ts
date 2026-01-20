/**
 * Topic Clusters API Routes
 *
 * GET /api/knowledge/topics - List topic clusters
 * POST /api/knowledge/topics - Create a topic cluster or auto-cluster
 */

import { Auth, createFullLayer, handleEffectExit, handleEffectExitWithStatus } from '@nuclom/lib/api-handler';
import { OrganizationRepository } from '@nuclom/lib/effect';
import { autoClusterContent, createTopicCluster, TopicCluster } from '@nuclom/lib/effect/services/knowledge';
import { validateQueryParams } from '@nuclom/lib/validation';
import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// Schemas
// =============================================================================

const GetTopicsQuerySchema = Schema.Struct({
  organizationId: Schema.String,
  parentId: Schema.optional(Schema.String),
  limit: Schema.optional(Schema.NumberFromString),
  offset: Schema.optional(Schema.NumberFromString),
});

const _CreateTopicSchema = Schema.Struct({
  organizationId: Schema.String,
  name: Schema.String,
  description: Schema.optional(Schema.String),
  keywords: Schema.optional(Schema.mutable(Schema.Array(Schema.String))),
  parentClusterId: Schema.optional(Schema.String),
});

const _AutoClusterSchema = Schema.Struct({
  organizationId: Schema.String,
  sourceId: Schema.optional(Schema.String),
  minClusterSize: Schema.optional(Schema.Number),
  maxClusters: Schema.optional(Schema.Number),
  similarityThreshold: Schema.optional(Schema.Number),
  useAI: Schema.optional(Schema.Boolean),
  autoCreate: Schema.optional(Schema.Boolean), // Create clusters automatically
});

// =============================================================================
// GET - List Topic Clusters
// =============================================================================

export async function GET(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Validate query params
    const params = yield* validateQueryParams(GetTopicsQuerySchema, request.url);

    // Verify user has access to the organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, params.organizationId);

    // Get topic clusters
    const topicService = yield* TopicCluster;
    const clusters = yield* topicService.listClusters(params.organizationId, {
      parentId: params.parentId,
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
    });

    return clusters;
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}

// =============================================================================
// POST - Create Topic Cluster or Auto-Cluster
// =============================================================================

export async function POST(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Try to parse as auto-cluster request first
    const body = yield* Effect.tryPromise({
      try: () => request.clone().json(),
      catch: () => new Error('Invalid JSON'),
    });

    // Verify user has access to the organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, body.organizationId);

    // Check if this is an auto-cluster request
    if (body.autoCreate !== undefined || body.minClusterSize !== undefined || body.similarityThreshold !== undefined) {
      // Auto-cluster request
      const result = yield* autoClusterContent({
        organizationId: body.organizationId,
        sourceId: body.sourceId,
        minClusterSize: body.minClusterSize,
        maxClusters: body.maxClusters,
        similarityThreshold: body.similarityThreshold,
        useAI: body.useAI,
      });

      // Create clusters if autoCreate is true
      if (body.autoCreate) {
        const topicService = yield* TopicCluster;
        const createdClusters = [];

        for (const cluster of result.clusters) {
          const created = yield* topicService.createCluster({
            organizationId: body.organizationId,
            name: cluster.name,
            description: cluster.description,
            keywords: cluster.tags,
          });

          // Add members to the cluster
          if (cluster.memberIds.length > 0) {
            yield* topicService.addToCluster(created.id, cluster.memberIds);
          }

          createdClusters.push(created);
        }

        return {
          clusters: createdClusters,
          unclusteredItems: result.unclusteredItems,
          created: createdClusters.length,
        };
      }

      return result;
    }

    // Regular create cluster request
    const cluster = yield* createTopicCluster({
      organizationId: body.organizationId,
      name: body.name,
      description: body.description,
      keywords: body.keywords,
    });

    return cluster;
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExitWithStatus(exit, 201);
}
