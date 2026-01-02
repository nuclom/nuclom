import { Effect } from "effect";
import type { NextRequest } from "next/server";
import { createFullLayer, handleEffectExit, handleEffectExitWithStatus } from "@/lib/api-handler";
import { MissingFieldError } from "@/lib/effect";
import { DecisionRepository } from "@/lib/effect/services/decision-repository";
import { Auth } from "@/lib/effect/services/auth";

// =============================================================================
// POST /api/decisions/[id]/tags - Add a tag to a decision
// =============================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Parse request body
    const body = yield* Effect.tryPromise({
      try: () => request.json(),
      catch: () =>
        new MissingFieldError({
          field: "body",
          message: "Invalid request body",
        }),
    });

    const { tagId } = body;

    if (!tagId) {
      return yield* Effect.fail(new MissingFieldError({ field: "tagId", message: "Tag ID is required" }));
    }

    // Add tag using repository
    const decisionRepo = yield* DecisionRepository;
    return yield* decisionRepo.addTag(id, tagId);
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExitWithStatus(exit, 201);
}

// =============================================================================
// DELETE /api/decisions/[id]/tags - Remove a tag from a decision
// =============================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Parse query params
    const { searchParams } = new URL(request.url);
    const tagId = searchParams.get("tagId");

    if (!tagId) {
      return yield* Effect.fail(new MissingFieldError({ field: "tagId", message: "Tag ID is required" }));
    }

    // Remove tag using repository
    const decisionRepo = yield* DecisionRepository;
    yield* decisionRepo.removeTag(id, tagId);
    return { success: true };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
