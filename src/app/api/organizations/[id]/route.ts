import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { organizations, members } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(50).optional(),
  logo: z.string().url().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
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

    // Get organization details
    const organization = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);

    if (organization.length === 0) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    return NextResponse.json(organization[0]);
  } catch (error) {
    console.error("Error fetching organization:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const validatedData = updateOrganizationSchema.parse(body);

    // Update organization
    const [updatedOrganization] = await db
      .update(organizations)
      .set({
        ...validatedData,
      })
      .where(eq(organizations.id, id))
      .returning();

    return NextResponse.json(updatedOrganization);
  } catch (error) {
    console.error("Error updating organization:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.errors }, { status: 400 });
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    // Delete organization (cascade will handle related data)
    await db.delete(organizations).where(eq(organizations.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting organization:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
