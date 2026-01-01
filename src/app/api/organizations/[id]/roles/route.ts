import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { members, type PermissionAction, type PermissionResource } from "@/lib/db/schema";
import { RBACService } from "@/lib/rbac";
import type { ApiResponse } from "@/lib/types";

// =============================================================================
// GET /api/organizations/[id]/roles - Get all roles
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: organizationId } = await params;

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
    const roles = await RBACService.getOrganizationRoles(organizationId);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: roles,
    });
  } catch (error) {
    console.error("[RBAC] Get roles error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: error instanceof Error ? error.message : "Failed to get roles" },
      { status: 500 },
    );
  }
}

// =============================================================================
// POST /api/organizations/[id]/roles - Create a custom role
// =============================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: organizationId } = await params;

  // Check if user is an owner or admin
  const membership = await db.query.members.findFirst({
    where: and(eq(members.userId, session.user.id), eq(members.organizationId, organizationId)),
  });

  if (!membership || membership.role !== "owner") {
    return NextResponse.json<ApiResponse>({ success: false, error: "Only owners can create roles" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, description, color, isDefault, permissions } = body;

    if (!name) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Role name is required" }, { status: 400 });
    }

    if (!permissions || !Array.isArray(permissions)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Permissions array is required" },
        { status: 400 },
      );
    }

    // Validate permissions format
    for (const perm of permissions) {
      if (!perm.resource || !perm.action) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: "Each permission must have resource and action" },
          { status: 400 },
        );
      }
    }

    const role = await RBACService.createRole(
      organizationId,
      { name, description, color, isDefault },
      permissions as Array<{ resource: PermissionResource; action: PermissionAction; conditions?: unknown }>,
      session.user.id,
    );

    return NextResponse.json<ApiResponse>({
      success: true,
      data: role,
    });
  } catch (error) {
    console.error("[RBAC] Create role error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: error instanceof Error ? error.message : "Failed to create role" },
      { status: 500 },
    );
  }
}
