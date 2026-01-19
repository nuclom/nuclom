import { organizationRoles } from '@nuclom/lib/access-control';
import { auth } from '@nuclom/lib/auth';
import { db } from '@nuclom/lib/db';
import { members } from '@nuclom/lib/db/schema';
import { logger } from '@nuclom/lib/logger';
import type { ApiResponse } from '@nuclom/lib/types';
import { safeParse } from '@nuclom/lib/validation';
import { and, eq } from 'drizzle-orm';
import { Schema } from 'effect';
import { headers } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

// Schema for updating member role
const UpdateRoleSchema = Schema.Struct({
  role: Schema.String,
});

// =============================================================================
// GET /api/organizations/[id]/members/[userId]/permissions - Get user permissions
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id: organizationId, userId } = await params;

  // Check if requesting user is a member
  const requestingMembership = await db.query.members.findFirst({
    where: and(eq(members.userId, session.user.id), eq(members.organizationId, organizationId)),
  });

  if (!requestingMembership) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Not a member of this organization' },
      { status: 403 },
    );
  }

  // Only owners/admins can view other users' permissions, or user can view their own
  if (session.user.id !== userId && requestingMembership.role !== 'owner') {
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'You can only view your own permissions' },
      { status: 403 },
    );
  }

  try {
    // Get the target user's membership to find their role
    const targetMembership = await db.query.members.findFirst({
      where: and(eq(members.userId, userId), eq(members.organizationId, organizationId)),
    });

    if (!targetMembership) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'User is not a member of this organization' },
        { status: 404 },
      );
    }

    // Get permissions from the role definition in access-control.ts
    const role = targetMembership.role as keyof typeof organizationRoles;
    const roleDefinition = organizationRoles[role];

    // Transform the role permissions into a flat list
    const permissions: Array<{ resource: string; action: string }> = [];
    if (roleDefinition) {
      // The role object has permissions organized by resource
      const rolePerms = roleDefinition as unknown as Record<string, string[]>;
      for (const [resource, actions] of Object.entries(rolePerms)) {
        if (Array.isArray(actions)) {
          for (const action of actions) {
            permissions.push({ resource, action });
          }
        }
      }
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        userId,
        role: targetMembership.role,
        permissions,
      },
    });
  } catch (error) {
    logger.error('[RBAC] Get permissions error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json<ApiResponse>(
      { success: false, error: error instanceof Error ? error.message : 'Failed to get permissions' },
      { status: 500 },
    );
  }
}

// =============================================================================
// POST /api/organizations/[id]/members/[userId]/permissions - Update member role
// =============================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id: organizationId, userId } = await params;

  // Check if user is an owner
  const membership = await db.query.members.findFirst({
    where: and(eq(members.userId, session.user.id), eq(members.organizationId, organizationId)),
  });

  if (!membership || membership.role !== 'owner') {
    return NextResponse.json<ApiResponse>({ success: false, error: 'Only owners can update roles' }, { status: 403 });
  }

  try {
    const rawBody = await request.json();
    const result = safeParse(UpdateRoleSchema, rawBody);
    if (!result.success) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'role is required' }, { status: 400 });
    }
    const { role } = result.data;

    // Validate role is one of the defined roles
    if (!Object.keys(organizationRoles).includes(role)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `Invalid role. Must be one of: ${Object.keys(organizationRoles).join(', ')}` },
        { status: 400 },
      );
    }

    // Get the member to update
    const targetMember = await db.query.members.findFirst({
      where: and(eq(members.userId, userId), eq(members.organizationId, organizationId)),
    });

    if (!targetMember) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'User is not a member of this organization' },
        { status: 404 },
      );
    }

    // Use Better Auth's member role update
    await auth.api.updateMemberRole({
      body: {
        memberId: targetMember.id,
        role,
        organizationId,
      },
      headers: await headers(),
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        message: 'Role updated successfully',
        role,
      },
    });
  } catch (error) {
    logger.error('[RBAC] Update role error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json<ApiResponse>(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update role' },
      { status: 500 },
    );
  }
}

// =============================================================================
// DELETE /api/organizations/[id]/members/[userId]/permissions - Demote to member role
// =============================================================================

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id: organizationId, userId } = await params;

  // Check if user is an owner
  const membership = await db.query.members.findFirst({
    where: and(eq(members.userId, session.user.id), eq(members.organizationId, organizationId)),
  });

  if (!membership || membership.role !== 'owner') {
    return NextResponse.json<ApiResponse>({ success: false, error: 'Only owners can modify roles' }, { status: 403 });
  }

  try {
    // Get the member to update
    const targetMember = await db.query.members.findFirst({
      where: and(eq(members.userId, userId), eq(members.organizationId, organizationId)),
    });

    if (!targetMember) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'User is not a member of this organization' },
        { status: 404 },
      );
    }

    // Demote to member role using Better Auth
    await auth.api.updateMemberRole({
      body: {
        memberId: targetMember.id,
        role: 'member',
        organizationId,
      },
      headers: await headers(),
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { message: 'User demoted to member role' },
    });
  } catch (error) {
    logger.error('[RBAC] Demote role error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json<ApiResponse>(
      { success: false, error: error instanceof Error ? error.message : 'Failed to demote role' },
      { status: 500 },
    );
  }
}
