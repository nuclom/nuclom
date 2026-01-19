import { auth } from '@nuclom/lib/auth';
import { and, eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { AuditLogger } from '@/lib/audit-log';
import { db } from '@/lib/db';
import { members } from '@/lib/db/schema';
import { logger } from '@/lib/logger';
import type { ApiResponse } from '@/lib/types';

// =============================================================================
// GET /api/organizations/[id]/audit-logs/stats - Get audit log statistics
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id: organizationId } = await params;

  // Check if user is a member
  const membership = await db.query.members.findFirst({
    where: and(eq(members.userId, session.user.id), eq(members.organizationId, organizationId)),
  });

  if (!membership) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Not a member of this organization' },
      { status: 403 },
    );
  }

  // Check if user has permission to view audit logs using Better Auth
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
    const days = parseInt(searchParams.get('days') || '30', 10);

    const stats = await AuditLogger.getStats(organizationId, days);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('[Audit] Stats error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json<ApiResponse>(
      { success: false, error: error instanceof Error ? error.message : 'Failed to get audit stats' },
      { status: 500 },
    );
  }
}
