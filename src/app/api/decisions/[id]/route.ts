import { Effect } from "effect";
import type { NextRequest } from "next/server";
import { createFullLayer, handleEffectExit, handleEffectExitWithStatus } from "@/lib/api-handler";
import { MissingFieldError } from "@/lib/effect";
import { DecisionRepository } from "@/lib/effect/services/decision-repository";
import { Auth } from "@/lib/effect/services/auth";

// =============================================================================
// GET /api/decisions/[id] - Get decision with full details
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Fetch decision with details using repository
    const decisionRepo = yield* DecisionRepository;
    return yield* decisionRepo.getDecisionById(id);
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}

// =============================================================================
// PATCH /api/decisions/[id] - Update a decision
// =============================================================================

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { summary, context, status, decidedAt } = body;

    // Update decision using repository
    const decisionRepo = yield* DecisionRepository;
    return yield* decisionRepo.updateDecision(
      id,
      {
        summary,
        context,
        status,
        decidedAt: decidedAt ? new Date(decidedAt) : undefined,
      },
      user.id,
    );
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}

// =============================================================================
// DELETE /api/decisions/[id] - Delete a decision
// =============================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Delete decision using repository
    const decisionRepo = yield* DecisionRepository;
    yield* decisionRepo.deleteDecision(id);
    return { success: true };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
