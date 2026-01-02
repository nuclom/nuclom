import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { connection, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { oauthConsents } from "@/lib/db/schema";

// =============================================================================
// GET /api/oauth/consents - List user's authorized OAuth applications
// =============================================================================

export async function GET() {
  await connection();

  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const consents = await db
      .select({
        id: oauthConsents.id,
        clientId: oauthConsents.clientId,
        scopes: oauthConsents.scopes,
        createdAt: oauthConsents.createdAt,
        consentGiven: oauthConsents.consentGiven,
      })
      .from(oauthConsents)
      .where(eq(oauthConsents.userId, session.user.id));

    return NextResponse.json(consents);
  } catch (error) {
    console.error("Error fetching OAuth consents:", error);
    return NextResponse.json({ error: "Failed to fetch authorized applications" }, { status: 500 });
  }
}
