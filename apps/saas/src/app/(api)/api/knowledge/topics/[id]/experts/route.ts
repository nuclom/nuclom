/**
 * Topic Experts API Route
 *
 * GET /api/knowledge/topics/[id]/experts - Get top experts for a topic
 */

import { Schema } from 'effect';
import { Effect } from 'effect';
import type { NextRequest } from 'next/server';
import {
  Auth,
  createFullLayer,
  handleEffectExit,
  resolveParams,
} from '@nuclom/lib/api-handler';
import {
  TopicCluster,
  getTopicCluster,
  getTopicExperts,
} from '@nuclom/lib/effect/services/knowledge';
import { OrganizationRepository } from '@nuclom/lib/effect';
import { validateQueryParams } from '@nuclom/lib/validation';

// =============================================================================
// Schemas
// =============================================================================

const GetExpertsQuerySchema = Schema.Struct({
  limit: Schema.optional(Schema.NumberFromString),
});

// =============================================================================
// GET - Get Topic Experts
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Resolve params
    const { id } = yield* resolveParams(params);

    // Validate query params
    const query = yield* validateQueryParams(GetExpertsQuerySchema, request.url);

    // Get topic cluster to verify access
    const cluster = yield* getTopicCluster(id);

    // Verify user has access to the organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, cluster.organizationId);

    // Get topic experts
    const experts = yield* getTopicExperts(id, { limit: query.limit ?? 10 });

    return {
      topicId: id,
      topicName: cluster.name,
      experts,
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
