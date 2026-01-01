import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { RBACService } from "@/lib/rbac";
import type { ApiResponse } from "@/lib/types";

// =============================================================================
// GET /api/organizations/[id]/members/[userId]/permissions - Get user permissions
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: organizationId, userId } = await params;

  // Check if requesting user is a member
  const membership = await db.query.members.findFirst({
    where: and(eq(members.userId, session.user.id), eq(members.organizationId, organizationId)),
  });

  if (!membership) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Not a member of this organization" },
      { status: 403 },
    );
  }

  // Only owners/admins can view other users' permissions, or user can view their own
  if (session.user.id !== userId && membership.role !== "owner") {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "You can only view your own permissions" },
      { status: 403 },
    );
  }

  try {
    const permissions = await RBACService.getUserPermissions(userId, organizationId);
    const roles = await RBACService.getUserRoles(userId, organizationId);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        userId,
        roles: roles.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          color: r.color,
          isSystemRole: r.isSystemRole,
        })),
        permissions: permissions.map((p) => ({
          resource: p.resource,
          action: p.action,
          conditions: p.conditions,
        })),
      },
    });
  } catch (error) {
    console.error("[RBAC] Get permissions error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: error instanceof Error ? error.message : "Failed to get permissions" },
      { status: 500 },
    );
  }
}

// =============================================================================
// POST /api/organizations/[id]/members/[userId]/permissions - Assign role to user
// =============================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: organizationId, userId } = await params;

  // Check if user is an owner
  const membership = await db.query.members.findFirst({
    where: and(eq(members.userId, session.user.id), eq(members.organizationId, organizationId)),
  });

  if (!membership || membership.role !== "owner") {
    return NextResponse.json<ApiResponse>({ success: false, error: "Only owners can assign roles" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { roleId } = body;

    if (!roleId) {
      return NextResponse.json<ApiResponse>({ success: false, error: "roleId is required" }, { status: 400 });
    }

    await RBACService.assignRole(userId, organizationId, roleId, session.user.id);

    const roles = await RBACService.getUserRoles(userId, organizationId);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        message: "Role assigned successfully",
        roles: roles.map((r) => ({
          id: r.id,
          name: r.name,
        })),
      },
    });
  } catch (error) {
    console.error("[RBAC] Assign role error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: error instanceof Error ? error.message : "Failed to assign role" },
      { status: 500 },
    );
  }
}

// =============================================================================
// DELETE /api/organizations/[id]/members/[userId]/permissions - Remove role from user
// =============================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: organizationId, userId } = await params;

  // Check if user is an owner
  const membership = await db.query.members.findFirst({
    where: and(eq(members.userId, session.user.id), eq(members.organizationId, organizationId)),
  });

  if (!membership || membership.role !== "owner") {
    return NextResponse.json<ApiResponse>({ success: false, error: "Only owners can remove roles" }, { status: 403 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const roleId = searchParams.get("roleId");

    if (!roleId) {
      return NextResponse.json<ApiResponse>({ success: false, error: "roleId is required" }, { status: 400 });
    }

    await RBACService.removeRole(userId, organizationId, roleId, session.user.id);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { message: "Role removed successfully" },
    });
  } catch (error) {
    console.error("[RBAC] Remove role error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: error instanceof Error ? error.message : "Failed to remove role" },
      { status: 500 },
    );
  }
}
