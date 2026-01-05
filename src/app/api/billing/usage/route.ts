import { Effect, Schema } from "effect";
import type { NextRequest } from "next/server";
import { createFullLayer, handleEffectExit } from "@/lib/api-handler";
import { MissingFieldError } from "@/lib/effect";
import { Auth } from "@/lib/effect/services/auth";
import { Billing } from "@/lib/effect/services/billing";
import { BillingRepository } from "@/lib/effect/services/billing-repository";
import { OrganizationRepository } from "@/lib/effect/services/organization-repository";
import { validateRequestBody } from "@/lib/validation";

const UsageHistoryRequestSchema = Schema.Struct({
  organizationId: Schema.String,
  months: Schema.optional(Schema.Number),
});

// =============================================================================
// GET /api/billing/usage - Get usage summary
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

    // Get usage summary
    const billing = yield* Billing;
    const usage = yield* billing.getUsageSummary(organizationId);

    return { usage };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}

// =============================================================================
// POST /api/billing/usage - Get usage history
// =============================================================================

export async function POST(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Parse and validate body
    const body = yield* validateRequestBody(UsageHistoryRequestSchema, request);
    const { organizationId, months = 6 } = body;

    // Verify user is member of organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, organizationId);

    // Get usage history
    const billingRepo = yield* BillingRepository;
    const history = yield* billingRepo.getUsageHistory(organizationId, months);

    return { history };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
