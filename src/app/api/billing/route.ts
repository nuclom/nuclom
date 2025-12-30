import { Cause, Effect, Exit, Layer } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AppLive, MissingFieldError } from "@/lib/effect";
import { mapErrorToResponse } from "@/lib/effect/runtime";
import { Auth, makeAuthLayer } from "@/lib/effect/services/auth";
import { BillingRepository } from "@/lib/effect/services/billing-repository";
import { OrganizationRepository } from "@/lib/effect/services/organization-repository";

// =============================================================================
// GET /api/billing - Get complete billing info for organization
// =============================================================================

export async function GET(request: NextRequest) {
  const AuthLayer = makeAuthLayer(auth);
  const FullLayer = Layer.merge(AppLive, AuthLayer);

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Get organization from query params
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return yield* Effect.fail(
        new MissingFieldError({
          field: "organizationId",
          message: "Organization ID is required",
        }),
      );
    }

    // Verify user is member of organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, organizationId);

    // Get complete billing info
    const billingRepo = yield* BillingRepository;
    const billingInfo = yield* billingRepo.getBillingInfo(organizationId);

    return billingInfo;
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
    onSuccess: (data) => NextResponse.json(data),
  });
}
