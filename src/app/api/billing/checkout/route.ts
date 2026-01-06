/**
 * Legacy Checkout Route
 *
 * NOTE: Better Auth Stripe handles checkout via /api/auth/stripe/upgrade
 * This endpoint is kept for backward compatibility and custom integrations.
 * For new implementations, use the authClient.subscription.upgrade() method.
 */

import { Effect, Option, Schema } from 'effect';
import type { NextRequest } from 'next/server';
import { createFullLayer, handleEffectExit } from '@/lib/api-handler';
import { MissingFieldError } from '@/lib/effect';
import { Auth } from '@/lib/effect/services/auth';
import { BillingRepository } from '@/lib/effect/services/billing-repository';
import { Database } from '@/lib/effect/services/database';
import { OrganizationRepository } from '@/lib/effect/services/organization-repository';
import { StripeServiceTag } from '@/lib/effect/services/stripe';
import { getAppUrl } from '@/lib/env/server';
import { rateLimitBillingAsync } from '@/lib/rate-limit';
import { validateRequestBody } from '@/lib/validation';

const CheckoutRequestSchema = Schema.Struct({
  organizationId: Schema.String,
  planId: Schema.String,
  billingPeriod: Schema.Literal('monthly', 'yearly'),
  trialDays: Schema.optional(Schema.Number),
});

// =============================================================================
// POST /api/billing/checkout - Create checkout session (legacy)
// =============================================================================

export async function POST(request: NextRequest) {
  // Rate limit billing operations to prevent abuse
  const rateLimitResult = await rateLimitBillingAsync(request);
  if (rateLimitResult) return rateLimitResult;

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Parse and validate body
    const { organizationId, planId, billingPeriod, trialDays } = yield* validateRequestBody(
      CheckoutRequestSchema,
      request,
    );

    // Verify user is owner of organization
    const orgRepo = yield* OrganizationRepository;
    const roleOption = yield* orgRepo.getUserRole(user.id, organizationId);

    if (Option.isNone(roleOption) || roleOption.value !== 'owner') {
      return yield* Effect.fail(
        new MissingFieldError({
          field: 'role',
          message: 'Only organization owners can manage subscriptions',
        }),
      );
    }

    // Get organization for slug
    const org = yield* orgRepo.getOrganization(organizationId);

    // Get full user data including stripeCustomerId from database
    const { db } = yield* Database;
    const dbUser = yield* Effect.tryPromise({
      try: () => db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, user.id) }),
      catch: () => new MissingFieldError({ field: 'user', message: 'Failed to fetch user' }),
    });

    // Get plan to find Stripe price ID
    const billingRepo = yield* BillingRepository;
    const plan = yield* billingRepo.getPlan(planId);

    const stripePriceId = billingPeriod === 'yearly' ? plan.stripePriceIdYearly : plan.stripePriceIdMonthly;

    if (!stripePriceId) {
      return yield* Effect.fail(
        new MissingFieldError({
          field: 'stripePriceId',
          message: 'Plan does not have a Stripe price configured for this billing period',
        }),
      );
    }

    // Build URLs
    const baseUrl = request.headers.get('origin') || getAppUrl();
    const successUrl = `${baseUrl}/${org.slug}/settings/billing?success=true`;
    const cancelUrl = `${baseUrl}/${org.slug}/settings/billing?canceled=true`;

    // Create checkout session using Stripe service
    const stripe = yield* StripeServiceTag;
    const stripeCustomerId = dbUser?.stripeCustomerId;
    const session = yield* stripe.createCheckoutSession({
      priceId: stripePriceId,
      customerId: stripeCustomerId || undefined,
      customerEmail: !stripeCustomerId ? user.email : undefined,
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

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
