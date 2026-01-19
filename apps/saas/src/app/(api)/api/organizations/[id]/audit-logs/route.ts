import { type AuditLogFilters, AuditLogger } from '@nuclom/lib/audit-log';
import { auth } from '@nuclom/lib/auth';
import { db } from '@nuclom/lib/db';
import { type AuditLogCategory, type AuditLogSeverity, members } from '@nuclom/lib/db/schema';
import { logger } from '@nuclom/lib/logger';
import type { ApiResponse } from '@nuclom/lib/types';
import { safeParse } from '@nuclom/lib/validation';
import { and, eq } from 'drizzle-orm';
import { Schema } from 'effect';
import { headers } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

// Schema for export request
const ExportRequestSchema = Schema.Struct({
  format: Schema.Literal('csv', 'json'),
  filters: Schema.optional(
    Schema.Struct({
      startDate: Schema.optional(Schema.String),
      endDate: Schema.optional(Schema.String),
      categories: Schema.optional(Schema.Array(Schema.String)),
      actions: Schema.optional(Schema.Array(Schema.String)),
      actorIds: Schema.optional(Schema.Array(Schema.String)),
      severity: Schema.optional(Schema.Array(Schema.String)),
    }),
  ),
});

// =============================================================================
// GET /api/organizations/[id]/audit-logs - Query audit logs
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id: organizationId } = await params;

  // Check if user has permission to view audit logs
  const membership = await db.query.members.findFirst({
    where: and(eq(members.userId, session.user.id), eq(members.organizationId, organizationId)),
  });

  if (!membership) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Not a member of this organization' },
      { status: 403 },
    );
  }

  // Check if user has audit_log:read permission using Better Auth
  const hasPermission = await auth.api.hasPermission({
    headers: await headers(),
    body: {
      permissions: {
        audit_log: ['read'],
      },
    },
  });

  if (!hasPermission?.success) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "You don't have permission to view audit logs" },
      { status: 403 },
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;

    const filters: AuditLogFilters = {};

    // Parse date filters
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);

    // Parse category filter
    const categories = searchParams.get('categories');
    if (categories) {
      filters.categories = categories.split(',') as AuditLogCategory[];
    }

    // Parse action filter
    const actions = searchParams.get('actions');
    if (actions) {
      filters.actions = actions.split(',');
    }

    // Parse actor filter
    const actorIds = searchParams.get('actorIds');
    if (actorIds) {
      filters.actorIds = actorIds.split(',');
    }

    // Parse severity filter
    const severity = searchParams.get('severity');
    if (severity) {
      filters.severity = severity.split(',') as AuditLogSeverity[];
    }

    // Parse resource filter
    const resourceType = searchParams.get('resourceType');
    const resourceId = searchParams.get('resourceId');
    if (resourceType) filters.resourceType = resourceType;
    if (resourceId) filters.resourceId = resourceId;

    // Parse pagination
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    filters.limit = Math.min(limit, 100); // Max 100 per page
    filters.offset = offset;

    const result = await AuditLogger.query(organizationId, filters);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        logs: result.logs,
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        hasMore: result.offset + result.logs.length < result.total,
      },
    });
  } catch (error) {
    logger.error('[Audit] Query error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json<ApiResponse>(
      { success: false, error: error instanceof Error ? error.message : 'Failed to query audit logs' },
      { status: 500 },
    );
  }
}

// =============================================================================
// POST /api/organizations/[id]/audit-logs - Request audit log export
// =============================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id: organizationId } = await params;

  // Check if user has permission to download audit logs
  const membership = await db.query.members.findFirst({
    where: and(eq(members.userId, session.user.id), eq(members.organizationId, organizationId)),
  });

  if (!membership) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Not a member of this organization' },
      { status: 403 },
    );
  }

  // Check if user has audit_log:download permission using Better Auth
  const hasPermission = await auth.api.hasPermission({
    headers: await headers(),
    body: {
      permissions: {
        audit_log: ['download'],
      },
    },
  });

  if (!hasPermission?.success) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "You don't have permission to export audit logs" },
      { status: 403 },
    );
  }

  try {
    const rawBody = await request.json();
    const result = safeParse(ExportRequestSchema, rawBody);
    if (!result.success) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Format must be 'csv' or 'json'" },
        { status: 400 },
      );
    }
    const { format, filters } = result.data;

    // Build filters
    const exportFilters: AuditLogFilters = {};
    if (filters) {
      if (filters.startDate) exportFilters.startDate = new Date(filters.startDate);
      if (filters.endDate) exportFilters.endDate = new Date(filters.endDate);
      if (filters.categories) exportFilters.categories = [...filters.categories] as AuditLogCategory[];
      if (filters.actions) exportFilters.actions = [...filters.actions];
      if (filters.actorIds) exportFilters.actorIds = [...filters.actorIds];
      if (filters.severity) exportFilters.severity = [...filters.severity] as AuditLogSeverity[];
    }

    const exportId = await AuditLogger.requestExport(organizationId, session.user.id, {
      format,
      filters: exportFilters,
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        exportId,
        message: 'Export requested. Check status at /api/organizations/[id]/audit-logs/exports/[exportId]',
      },
    });
  } catch (error) {
    logger.error('[Audit] Export request error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json<ApiResponse>(
      { success: false, error: error instanceof Error ? error.message : 'Failed to request export' },
      { status: 500 },
    );
  }
}
