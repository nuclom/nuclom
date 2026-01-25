/**
 * Trending Content API Route
 *
 * GET /api/discovery/trending - Get trending content in organization
 */

import { Auth, createFullLayer, handleEffectExit } from '@nuclom/lib/api-handler';
import { ValidationError } from '@nuclom/lib/effect/errors';
import { Discovery } from '@nuclom/lib/effect/services/discovery';
import { OrganizationRepository } from '@nuclom/lib/effect/services/organization-repository';
import { Effect } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// GET - Get Trending Content
// =============================================================================

export async function GET(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Parse query params
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const timeframe = searchParams.get('timeframe') as 'day' | 'week' | 'month' | null;
    const limitParam = searchParams.get('limit');

    if (!organizationId) {
      return yield* Effect.fail(new ValidationError({ message: 'organizationId is required' }));
    }

    // Verify user has access to the organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, organizationId);

    // Get trending content
    const discoveryService = yield* Discovery;
    const result = yield* discoveryService.getTrending({
      organizationId,
      timeframe: timeframe ?? undefined,
      limit: limitParam ? parseInt(limitParam, 10) : undefined,
    });

    return result;
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
