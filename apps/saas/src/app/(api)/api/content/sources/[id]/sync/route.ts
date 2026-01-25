/**
 * Content Source Sync API Routes
 *
 * POST /api/content/sources/[id]/sync - Trigger sync for a content source
 * GET /api/content/sources/[id]/sync - Get sync progress
 */

import {
  Auth,
  createFullLayer,
  handleEffectExit,
  handleEffectExitWithStatus,
  resolveParams,
} from '@nuclom/lib/api-handler';
import { getContentSource, getContentSyncProgress, syncContentSource } from '@nuclom/lib/effect/services/content';
import { OrganizationRepository } from '@nuclom/lib/effect/services/organization-repository';
import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// Schemas
// =============================================================================

const _SyncOptionsSchema = Schema.Struct({
  since: Schema.optional(Schema.String),
  until: Schema.optional(Schema.String),
  limit: Schema.optional(Schema.Number),
  filters: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
});

// =============================================================================
// POST - Trigger Sync
// =============================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Resolve params
    const { id } = yield* resolveParams(params);

    // Get content source to verify access
    const source = yield* getContentSource(id);

    // Verify user has access to the organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, source.organizationId);

    // Parse optional sync options
    let options: { since?: Date; until?: Date; limit?: number; filters?: Record<string, unknown> } | undefined;
    const bodyResult = yield* Effect.tryPromise({
      try: () => request.json(),
      catch: () => null, // No body or invalid JSON
    });
    if (bodyResult) {
      const body = bodyResult as { since?: string; until?: string; limit?: number; filters?: Record<string, unknown> };
      options = {
        since: body.since ? new Date(body.since) : undefined,
        until: body.until ? new Date(body.until) : undefined,
        limit: body.limit,
        filters: body.filters,
      };
    }

    // Trigger sync
    const progress = yield* syncContentSource(id, options);

    return progress;
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExitWithStatus(exit, 202);
}

// =============================================================================
// GET - Get Sync Progress
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Resolve params
    const { id } = yield* resolveParams(params);

    // Get content source to verify access
    const source = yield* getContentSource(id);

    // Verify user has access to the organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, source.organizationId);

    // Get sync progress
    const progress = yield* getContentSyncProgress(id);

    return (
      progress ?? {
        sourceId: id,
        status: 'idle',
        itemsProcessed: 0,
        errors: [],
      }
    );
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
