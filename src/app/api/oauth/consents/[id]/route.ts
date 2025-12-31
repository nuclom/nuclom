import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { oauthAccessTokens, oauthConsents } from "@/lib/db/schema";

// =============================================================================
// DELETE /api/oauth/consents/[id] - Revoke access for an OAuth application
// =============================================================================

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check ownership
    const existing = await db
      .select()
      .from(oauthConsents)
      .where(
        and(
          eq(oauthConsents.id, id),
          eq(oauthConsents.userId, session.user.id)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: "Consent not found" }, { status: 404 });
    }

    const consent = existing[0];

    // Delete associated access tokens
    if (consent.clientId) {
      await db
        .delete(oauthAccessTokens)
        .where(
          and(
            eq(oauthAccessTokens.clientId, consent.clientId),
            eq(oauthAccessTokens.userId, session.user.id)
          )
        );
    }

    // Delete the consent
    await db.delete(oauthConsents).where(eq(oauthConsents.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error revoking OAuth consent:", error);
    return NextResponse.json({ error: "Failed to revoke access" }, { status: 500 });
  }
}
