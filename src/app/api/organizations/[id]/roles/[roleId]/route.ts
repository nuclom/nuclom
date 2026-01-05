import { and, eq } from "drizzle-orm";
import { Schema } from "effect";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { members } from "@/lib/db/schema";
import type { ApiResponse } from "@/lib/types";
import { safeParse } from "@/lib/validation";

// Schema for updating role permissions
const UpdateRolePermissionsSchema = Schema.Struct({
  permissions: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Array(Schema.String) })),
});

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
    // Use Better Auth's role retrieval
    const role = await auth.api.getOrgRole({
      query: { roleId, organizationId },
      headers: await headers(),
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
    const rawBody = await request.json();
    const result = safeParse(UpdateRolePermissionsSchema, rawBody);
    if (!result.success) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Invalid request format" }, { status: 400 });
    }
    const { permissions } = result.data;

    // Use Better Auth's role update
    // Convert readonly record to mutable
    const mutablePermissions = permissions
      ? Object.fromEntries(Object.entries(permissions).map(([k, v]) => [k, [...v]]))
      : undefined;

    const updatedRole = await auth.api.updateOrgRole({
      body: {
        roleId,
        organizationId,
        data: {
          permission: mutablePermissions,
        },
      },
      headers: await headers(),
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: updatedRole,
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
    // Use Better Auth's role deletion
    await auth.api.deleteOrgRole({
      body: {
        roleId,
        organizationId,
      },
      headers: await headers(),
    });

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
