import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { members, users, organizations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";
import { inviteMember, updateMemberRole, removeMember } from "@/lib/api/organizations";
import { requirePermission } from "@/lib/permissions";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: organizationId } = await params;

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session.user.id, organizationId, "members:read");

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

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: organizationId } = await params;

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { email, role } = body;

    if (!email || !role) {
      return NextResponse.json({ error: "Email and role are required" }, { status: 400 });
    }

    await requirePermission(session.user.id, organizationId, "members:invite");

    const invitation = await inviteMember({
      organizationId,
      email,
      role,
      inviterId: session.user.id,
    });

    return NextResponse.json(invitation);
  } catch (error) {
    console.error("Error inviting member:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: organizationId } = await params;

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { memberId, role } = body;

    if (!memberId || !role) {
      return NextResponse.json({ error: "Member ID and role are required" }, { status: 400 });
    }

    await requirePermission(session.user.id, organizationId, "members:manage");

    const member = await updateMemberRole(memberId, role);

    return NextResponse.json(member);
  } catch (error) {
    console.error("Error updating member role:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: organizationId } = await params;

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("memberId");

    if (!memberId) {
      return NextResponse.json({ error: "Member ID is required" }, { status: 400 });
    }

    await requirePermission(session.user.id, organizationId, "members:remove");

    await removeMember(memberId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing member:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
