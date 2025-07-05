import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invitations, organizations, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: invitationId } = await params;

    const invitation = await db
      .select({
        id: invitations.id,
        email: invitations.email,
        role: invitations.role,
        status: invitations.status,
        expiresAt: invitations.expiresAt,
        organization: {
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
        },
        inviter: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(invitations)
      .innerJoin(organizations, eq(invitations.organizationId, organizations.id))
      .innerJoin(users, eq(invitations.inviterId, users.id))
      .where(eq(invitations.id, invitationId))
      .limit(1);

    if (invitation.length === 0) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    const inv = invitation[0];

    if (inv.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invitation has expired" }, { status: 410 });
    }

    if (inv.status !== "pending") {
      return NextResponse.json({ error: "Invitation is no longer valid" }, { status: 410 });
    }

    return NextResponse.json(inv);
  } catch (error) {
    console.error("Error fetching invitation:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
