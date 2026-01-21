import { handleEffectExit, runPublicApiEffect } from '@nuclom/lib/api-handler';
import { OrganizationRepository } from '@nuclom/lib/effect';
import { Effect } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// GET /api/invitations/[id] - Get invitation details
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const { id } = yield* Effect.promise(() => params);

    const orgRepo = yield* OrganizationRepository;
    const invitation = yield* orgRepo.getInvitationById(id);

    return invitation;
  });

  const exit = await runPublicApiEffect(effect);
  return handleEffectExit(exit);
}
