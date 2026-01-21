/**
 * Recommendations API Route
 *
 * GET /api/ai/insights/recommendations - Get personalized recommendations
 */

import { Auth, createFullLayer, handleEffectExit } from '@nuclom/lib/api-handler';
import { OrganizationRepository } from '@nuclom/lib/effect';
import { ProactiveInsight } from '@nuclom/lib/effect/services/knowledge';
import { Effect } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// GET - Get Recommendations
// =============================================================================

export async function GET(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Parse query params
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const topicId = searchParams.get('topicId');

    if (!organizationId) {
      return yield* Effect.fail(new Error('organizationId is required'));
    }

    // Verify user has access to the organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, organizationId);

    // Get recommendations
    const insightService = yield* ProactiveInsight;
    const result = yield* insightService.getRecommendations(organizationId, {
      userId: user.id,
      topicId: topicId || undefined,
    });

    return result;
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
