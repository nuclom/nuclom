import { Cause, Effect, Exit } from "effect";
import { connection, NextResponse } from "next/server";
import { createFullLayer, mapErrorToApiResponse } from "@/lib/api-handler";
import { Auth } from "@/lib/effect/services/auth";
import { Billing } from "@/lib/effect/services/billing";

// =============================================================================
// GET /api/billing/plans - Get all available plans
// =============================================================================

export async function GET(request: Request) {
  await connection();
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Get all plans
    const billing = yield* Billing;
    return yield* billing.getPlans();
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  // Custom handling to wrap result in { plans: data }
  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === "Some") {
        return mapErrorToApiResponse(error.value);
      }
      return mapErrorToApiResponse(new Error("Internal server error"));
    },
    onSuccess: (data) => NextResponse.json({ plans: data }),
  });
}
