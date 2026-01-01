import { and, eq } from "drizzle-orm";
import { Cause, Effect, Exit } from "effect";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { createPublicLayer, mapErrorToApiResponse } from "@/lib/api-handler";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { members, users } from "@/lib/db/schema";
import { OrganizationRepository } from "@/lib/effect/services/organization-repository";
import type { ApiResponse } from "@/lib/types";

// =============================================================================
// GET /api/organizations/[id]/members - Get organization members
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: organizationId } = await params;

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has access to this organization
    const userMembership = await db
      .select()
      .from(members)
      .where(and(eq(members.organizationId, organizationId), eq(members.userId, session.user.id)))
      .limit(1);

    if (userMembership.length === 0) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Get all members of the organization
    const organizationMembers = await db
      .select({
        id: members.id,
        organizationId: members.organizationId,
        userId: members.userId,
        role: members.role,
        createdAt: members.createdAt,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
        },
      })
      .from(members)
      .innerJoin(users, eq(members.userId, users.id))
      .where(eq(members.organizationId, organizationId));

    return NextResponse.json(organizationMembers);
  } catch (error) {
    console.error("Error fetching organization members:", error);
    return NextResponse.json({ error: "Failed to fetch organization members" }, { status: 500 });
  }
}

// =============================================================================
// DELETE /api/organizations/[id]/members - Remove a member
// =============================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const userIdToRemove = url.searchParams.get("userId");

  if (!userIdToRemove) {
    return NextResponse.json({ success: false, error: "userId query parameter is required" }, { status: 400 });
  }

  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const orgRepo = yield* OrganizationRepository;

    yield* orgRepo.removeMember(resolvedParams.id, userIdToRemove, session.user.id);

    return { message: "Member removed successfully" };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === "Some") {
        return mapErrorToApiResponse(error.value);
      }
      return mapErrorToApiResponse(new Error("Internal server error"));
    },
    onSuccess: (data) => {
      const response: ApiResponse = {
        success: true,
        data,
      };
      return NextResponse.json(response);
    },
  });
}

// =============================================================================
// PATCH /api/organizations/[id]/members - Update member role
// =============================================================================

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { userId, role } = body;

  if (!userId) {
    return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
  }

  if (!role || (role !== "owner" && role !== "member")) {
    return NextResponse.json({ success: false, error: "role must be 'owner' or 'member'" }, { status: 400 });
  }

  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const orgRepo = yield* OrganizationRepository;

    const updatedMember = yield* orgRepo.updateMemberRole(resolvedParams.id, userId, role, session.user.id);

    return { message: "Member role updated successfully", member: updatedMember };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === "Some") {
        return mapErrorToApiResponse(error.value);
      }
      return mapErrorToApiResponse(new Error("Internal server error"));
    },
    onSuccess: (data) => {
      const response: ApiResponse = {
        success: true,
        data,
      };
      return NextResponse.json(response);
    },
  });
}
