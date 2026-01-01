import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { customRoles, members, type PermissionAction, type PermissionResource } from "@/lib/db/schema";
import { RBACService } from "@/lib/rbac";
import type { ApiResponse } from "@/lib/types";

// =============================================================================
// GET /api/organizations/[id]/roles/[roleId] - Get role details
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string; roleId: string }> }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: organizationId, roleId } = await params;

  // Check if user is a member
  const membership = await db.query.members.findFirst({
    where: and(eq(members.userId, session.user.id), eq(members.organizationId, organizationId)),
  });

  if (!membership) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Not a member of this organization" },
      { status: 403 },
    );
  }

  try {
    const role = await db.query.customRoles.findFirst({
      where: and(eq(customRoles.id, roleId), eq(customRoles.organizationId, organizationId)),
      with: {
        permissions: true,
      },
    });

    if (!role) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Role not found" }, { status: 404 });
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: role,
    });
  } catch (error) {
    console.error("[RBAC] Get role error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: error instanceof Error ? error.message : "Failed to get role" },
      { status: 500 },
    );
  }
}

// =============================================================================
// PATCH /api/organizations/[id]/roles/[roleId] - Update role
// =============================================================================

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; roleId: string }> }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: organizationId, roleId } = await params;

  // Check if user is an owner
  const membership = await db.query.members.findFirst({
    where: and(eq(members.userId, session.user.id), eq(members.organizationId, organizationId)),
  });

  if (!membership || membership.role !== "owner") {
    return NextResponse.json<ApiResponse>({ success: false, error: "Only owners can update roles" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, description, color, isDefault, permissions } = body;

    // Update role metadata
    if (name !== undefined || description !== undefined || color !== undefined || isDefault !== undefined) {
      const updateData: Parameters<typeof RBACService.updateRole>[1] = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (color !== undefined) updateData.color = color;
      if (isDefault !== undefined) updateData.isDefault = isDefault;

      const updatedRole = await RBACService.updateRole(roleId, updateData, session.user.id);

      if (!updatedRole) {
        return NextResponse.json<ApiResponse>({ success: false, error: "Role not found" }, { status: 404 });
      }
    }

    // Update permissions if provided
    if (permissions !== undefined) {
      if (!Array.isArray(permissions)) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: "Permissions must be an array" },
          { status: 400 },
        );
      }

      await RBACService.updateRolePermissions(
        roleId,
        permissions as Array<{ resource: PermissionResource; action: PermissionAction; conditions?: unknown }>,
        session.user.id,
      );
    }

    // Get updated role
    const role = await db.query.customRoles.findFirst({
      where: eq(customRoles.id, roleId),
      with: {
        permissions: true,
      },
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: role,
    });
  } catch (error) {
    console.error("[RBAC] Update role error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: error instanceof Error ? error.message : "Failed to update role" },
      { status: 500 },
    );
  }
}

// =============================================================================
// DELETE /api/organizations/[id]/roles/[roleId] - Delete role
// =============================================================================

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; roleId: string }> }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: organizationId, roleId } = await params;

  // Check if user is an owner
  const membership = await db.query.members.findFirst({
    where: and(eq(members.userId, session.user.id), eq(members.organizationId, organizationId)),
  });

  if (!membership || membership.role !== "owner") {
    return NextResponse.json<ApiResponse>({ success: false, error: "Only owners can delete roles" }, { status: 403 });
  }

  try {
    const deleted = await RBACService.deleteRole(roleId, session.user.id);

    if (!deleted) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Role not found" }, { status: 404 });
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { message: "Role deleted successfully" },
    });
  } catch (error) {
    console.error("[RBAC] Delete role error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: error instanceof Error ? error.message : "Failed to delete role" },
      { status: 500 },
    );
  }
}
