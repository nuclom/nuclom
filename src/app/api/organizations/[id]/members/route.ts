import { and, eq } from "drizzle-orm";
import { Effect, Schema } from "effect";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { createPublicLayer, handleEffectExit } from "@/lib/api-handler";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { members, users } from "@/lib/db/schema";
import { OrganizationRepository } from "@/lib/effect/services/organization-repository";
import { logger } from "@/lib/logger";
import { safeParse } from "@/lib/validation";

const UpdateMemberRoleSchema = Schema.Struct({
  userId: Schema.String,
  role: Schema.Literal("owner", "member"),
});

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
    logger.error("Failed to fetch organization members", error instanceof Error ? error : new Error(String(error)));
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

  return handleEffectExit(exit);
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
    const resolvedParams = yield* Effect.promise(() => params);
    const orgRepo = yield* OrganizationRepository;

    const updatedMember = yield* orgRepo.updateMemberRole(resolvedParams.id, userId, role, session.user.id);

    return { message: "Member role updated successfully", member: updatedMember };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
