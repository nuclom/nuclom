/**
 * Topic Cluster by ID API Routes
 *
 * GET /api/knowledge/topics/[id] - Get topic cluster details
 * PATCH /api/knowledge/topics/[id] - Update topic cluster
 * DELETE /api/knowledge/topics/[id] - Delete topic cluster
 */

import { Schema } from 'effect';
import { Effect } from 'effect';
import type { NextRequest } from 'next/server';
import {
  Auth,
  createFullLayer,
  handleEffectExit,
  handleEffectExitWithStatus,
  resolveParams,
} from '@nuclom/lib/api-handler';
import {
  TopicCluster,
  getTopicCluster,
} from '@nuclom/lib/effect/services/knowledge';
import { OrganizationRepository } from '@nuclom/lib/effect';
import { validateRequestBody } from '@nuclom/lib/validation';

// =============================================================================
// Schemas
// =============================================================================

const UpdateTopicSchema = Schema.Struct({
  name: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  tags: Schema.optional(Schema.Array(Schema.String)),
  parentClusterId: Schema.optional(Schema.String),
});

// =============================================================================
// GET - Get Topic Cluster
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Resolve params
    const { id } = yield* resolveParams(params);

    // Get topic cluster with members
    const cluster = yield* getTopicCluster(id);

    // Verify user has access to the organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, cluster.organizationId);

    return cluster;
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}

// =============================================================================
// PATCH - Update Topic Cluster
// =============================================================================

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Resolve params
    const { id } = yield* resolveParams(params);

    // Validate request body
    const data = yield* validateRequestBody(UpdateTopicSchema, request);

    // Get topic cluster to verify access
    const cluster = yield* getTopicCluster(id);

    // Verify user has access to the organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, cluster.organizationId);

    // Update the topic cluster
    const topicService = yield* TopicCluster;
    const updated = yield* topicService.updateCluster(id, {
      name: data.name,
      description: data.description,
      tags: data.tags,
      parentClusterId: data.parentClusterId,
    });

    return updated;
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}

// =============================================================================
// DELETE - Delete Topic Cluster
// =============================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Resolve params
    const { id } = yield* resolveParams(params);

    // Get topic cluster to verify access
    const cluster = yield* getTopicCluster(id);

    // Verify user has access to the organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, cluster.organizationId);

    // Delete the topic cluster
    const topicService = yield* TopicCluster;
    yield* topicService.deleteCluster(id);

    return { success: true };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExitWithStatus(exit, 200);
}
