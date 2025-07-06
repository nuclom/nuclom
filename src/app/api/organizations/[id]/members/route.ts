import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { members, organizations, users, invitations } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";

const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["owner", "member"]).default("member"),
});

const updateMemberSchema = z.object({
  role: z.enum(["owner", "member"]),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is member of organization
    const memberCheck = await db
      .select()
      .from(members)
      .where(and(eq(members.organizationId, id), eq(members.userId, session.user.id)))
      .limit(1);

    if (memberCheck.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get organization members with user details
    const organizationMembers = await db
      .select({
        id: members.id,
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
      .where(eq(members.organizationId, id))
      .orderBy(desc(members.createdAt));

    return NextResponse.json({
      success: true,
      data: organizationMembers,
    });
  } catch (error) {
    console.error("Error fetching organization members:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is owner of organization
    const ownerCheck = await db
      .select()
      .from(members)
      .where(and(eq(members.organizationId, id), eq(members.userId, session.user.id), eq(members.role, "owner")))
      .limit(1);

    if (ownerCheck.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = addMemberSchema.parse(body);

    // Check if user exists
    const existingUser = await db.select().from(users).where(eq(users.email, validatedData.email)).limit(1);

    if (existingUser.length === 0) {
      // Create invitation for non-existing user
      const [invitation] = await db
        .insert(invitations)
        .values({
          id: crypto.randomUUID(),
          organizationId: id,
          email: validatedData.email,
          role: validatedData.role,
          status: "pending",
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          inviterId: session.user.id,
        })
        .returning();

      return NextResponse.json({
        success: true,
        type: "invitation",
        data: invitation,
      });
    }

    // Check if user is already a member
    const existingMember = await db
      .select()
      .from(members)
      .where(and(eq(members.organizationId, id), eq(members.userId, existingUser[0].id)))
      .limit(1);

    if (existingMember.length > 0) {
      return NextResponse.json({ error: "User is already a member" }, { status: 400 });
    }

    // Add user as member
    const [newMember] = await db
      .insert(members)
      .values({
        id: crypto.randomUUID(),
        organizationId: id,
        userId: existingUser[0].id,
        role: validatedData.role,
        createdAt: new Date(),
      })
      .returning();

    // Get member with user details
    const memberWithUser = await db
      .select({
        id: members.id,
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
      .where(eq(members.id, newMember.id))
      .limit(1);

    return NextResponse.json({
      success: true,
      type: "member",
      data: memberWithUser[0],
    });
  } catch (error) {
    console.error("Error adding member:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.errors }, { status: 400 });
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const memberId = url.searchParams.get("memberId");

    if (!memberId) {
      return NextResponse.json({ error: "Member ID required" }, { status: 400 });
    }

    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is owner of organization
    const ownerCheck = await db
      .select()
      .from(members)
      .where(and(eq(members.organizationId, id), eq(members.userId, session.user.id), eq(members.role, "owner")))
      .limit(1);

    if (ownerCheck.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = updateMemberSchema.parse(body);

    // Update member role
    const [updatedMember] = await db
      .update(members)
      .set({ role: validatedData.role })
      .where(and(eq(members.id, memberId), eq(members.organizationId, id)))
      .returning();

    if (!updatedMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Get updated member with user details
    const memberWithUser = await db
      .select({
        id: members.id,
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
      .where(eq(members.id, updatedMember.id))
      .limit(1);

    return NextResponse.json({
      success: true,
      data: memberWithUser[0],
    });
  } catch (error) {
    console.error("Error updating member:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.errors }, { status: 400 });
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const memberId = url.searchParams.get("memberId");

    if (!memberId) {
      return NextResponse.json({ error: "Member ID required" }, { status: 400 });
    }

    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is owner of organization or removing themselves
    const memberToRemove = await db
      .select()
      .from(members)
      .where(and(eq(members.id, memberId), eq(members.organizationId, id)))
      .limit(1);

    if (memberToRemove.length === 0) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const isOwner = await db
      .select()
      .from(members)
      .where(and(eq(members.organizationId, id), eq(members.userId, session.user.id), eq(members.role, "owner")))
      .limit(1);

    const isRemovingSelf = memberToRemove[0].userId === session.user.id;

    if (isOwner.length === 0 && !isRemovingSelf) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Cannot remove the last owner
    if (memberToRemove[0].role === "owner") {
      const ownerCount = await db
        .select({ count: eq(members.role, "owner") })
        .from(members)
        .where(eq(members.organizationId, id));

      if (ownerCount.length === 1) {
        return NextResponse.json({ error: "Cannot remove the last owner" }, { status: 400 });
      }
    }

    // Remove member
    await db.delete(members).where(eq(members.id, memberId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing member:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
