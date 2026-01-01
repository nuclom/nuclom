import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { members, type StorageRegion } from "@/lib/db/schema";
import { MultiRegionStorageService } from "@/lib/multi-region-storage";
import type { ApiResponse } from "@/lib/types";
import { and, eq } from "drizzle-orm";

// =============================================================================
// GET /api/organizations/[id]/storage - Get storage configuration
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: organizationId } = await params;

  // Check if user is an owner or admin
  const membership = await db.query.members.findFirst({
    where: and(eq(members.userId, session.user.id), eq(members.organizationId, organizationId)),
  });

  if (!membership || membership.role !== "owner") {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Only owners can view storage settings" },
      { status: 403 },
    );
  }

  try {
    const config = await MultiRegionStorageService.getConfig(organizationId);
    const stats = await MultiRegionStorageService.getStorageStats(organizationId);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        config: config || {
          primaryRegion: "auto",
          replicationRegions: [],
          dataResidency: null,
          retentionDays: 30,
        },
        stats,
        availableRegions: [
          { id: "auto", name: "Auto (Optimized)", description: "Automatically choose the best region" },
          { id: "us-east-1", name: "US East (N. Virginia)", residency: "US" },
          { id: "us-west-2", name: "US West (Oregon)", residency: "US" },
          { id: "eu-west-1", name: "EU (Ireland)", residency: "EU" },
          { id: "eu-central-1", name: "EU (Frankfurt)", residency: "EU" },
          { id: "ap-southeast-1", name: "Asia Pacific (Singapore)", residency: "APAC" },
          { id: "ap-northeast-1", name: "Asia Pacific (Tokyo)", residency: "APAC" },
        ],
        dataResidencyOptions: [
          { id: "US", name: "United States", regions: ["us-east-1", "us-west-2"] },
          { id: "EU", name: "European Union", regions: ["eu-west-1", "eu-central-1"] },
          { id: "APAC", name: "Asia Pacific", regions: ["ap-southeast-1", "ap-northeast-1"] },
        ],
      },
    });
  } catch (error) {
    console.error("[Storage] Get config error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: error instanceof Error ? error.message : "Failed to get storage config" },
      { status: 500 },
    );
  }
}

// =============================================================================
// PUT /api/organizations/[id]/storage - Update storage configuration
// =============================================================================

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: organizationId } = await params;

  // Check if user is an owner
  const membership = await db.query.members.findFirst({
    where: and(eq(members.userId, session.user.id), eq(members.organizationId, organizationId)),
  });

  if (!membership || membership.role !== "owner") {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Only owners can update storage settings" },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const { primaryRegion, replicationRegions, dataResidency, retentionDays } = body;

    // Validate data residency compliance
    if (dataResidency) {
      const regionsToCheck = [primaryRegion, ...(replicationRegions || [])].filter(
        (r): r is StorageRegion => r !== undefined && r !== "auto",
      );

      if (regionsToCheck.length > 0) {
        const validation = MultiRegionStorageService.validateDataResidency(dataResidency, regionsToCheck);
        if (!validation.valid) {
          return NextResponse.json<ApiResponse>(
            { success: false, error: validation.violations.join("; ") },
            { status: 400 },
          );
        }
      }
    }

    const config = await MultiRegionStorageService.configure(
      organizationId,
      {
        primaryRegion,
        replicationRegions,
        dataResidency,
        retentionDays,
      },
      session.user.id,
    );

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        config,
        message: "Storage configuration updated successfully",
      },
    });
  } catch (error) {
    console.error("[Storage] Update config error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: error instanceof Error ? error.message : "Failed to update storage config" },
      { status: 500 },
    );
  }
}
