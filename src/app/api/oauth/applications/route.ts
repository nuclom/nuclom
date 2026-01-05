import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { oauthApplications } from "@/lib/db/schema";

// Helper to generate client ID and secret
function generateClientId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "nc_";
  for (let i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateClientSecret(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 48; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// =============================================================================
// GET /api/oauth/applications - List user's OAuth applications
// =============================================================================

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apps = await db
      .select({
        id: oauthApplications.id,
        name: oauthApplications.name,
        icon: oauthApplications.icon,
        clientId: oauthApplications.clientId,
        redirectUrls: oauthApplications.redirectUrls,
        type: oauthApplications.type,
        disabled: oauthApplications.disabled,
        createdAt: oauthApplications.createdAt,
      })
      .from(oauthApplications)
      .where(eq(oauthApplications.userId, session.user.id));

    return NextResponse.json(apps);
  } catch (error) {
    console.error("Error fetching OAuth applications:", error);
    return NextResponse.json({ error: "Failed to fetch applications" }, { status: 500 });
  }
}

// =============================================================================
// POST /api/oauth/applications - Create a new OAuth application
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, icon, redirectUrls } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Application name is required" }, { status: 400 });
    }

    const clientId = generateClientId();
    const clientSecret = generateClientSecret();

    const id = crypto.randomUUID();
    const now = new Date();

    await db.insert(oauthApplications).values({
      id,
      name,
      icon: icon || null,
      clientId,
      clientSecret, // Store hashed in production
      redirectUrls: Array.isArray(redirectUrls) ? redirectUrls.join("\n") : redirectUrls || "",
      type: "confidential",
      disabled: false,
      userId: session.user.id,
      createdAt: now,
      updatedAt: now,
    });

    // Return the newly created app with the secret (only shown once)
    return NextResponse.json({
      id,
      name,
      icon,
      clientId,
      clientSecret, // Only returned on creation
      redirectUrls: Array.isArray(redirectUrls) ? redirectUrls.join("\n") : redirectUrls || "",
      createdAt: now,
    });
  } catch (error) {
    console.error("Error creating OAuth application:", error);
    return NextResponse.json({ error: "Failed to create application" }, { status: 500 });
  }
}
