import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { members, users, organizations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
