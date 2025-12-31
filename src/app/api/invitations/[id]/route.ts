import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invitations, organizations, users } from "@/lib/db/schema";
import type { ApiResponse } from "@/lib/types";

// =============================================================================
// GET /api/invitations/[id] - Get invitation details
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Fetch invitation with organization and inviter details
    const invitation = await db
      .select({
        id: invitations.id,
        email: invitations.email,
        role: invitations.role,
        status: invitations.status,
        expiresAt: invitations.expiresAt,
        organizationId: invitations.organizationId,
        inviterId: invitations.inviterId,
        organization: {
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          logo: organizations.logo,
        },
        inviter: {
          id: users.id,
          name: users.name,
          image: users.image,
        },
      })
      .from(invitations)
      .innerJoin(organizations, eq(invitations.organizationId, organizations.id))
      .innerJoin(users, eq(invitations.inviterId, users.id))
      .where(eq(invitations.id, id))
      .limit(1);

    if (!invitation[0]) {
      const response: ApiResponse = {
        success: false,
        error: "Invitation not found",
      };
      return NextResponse.json(response, { status: 404 });
    }

    const response: ApiResponse = {
      success: true,
      data: invitation[0],
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error("[GET /api/invitations/[id]]", error);
    const response: ApiResponse = {
      success: false,
      error: "Internal server error",
    };
    return NextResponse.json(response, { status: 500 });
  }
}
