import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AuditLogger } from "@/lib/audit-log";
import { db } from "@/lib/db";
import { members } from "@/lib/db/schema";
import type { ApiResponse } from "@/lib/types";
import { and, eq } from "drizzle-orm";

// =============================================================================
// GET /api/organizations/[id]/audit-logs/exports/[exportId] - Get export status
// =============================================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; exportId: string }> },
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: organizationId, exportId } = await params;

  // Check if user is a member
  const membership = await db.query.members.findFirst({
    where: and(eq(members.userId, session.user.id), eq(members.organizationId, organizationId)),
  });

  if (!membership) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Not a member of this organization" }, { status: 403 });
  }

  try {
    const exportStatus = await AuditLogger.getExportStatus(exportId);

    if (!exportStatus) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Export not found" }, { status: 404 });
    }

    // Verify the export belongs to this organization
    if (exportStatus.organizationId !== organizationId) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Export not found" }, { status: 404 });
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        id: exportStatus.id,
        format: exportStatus.format,
        status: exportStatus.status,
        recordCount: exportStatus.recordCount,
        downloadUrl: exportStatus.status === "completed" ? exportStatus.downloadUrl : null,
        expiresAt: exportStatus.expiresAt,
        errorMessage: exportStatus.errorMessage,
        createdAt: exportStatus.createdAt,
        completedAt: exportStatus.completedAt,
      },
    });
  } catch (error) {
    console.error("[Audit] Export status error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: error instanceof Error ? error.message : "Failed to get export status" },
      { status: 500 },
    );
  }
}
