import { Cause, Effect, Exit, Layer } from "effect";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AppLive } from "@/lib/effect";
import { mapErrorToResponse } from "@/lib/effect/runtime";
import { Auth, makeAuthLayer } from "@/lib/effect/services/auth";
import { Billing } from "@/lib/effect/services/billing";

// =============================================================================
// GET /api/billing/plans - Get all available plans
// =============================================================================

export async function GET(request: Request) {
  const AuthLayer = makeAuthLayer(auth);
  const FullLayer = Layer.merge(AppLive, AuthLayer);

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Get all plans
    const billing = yield* Billing;
    return yield* billing.getPlans();
  });

  const runnable = Effect.provide(effect, FullLayer);
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === "Some") {
        return mapErrorToResponse(error.value);
      }
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    },
    onSuccess: (data) => NextResponse.json({ plans: data }),
  });
}
