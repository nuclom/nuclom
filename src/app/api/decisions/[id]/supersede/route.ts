import { Effect } from "effect";
import type { NextRequest } from "next/server";
import { createFullLayer, handleEffectExit } from "@/lib/api-handler";
import { MissingFieldError } from "@/lib/effect";
import { DecisionRepository } from "@/lib/effect/services/decision-repository";
import { Auth } from "@/lib/effect/services/auth";

// =============================================================================
// POST /api/decisions/[id]/supersede - Supersede this decision with a new one
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

    const { newDecisionId } = body;

    if (!newDecisionId) {
      return yield* Effect.fail(
        new MissingFieldError({
          field: "newDecisionId",
          message: "New decision ID is required",
        }),
      );
    }

    // Supersede the decision
    const decisionRepo = yield* DecisionRepository;
    return yield* decisionRepo.supersedeDecision(id, newDecisionId, user.id);
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
