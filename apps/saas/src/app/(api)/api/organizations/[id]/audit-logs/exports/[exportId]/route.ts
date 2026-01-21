import { Auth, handleEffectExit, runApiEffect } from '@nuclom/lib/api-handler';
import { AuditLogger } from '@nuclom/lib/audit-log';
import { OrganizationRepository } from '@nuclom/lib/effect';
import { Effect } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// GET /api/organizations/[id]/audit-logs/exports/[exportId] - Get export status
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; exportId: string }> }) {
  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const { id: organizationId, exportId } = resolvedParams;

    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Verify user is a member of the organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, organizationId);

    // Get export status
    const exportStatus = yield* Effect.tryPromise({
      try: () => AuditLogger.getExportStatus(exportId),
      catch: (error) => new Error(error instanceof Error ? error.message : 'Failed to get export status'),
    });

    if (!exportStatus) {
      return yield* Effect.fail(new Error('Export not found'));
    }

    // Verify the export belongs to this organization
    if (exportStatus.organizationId !== organizationId) {
      return yield* Effect.fail(new Error('Export not found'));
    }

    return {
      success: true,
      data: {
        id: exportStatus.id,
        format: exportStatus.format,
        status: exportStatus.status,
        recordCount: exportStatus.recordCount,
        downloadUrl: exportStatus.status === 'completed' ? exportStatus.downloadUrl : null,
        expiresAt: exportStatus.expiresAt,
        errorMessage: exportStatus.errorMessage,
        createdAt: exportStatus.createdAt,
        completedAt: exportStatus.completedAt,
      },
    };
  });

  const exit = await runApiEffect(effect);
  return handleEffectExit(exit);
}
