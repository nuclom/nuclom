import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { type OIDCConfig, type SAMLConfig, SSOService } from "@/lib/sso";
import type { ApiResponse } from "@/lib/types";

// =============================================================================
// GET /api/organizations/[id]/sso - Get SSO configuration
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
      { success: false, error: "Only owners can view SSO settings" },
      { status: 403 },
    );
  }

  const config = await SSOService.getConfig(organizationId);

  // Mask sensitive fields
  if (config) {
    const safeConfig = {
      ...config,
      clientSecret: config.clientSecret ? "••••••••" : null,
      certificate: config.certificate ? "[Certificate Configured]" : null,
    };

    return NextResponse.json<ApiResponse>({ success: true, data: safeConfig });
  }

  return NextResponse.json<ApiResponse>({ success: true, data: null });
}

// =============================================================================
// POST /api/organizations/[id]/sso - Configure SSO
// =============================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    return NextResponse.json<ApiResponse>({ success: false, error: "Only owners can configure SSO" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { providerType, config, options } = body;

    if (!providerType || !config) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "providerType and config are required" },
        { status: 400 },
      );
    }

    if (providerType !== "saml" && providerType !== "oidc") {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "providerType must be 'saml' or 'oidc'" },
        { status: 400 },
      );
    }

    const ssoConfig = await SSOService.configure(organizationId, providerType, config as SAMLConfig | OIDCConfig, {
      ...options,
      configuredBy: session.user.id,
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        id: ssoConfig.id,
        providerType: ssoConfig.providerType,
        enabled: ssoConfig.enabled,
        message: "SSO configured successfully. Test the configuration before enabling.",
      },
    });
  } catch (error) {
    console.error("[SSO] Configuration error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: error instanceof Error ? error.message : "Failed to configure SSO" },
      { status: 500 },
    );
  }
}

// =============================================================================
// PATCH /api/organizations/[id]/sso - Enable/disable SSO
// =============================================================================

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    return NextResponse.json<ApiResponse>({ success: false, error: "Only owners can modify SSO" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== "boolean") {
      return NextResponse.json<ApiResponse>({ success: false, error: "enabled must be a boolean" }, { status: 400 });
    }

    if (enabled) {
      // Validate configuration before enabling
      const testResult = await SSOService.testConfig(organizationId);
      if (!testResult.valid) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: `Invalid configuration: ${testResult.errors.join(", ")}` },
          { status: 400 },
        );
      }

      await SSOService.enable(organizationId, session.user.id);
    } else {
      await SSOService.disable(organizationId, session.user.id);
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { enabled, message: enabled ? "SSO enabled" : "SSO disabled" },
    });
  } catch (error) {
    console.error("[SSO] Enable/disable error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: error instanceof Error ? error.message : "Failed to update SSO" },
      { status: 500 },
    );
  }
}

// =============================================================================
// DELETE /api/organizations/[id]/sso - Delete SSO configuration
// =============================================================================

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    return NextResponse.json<ApiResponse>({ success: false, error: "Only owners can delete SSO" }, { status: 403 });
  }

  try {
    await SSOService.deleteConfig(organizationId, session.user.id);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { message: "SSO configuration deleted" },
    });
  } catch (error) {
    console.error("[SSO] Delete error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: error instanceof Error ? error.message : "Failed to delete SSO" },
      { status: 500 },
    );
  }
}
