/**
 * Daily Digest API Route
 *
 * GET /api/ai/summaries/daily - Get daily digest for organization
 */

import { Auth, createFullLayer, handleEffectExit } from '@nuclom/lib/api-handler';
import { ValidationError } from '@nuclom/lib/effect/errors';
import { SmartSummary } from '@nuclom/lib/effect/services/knowledge';
import { OrganizationRepository } from '@nuclom/lib/effect/services/organization-repository';
import { Effect } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// GET - Get Daily Digest
// =============================================================================

export async function GET(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Parse query params
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const dateParam = searchParams.get('date');

    if (!organizationId) {
      return yield* Effect.fail(
        new ValidationError({
          message: 'organizationId is required',
        }),
      );
    }

    // Verify user has access to the organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, organizationId);

    // Get daily digest
    const summaryService = yield* SmartSummary;
    const date = dateParam ? new Date(dateParam) : undefined;
    const result = yield* summaryService.generateDailyDigest(organizationId, date);

    return result;
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
