import { and, count, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ReportCategory, ReportResourceType, ReportStatus } from "@/lib/db/schema";
import { reports, users } from "@/lib/db/schema";

// Validation schema for creating a report
const createReportSchema = z.object({
  resourceType: z.enum(["video", "comment", "user"]),
  resourceId: z.string().min(1),
  category: z.enum(["inappropriate", "spam", "copyright", "harassment", "other"]),
  description: z.string().max(2000).optional(),
});

// Validation schema for updating a report (admin only)
const updateReportSchema = z.object({
  status: z.enum(["pending", "reviewing", "resolved", "dismissed"]).optional(),
  resolution: z.enum(["content_removed", "user_warned", "user_suspended", "no_action"]).optional(),
  resolutionNotes: z.string().max(2000).optional(),
});

// GET /api/reports - List reports (admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const [userData] = await db.select({ role: users.role }).from(users).where(eq(users.id, session.user.id)).limit(1);

    if (userData?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    // Parse query params for filtering
    const url = new URL(request.url);
    const status = url.searchParams.get("status") as ReportStatus | null;
    const category = url.searchParams.get("category") as ReportCategory | null;
    const resourceType = url.searchParams.get("resourceType") as ReportResourceType | null;
    const page = Number.parseInt(url.searchParams.get("page") || "1", 10);
    const limit = Math.min(Number.parseInt(url.searchParams.get("limit") || "20", 10), 100);
    const offset = (page - 1) * limit;

    // Build filter conditions
    const conditions = [];
    if (status) {
      conditions.push(eq(reports.status, status));
    }
    if (category) {
      conditions.push(eq(reports.category, category));
    }
    if (resourceType) {
      conditions.push(eq(reports.resourceType, resourceType));
    }

    // Fetch reports with reporter info
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [reportsList, totalCount] = await Promise.all([
      db
        .select({
          report: reports,
          reporter: {
            id: users.id,
            name: users.name,
            email: users.email,
            image: users.image,
          },
        })
        .from(reports)
        .leftJoin(users, eq(reports.reporterId, users.id))
        .where(whereClause)
        .orderBy(desc(reports.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(reports).where(whereClause),
    ]);

    return NextResponse.json({
      reports: reportsList.map((r) => ({
        ...r.report,
        reporter: r.reporter,
      })),
      pagination: {
        page,
        limit,
        total: totalCount[0]?.count ?? 0,
        totalPages: Math.ceil((totalCount[0]?.count ?? 0) / limit),
      },
    });
  } catch (error) {
    console.error("Get reports error:", error);
    return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
  }
}

// POST /api/reports - Create a new report
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validationResult = createReportSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({ error: "Invalid request", details: validationResult.error.issues }, { status: 400 });
    }

    const { resourceType, resourceId, category, description } = validationResult.data;

    // Check for duplicate reports from the same user for the same resource
    const existingReport = await db
      .select()
      .from(reports)
      .where(
        and(
          eq(reports.reporterId, session.user.id),
          eq(reports.resourceType, resourceType),
          eq(reports.resourceId, resourceId),
          eq(reports.status, "pending"),
        ),
      )
      .limit(1);

    if (existingReport.length > 0) {
      return NextResponse.json({ error: "You have already reported this content" }, { status: 409 });
    }

    // Create the report
    const [newReport] = await db
      .insert(reports)
      .values({
        reporterId: session.user.id,
        resourceType,
        resourceId,
        category,
        description,
        status: "pending",
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        message: "Thank you for your report. Our team will review it shortly.",
        reportId: newReport.id,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create report error:", error);
    return NextResponse.json({ error: "Failed to create report" }, { status: 500 });
  }
}

// PATCH /api/reports - Update a report (admin only)
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const [userData] = await db.select({ role: users.role }).from(users).where(eq(users.id, session.user.id)).limit(1);

    if (userData?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { reportId, ...updateData } = body;

    if (!reportId) {
      return NextResponse.json({ error: "Report ID is required" }, { status: 400 });
    }

    const validationResult = updateReportSchema.safeParse(updateData);

    if (!validationResult.success) {
      return NextResponse.json({ error: "Invalid request", details: validationResult.error.issues }, { status: 400 });
    }

    const { status, resolution, resolutionNotes } = validationResult.data;

    // Build update object
    const updateObj: Record<string, unknown> = {};
    if (status) {
      updateObj.status = status;
    }
    if (resolution) {
      updateObj.resolution = resolution;
    }
    if (resolutionNotes !== undefined) {
      updateObj.resolutionNotes = resolutionNotes;
    }

    // If status is resolved or dismissed, add resolution info
    if (status === "resolved" || status === "dismissed") {
      updateObj.resolvedById = session.user.id;
      updateObj.resolvedAt = new Date();
    }

    // Update the report
    const [updatedReport] = await db.update(reports).set(updateObj).where(eq(reports.id, reportId)).returning();

    if (!updatedReport) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      report: updatedReport,
    });
  } catch (error) {
    console.error("Update report error:", error);
    return NextResponse.json({ error: "Failed to update report" }, { status: 500 });
  }
}
