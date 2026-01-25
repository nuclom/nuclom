/**
 * Related Content API Route
 *
 * GET /api/discovery/related/[itemId] - Get related content for a specific item
 */

import { Auth, createFullLayer, handleEffectExit } from '@nuclom/lib/api-handler';
import { ValidationError } from '@nuclom/lib/effect/errors';
import { type ContentType, Discovery } from '@nuclom/lib/effect/services/discovery';
import { OrganizationRepository } from '@nuclom/lib/effect/services/organization-repository';
import { Effect } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// GET - Get Related Content
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Get item ID from params
    const { itemId } = yield* Effect.promise(() => params);

    // Parse query params
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const itemType = searchParams.get('itemType') as ContentType | null;
    const limitParam = searchParams.get('limit');

    if (!organizationId) {
      return yield* Effect.fail(new ValidationError({ message: 'organizationId is required' }));
    }

    if (!itemType) {
      return yield* Effect.fail(new ValidationError({ message: 'itemType is required' }));
    }

    // Verify user has access to the organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, organizationId);

    // Get related content
    const discoveryService = yield* Discovery;
    const result = yield* discoveryService.getRelatedContent({
      itemId,
      itemType,
      organizationId,
      limit: limitParam ? parseInt(limitParam, 10) : undefined,
    });

    return result;
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
