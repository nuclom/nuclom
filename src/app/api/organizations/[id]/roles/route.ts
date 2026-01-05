import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { members } from "@/lib/db/schema";
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
    // Use Better Auth's dynamic role listing
    const roles = await auth.api.listOrgRoles({
      query: { organizationId },
      headers: await headers(),
    });

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

  // Check if user is an owner
  const membership = await db.query.members.findFirst({
    where: and(eq(members.userId, session.user.id), eq(members.organizationId, organizationId)),
  });

  if (!membership || membership.role !== "owner") {
    return NextResponse.json<ApiResponse>({ success: false, error: "Only owners can create roles" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, permissions } = body;

    if (!name) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Role name is required" }, { status: 400 });
    }

    // Use Better Auth's dynamic role creation
    const role = await auth.api.createOrgRole({
      body: {
        role: name,
        permission: permissions,
        organizationId,
      },
      headers: await headers(),
    });

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
