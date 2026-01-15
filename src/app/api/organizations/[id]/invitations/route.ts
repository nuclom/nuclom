import { and, eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { invitations, members, users } from '@/lib/db/schema';
import { logger } from '@/lib/logger';

// =============================================================================
// GET /api/organizations/[id]/invitations - Get pending invitations
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: organizationId } = await params;

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has access to this organization
    const userMembership = await db
      .select()
      .from(members)
      .where(and(eq(members.organizationId, organizationId), eq(members.userId, session.user.id)))
      .limit(1);

    if (userMembership.length === 0) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get all pending invitations for the organization
    const pendingInvitations = await db
      .select({
        id: invitations.id,
        email: invitations.email,
        role: invitations.role,
        status: invitations.status,
        expiresAt: invitations.expiresAt,
        createdAt: invitations.createdAt,
        inviter: {
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
        },
      })
      .from(invitations)
      .innerJoin(users, eq(invitations.inviterId, users.id))
      .where(and(eq(invitations.organizationId, organizationId), eq(invitations.status, 'pending')));

    return NextResponse.json(pendingInvitations);
  } catch (error) {
    logger.error('Failed to fetch organization invitations', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Failed to fetch organization invitations' }, { status: 500 });
  }
}

// =============================================================================
// DELETE /api/organizations/[id]/invitations - Cancel an invitation
// =============================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: organizationId } = await params;

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const invitationId = url.searchParams.get('invitationId');

    if (!invitationId) {
      return NextResponse.json({ error: 'invitationId query parameter is required' }, { status: 400 });
    }

    // Check if user is an owner of this organization
    const userMembership = await db
      .select()
      .from(members)
      .where(and(eq(members.organizationId, organizationId), eq(members.userId, session.user.id)))
      .limit(1);

    if (userMembership.length === 0) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (userMembership[0].role !== 'owner') {
      return NextResponse.json({ error: 'Only owners can cancel invitations' }, { status: 403 });
    }

    // Verify the invitation belongs to this organization and is pending
    const invitation = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.id, invitationId),
          eq(invitations.organizationId, organizationId),
          eq(invitations.status, 'pending'),
        ),
      )
      .limit(1);

    if (invitation.length === 0) {
      return NextResponse.json({ error: 'Invitation not found or already processed' }, { status: 404 });
    }

    // Cancel the invitation by deleting it
    await db.delete(invitations).where(eq(invitations.id, invitationId));

    logger.info(`Invitation ${invitationId} cancelled by user ${session.user.id}`);

    return NextResponse.json({ message: 'Invitation cancelled successfully' });
  } catch (error) {
    logger.error('Failed to cancel invitation', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Failed to cancel invitation' }, { status: 500 });
  }
}
