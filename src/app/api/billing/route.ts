import { Effect } from "effect";
import type { NextRequest } from "next/server";
import { createFullLayer, handleEffectExit } from "@/lib/api-handler";
import { MissingFieldError } from "@/lib/effect";
import { Auth } from "@/lib/effect/services/auth";
import { BillingRepository } from "@/lib/effect/services/billing-repository";
import { OrganizationRepository } from "@/lib/effect/services/organization-repository";

// =============================================================================
// GET /api/billing - Get complete billing info for organization
// =============================================================================

export async function GET(request: NextRequest) {
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

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
