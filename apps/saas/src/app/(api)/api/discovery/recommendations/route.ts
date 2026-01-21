/**
 * Discovery Recommendations API Route
 *
 * GET /api/discovery/recommendations - Get personalized recommendations
 */

import { Auth, createFullLayer, handleEffectExit } from '@nuclom/lib/api-handler';
import { OrganizationRepository, ValidationError } from '@nuclom/lib/effect';
import { type ContentType, Discovery } from '@nuclom/lib/effect/services/discovery';
import { Effect } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// GET - Get Personalized Recommendations
// =============================================================================

export async function GET(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Parse query params
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const limitParam = searchParams.get('limit');
    const contentTypesParam = searchParams.get('contentTypes');

    if (!organizationId) {
      return yield* Effect.fail(new ValidationError({ message: 'organizationId is required' }));
    }

    // Verify user has access to the organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, organizationId);

    // Get recommendations
    const discoveryService = yield* Discovery;
    const result = yield* discoveryService.getRecommendations({
      organizationId,
      userId: user.id,
      limit: limitParam ? parseInt(limitParam, 10) : undefined,
      contentTypes: contentTypesParam ? (contentTypesParam.split(',') as ContentType[]) : undefined,
    });

    return result;
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
