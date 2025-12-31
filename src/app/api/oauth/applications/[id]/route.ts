import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { oauthApplications } from "@/lib/db/schema";

// =============================================================================
// GET /api/oauth/applications/[id] - Get a specific OAuth application
// =============================================================================

export async function GET(
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

    const app = await db.query.oauthApplications?.findFirst({
      where: and(
        eq(oauthApplications.id, id),
        eq(oauthApplications.userId, session.user.id)
      ),
    });

    if (!app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    // Don't return the secret
    return NextResponse.json({
      id: app.id,
      name: app.name,
      icon: app.icon,
      clientId: app.clientId,
      redirectURLs: app.redirectURLs,
      type: app.type,
      disabled: app.disabled,
      createdAt: app.createdAt,
    });
  } catch (error) {
    console.error("Error fetching OAuth application:", error);
    return NextResponse.json({ error: "Failed to fetch application" }, { status: 500 });
  }
}

// =============================================================================
// PATCH /api/oauth/applications/[id] - Update an OAuth application
// =============================================================================

export async function PATCH(
  request: NextRequest,
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
      .from(oauthApplications)
      .where(
        and(
          eq(oauthApplications.id, id),
          eq(oauthApplications.userId, session.user.id)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, icon, redirectURLs, disabled } = body;

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name;
    if (icon !== undefined) updateData.icon = icon;
    if (redirectURLs !== undefined) {
      updateData.redirectURLs = Array.isArray(redirectURLs)
        ? redirectURLs.join("\n")
        : redirectURLs;
    }
    if (disabled !== undefined) updateData.disabled = disabled;

    await db
      .update(oauthApplications)
      .set(updateData)
      .where(eq(oauthApplications.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating OAuth application:", error);
    return NextResponse.json({ error: "Failed to update application" }, { status: 500 });
  }
}

// =============================================================================
// DELETE /api/oauth/applications/[id] - Delete an OAuth application
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
      .from(oauthApplications)
      .where(
        and(
          eq(oauthApplications.id, id),
          eq(oauthApplications.userId, session.user.id)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    await db.delete(oauthApplications).where(eq(oauthApplications.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting OAuth application:", error);
    return NextResponse.json({ error: "Failed to delete application" }, { status: 500 });
  }
}
