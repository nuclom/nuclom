import { Effect } from "effect";
import type { NextRequest } from "next/server";
import { createFullLayer, handleEffectExit, handleEffectExitWithStatus } from "@/lib/api-handler";
import { MissingFieldError, ValidationError } from "@/lib/effect";
import { DecisionRepository } from "@/lib/effect/services/decision-repository";
import { Auth } from "@/lib/effect/services/auth";

// =============================================================================
// POST /api/decisions/[id]/links - Create a link from a decision
// =============================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Parse request body
    const body = yield* Effect.tryPromise({
      try: () => request.json(),
      catch: () =>
        new MissingFieldError({
          field: "body",
          message: "Invalid request body",
        }),
    });

    const { linkType, targetDecisionId, targetType, targetUrl, targetTitle } = body;

    if (!linkType) {
      return yield* Effect.fail(new MissingFieldError({ field: "linkType", message: "Link type is required" }));
    }

    // Validate link type
    if (linkType !== "supersedes" && linkType !== "related" && linkType !== "outcome") {
      return yield* Effect.fail(
        new ValidationError({
          message: "Link type must be 'supersedes', 'related', or 'outcome'",
          field: "linkType",
        }),
      );
    }

    // For decision-to-decision links, require targetDecisionId
    if (!targetDecisionId && !targetUrl) {
      return yield* Effect.fail(
        new MissingFieldError({
          field: "targetDecisionId or targetUrl",
          message: "Either targetDecisionId or targetUrl is required",
        }),
      );
    }

    // Create link using repository
    const decisionRepo = yield* DecisionRepository;
    return yield* decisionRepo.createLink({
      decisionId: id,
      linkType,
      targetDecisionId,
      targetType,
      targetUrl,
      targetTitle,
      createdById: user.id,
    });
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExitWithStatus(exit, 201);
}

// =============================================================================
// DELETE /api/decisions/[id]/links/[linkId] - Delete a link
// =============================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: _decisionId } = await params;

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Parse query params for linkId
    const { searchParams } = new URL(request.url);
    const linkId = searchParams.get("linkId");

    if (!linkId) {
      return yield* Effect.fail(new MissingFieldError({ field: "linkId", message: "Link ID is required" }));
    }

    // Delete link using repository
    const decisionRepo = yield* DecisionRepository;
    yield* decisionRepo.deleteLink(linkId);
    return { success: true };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
