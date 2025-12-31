/**
 * Legacy Checkout Route
 *
 * NOTE: Better Auth Stripe handles checkout via /api/auth/stripe/upgrade
 * This endpoint is kept for backward compatibility and custom integrations.
 * For new implementations, use the authClient.subscription.upgrade() method.
 */

import process from "node:process";
import { Cause, Effect, Exit, Layer, Option } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AppLive, MissingFieldError } from "@/lib/effect";
import { mapErrorToResponse } from "@/lib/effect/runtime";
import { Auth, makeAuthLayer } from "@/lib/effect/services/auth";
import { OrganizationRepository } from "@/lib/effect/services/organization-repository";
import { StripeServiceTag } from "@/lib/effect/services/stripe";
import { BillingRepository } from "@/lib/effect/services/billing-repository";

// =============================================================================
// POST /api/billing/checkout - Create checkout session (legacy)
// =============================================================================

export async function POST(request: NextRequest) {
  const AuthLayer = makeAuthLayer(auth);
  const FullLayer = Layer.merge(AppLive, AuthLayer);

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Parse body
    const body = yield* Effect.tryPromise({
      try: () => request.json(),
      catch: () =>
        new MissingFieldError({
          field: "body",
          message: "Invalid request body",
        }),
    });

    const { organizationId, planId, billingPeriod, trialDays } = body;

    if (!organizationId) {
      return yield* Effect.fail(
        new MissingFieldError({
          field: "organizationId",
          message: "Organization ID is required",
        }),
      );
    }

    if (!planId) {
      return yield* Effect.fail(
        new MissingFieldError({
          field: "planId",
          message: "Plan ID is required",
        }),
      );
    }

    if (!billingPeriod || !["monthly", "yearly"].includes(billingPeriod)) {
      return yield* Effect.fail(
        new MissingFieldError({
          field: "billingPeriod",
          message: "Billing period must be 'monthly' or 'yearly'",
        }),
      );
    }

    // Verify user is owner of organization
    const orgRepo = yield* OrganizationRepository;
    const roleOption = yield* orgRepo.getUserRole(user.id, organizationId);

    if (Option.isNone(roleOption) || roleOption.value !== "owner") {
      return yield* Effect.fail(
        new MissingFieldError({
          field: "role",
          message: "Only organization owners can manage subscriptions",
        }),
      );
    }

    // Get organization for slug
    const org = yield* orgRepo.getOrganization(organizationId);

    // Get plan to find Stripe price ID
    const billingRepo = yield* BillingRepository;
    const plan = yield* billingRepo.getPlan(planId);

    const stripePriceId =
      billingPeriod === "yearly" ? plan.stripePriceIdYearly : plan.stripePriceIdMonthly;

    if (!stripePriceId) {
      return yield* Effect.fail(
        new MissingFieldError({
          field: "stripePriceId",
          message: "Plan does not have a Stripe price configured for this billing period",
        }),
      );
    }

    // Build URLs
    const baseUrl = request.headers.get("origin") || process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
    const successUrl = `${baseUrl}/${org.slug}/settings/billing?success=true`;
    const cancelUrl = `${baseUrl}/${org.slug}/settings/billing?canceled=true`;

    // Create checkout session using Stripe service
    const stripe = yield* StripeServiceTag;
    const session = yield* stripe.createCheckoutSession({
      priceId: stripePriceId,
      customerId: user.stripeCustomerId || undefined,
      customerEmail: !user.stripeCustomerId ? user.email : undefined,
      successUrl,
      cancelUrl,
      trialPeriodDays: trialDays,
      metadata: {
        organizationId,
        userId: user.id,
        planId,
        referenceId: organizationId, // For Better Auth Stripe compatibility
      },
    });

    return { url: session.url, sessionId: session.id };
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
