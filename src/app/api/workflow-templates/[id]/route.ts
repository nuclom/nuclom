import { eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workflowTemplates } from "@/lib/db/schema";

// =============================================================================
// GET /api/workflow-templates/[id] - Get a specific template
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const [template] = await db.select().from(workflowTemplates).where(eq(workflowTemplates.id, id));

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error("Get template error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// =============================================================================
// PATCH /api/workflow-templates/[id] - Update a template
// =============================================================================

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if template exists and user has permission
    const [existing] = await db.select().from(workflowTemplates).where(eq(workflowTemplates.id, id));

    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Can't edit system templates
    if (existing.isSystem) {
      return NextResponse.json({ error: "Cannot edit system templates" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, type, icon, config, isActive } = body;

    const [template] = await db
      .update(workflowTemplates)
      .set({
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(type !== undefined && { type }),
        ...(icon !== undefined && { icon }),
        ...(config !== undefined && { config }),
        ...(isActive !== undefined && { isActive }),
        updatedAt: new Date(),
      })
      .where(eq(workflowTemplates.id, id))
      .returning();

    return NextResponse.json({ template });
  } catch (error) {
    console.error("Update template error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// =============================================================================
// DELETE /api/workflow-templates/[id] - Delete a template
// =============================================================================

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if template exists and user has permission
    const [existing] = await db.select().from(workflowTemplates).where(eq(workflowTemplates.id, id));

    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Can't delete system templates
    if (existing.isSystem) {
      return NextResponse.json({ error: "Cannot delete system templates" }, { status: 403 });
    }

    await db.delete(workflowTemplates).where(eq(workflowTemplates.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete template error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// =============================================================================
// POST /api/workflow-templates/[id] - Apply template (increment usage)
// =============================================================================

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Increment usage count
    const [template] = await db
      .update(workflowTemplates)
      .set({
        usageCount: sql`${workflowTemplates.usageCount} + 1`,
      })
      .where(eq(workflowTemplates.id, id))
      .returning();

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      template,
      message: "Template applied successfully",
    });
  } catch (error) {
    console.error("Apply template error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
