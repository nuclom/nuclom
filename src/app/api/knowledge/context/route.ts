import { Cause, Effect, Exit, Layer, Schema } from "effect";
import { connection, type NextRequest, NextResponse } from "next/server";
import { mapErrorToApiResponse } from "@/lib/api-errors";
import { CachePresets, getCacheControlHeader } from "@/lib/api-utils";
import { auth } from "@/lib/auth";
import { AppLive, KnowledgeGraphRepository } from "@/lib/effect";
import { Auth, makeAuthLayer } from "@/lib/effect/services/auth";
import { validateQueryParams } from "@/lib/validation";

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

  const AuthLayer = makeAuthLayer(auth);
  const FullLayer = Layer.merge(AppLive, AuthLayer);

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Validate query params
    const params = yield* validateQueryParams(getContextQuerySchema, request.url);

    // Parse artifact reference
    // Format: type:subtype:id or type:id
    const artifactParts = params.artifact.split(":");
    const entityType = artifactParts.length >= 2 ? artifactParts.slice(0, -1).join(":") : artifactParts[0];
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

  const runnable = Effect.provide(effect, FullLayer);
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === "Some") {
        return mapErrorToApiResponse(error.value);
      }
      return mapErrorToApiResponse(new Error("Internal server error"));
    },
    onSuccess: (data) =>
      NextResponse.json(data, {
        headers: {
          "Cache-Control": getCacheControlHeader(CachePresets.shortWithSwr()),
        },
      }),
  });
}
