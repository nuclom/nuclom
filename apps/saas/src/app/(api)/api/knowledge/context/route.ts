import { handleEffectExitWithOptions, runApiEffect } from '@nuclom/lib/api-handler';
import { CachePresets, getCacheControlHeader } from '@nuclom/lib/api-utils';
import { KnowledgeGraphRepository } from '@nuclom/lib/effect';
import { Auth } from '@nuclom/lib/effect/services/auth';
import { validateQueryParams } from '@nuclom/lib/validation';
import { Effect, Schema } from 'effect';
import { connection, type NextRequest } from 'next/server';

// =============================================================================
// Query Schema
// =============================================================================

const getContextQuerySchema = Schema.Struct({
  organizationId: Schema.String,
  // Artifact reference - supports various formats:
  // - github:pr:123
  // - linear:issue:ABC-123
  // - video:uuid
  // - document:uuid
  artifact: Schema.String,
});

// =============================================================================
// GET /api/knowledge/context - Get decision context for an artifact
// =============================================================================

export async function GET(request: NextRequest) {
  await connection();
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Validate query params
    const params = yield* validateQueryParams(getContextQuerySchema, request.url);

    // Parse artifact reference
    // Format: type:subtype:id or type:id
    const artifactParts = params.artifact.split(':');
    const entityType = artifactParts.length >= 2 ? artifactParts.slice(0, -1).join(':') : artifactParts[0];
    const entityId = artifactParts[artifactParts.length - 1];

    // Fetch decisions related to this artifact
    const repo = yield* KnowledgeGraphRepository;
    const decisions = yield* repo.getDecisionContext(params.organizationId, entityType, entityId);

    return {
      artifact: params.artifact,
      entityType,
      entityId,
      decisions,
      totalDecisions: decisions.length,
    };
  });

  const exit = await runApiEffect(effect);
  return handleEffectExitWithOptions(exit, {
    successHeaders: {
      'Cache-Control': getCacheControlHeader(CachePresets.shortWithSwr()),
    },
  });
}
