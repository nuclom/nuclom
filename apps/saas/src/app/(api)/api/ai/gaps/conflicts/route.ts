/**
 * Decision Conflicts API Route
 *
 * GET /api/ai/gaps/conflicts - Detect conflicts between decisions
 */

import { Auth, createFullLayer, handleEffectExit } from '@nuclom/lib/api-handler';
import { OrganizationRepository } from '@nuclom/lib/effect';
import { KnowledgeGapDetector } from '@nuclom/lib/effect/services/knowledge';
import { Effect } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// GET - Detect Decision Conflicts
// =============================================================================

export async function GET(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Parse query params
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return yield* Effect.fail(new Error('organizationId is required'));
    }

    // Verify user has access to the organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, organizationId);

    // Detect conflicts
    const gapService = yield* KnowledgeGapDetector;
    const result = yield* gapService.detectConflicts(organizationId);

    return result;
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
