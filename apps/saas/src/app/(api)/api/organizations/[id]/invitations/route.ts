import { handleEffectExit, runApiEffect } from '@nuclom/lib/api-handler';
import { ForbiddenError, OrganizationRepository } from '@nuclom/lib/effect';
import { Auth } from '@nuclom/lib/effect/services/auth';
import { Effect } from 'effect';
import { type NextRequest, NextResponse } from 'next/server';

// =============================================================================
// GET /api/organizations/[id]/invitations - Get pending invitations
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const { id: organizationId } = yield* Effect.promise(() => params);

    // Authenticate and verify membership
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const orgRepo = yield* OrganizationRepository;

    // Check if user is a member of this organization
    const membershipCheck = yield* orgRepo.isMember(user.id, organizationId);
    if (!membershipCheck) {
      return yield* Effect.fail(
        new ForbiddenError({
          message: 'Access denied',
          resource: 'Organization',
        }),
      );
    }

    // Get all pending invitations for the organization
    const pendingInvitations = yield* orgRepo.getPendingInvitations(organizationId);

    return pendingInvitations;
  });

  const exit = await runApiEffect(effect);
  return handleEffectExit(exit);
}

// =============================================================================
// DELETE /api/organizations/[id]/invitations - Cancel an invitation
// =============================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const url = new URL(request.url);
  const invitationId = url.searchParams.get('invitationId');

  if (!invitationId) {
    return NextResponse.json({ success: false, error: 'invitationId query parameter is required' }, { status: 400 });
  }

  const effect = Effect.gen(function* () {
    const { id: organizationId } = yield* Effect.promise(() => params);

    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const orgRepo = yield* OrganizationRepository;

    // cancelInvitation checks ownership and deletes the invitation
    yield* orgRepo.cancelInvitation(organizationId, invitationId, user.id);

    return { message: 'Invitation cancelled successfully' };
  });

  const exit = await runApiEffect(effect);
  return handleEffectExit(exit);
}
