import { handleEffectExit, runApiEffect } from '@nuclom/lib/api-handler';
import { OrganizationRepository } from '@nuclom/lib/effect';
import { Auth } from '@nuclom/lib/effect/services/auth';
import { safeParse } from '@nuclom/lib/validation';
import { Effect, Schema } from 'effect';
import { type NextRequest, NextResponse } from 'next/server';

const UpdateMemberRoleSchema = Schema.Struct({
  userId: Schema.String,
  role: Schema.Literal('owner', 'member'),
});

// =============================================================================
// GET /api/organizations/[id]/members - Get organization members
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const { id: organizationId } = yield* Effect.promise(() => params);

    // Authenticate and verify membership
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const orgRepo = yield* OrganizationRepository;

    // isMember throws ForbiddenError if user is not a member
    yield* orgRepo.isMember(user.id, organizationId);

    // Get all members of the organization
    const organizationMembers = yield* orgRepo.getOrganizationMembers(organizationId);

    return organizationMembers;
  });

  const exit = await runApiEffect(effect);
  return handleEffectExit(exit);
}

// =============================================================================
// DELETE /api/organizations/[id]/members - Remove a member
// =============================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const url = new URL(request.url);
  const userIdToRemove = url.searchParams.get('userId');

  if (!userIdToRemove) {
    return NextResponse.json({ success: false, error: 'userId query parameter is required' }, { status: 400 });
  }

  const effect = Effect.gen(function* () {
    const { id: organizationId } = yield* Effect.promise(() => params);

    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.removeMember(organizationId, userIdToRemove, user.id);

    return { message: 'Member removed successfully' };
  });

  const exit = await runApiEffect(effect);
  return handleEffectExit(exit);
}

// =============================================================================
// PATCH /api/organizations/[id]/members - Update member role
// =============================================================================

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rawBody = await request.json();
  const result = safeParse(UpdateMemberRoleSchema, rawBody);
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: "userId and role are required. role must be 'owner' or 'member'" },
      { status: 400 },
    );
  }
  const { userId, role } = result.data;

  const effect = Effect.gen(function* () {
    const { id: organizationId } = yield* Effect.promise(() => params);

    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const orgRepo = yield* OrganizationRepository;
    const updatedMember = yield* orgRepo.updateMemberRole(organizationId, userId, role, user.id);

    return { message: 'Member role updated successfully', member: updatedMember };
  });

  const exit = await runApiEffect(effect);
  return handleEffectExit(exit);
}
