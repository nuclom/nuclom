import { Effect, Option, Schema } from 'effect';
import type { NextRequest } from 'next/server';
import { createFullLayer, handleEffectExit } from '@/lib/api-handler';
import { MissingFieldError } from '@/lib/effect';
import { Auth } from '@/lib/effect/services/auth';
import { Billing } from '@/lib/effect/services/billing';
import { OrganizationRepository } from '@/lib/effect/services/organization-repository';
import { validateRequestBody } from '@/lib/validation';

const CancelSubscriptionSchema = Schema.Struct({
  organizationId: Schema.String,
});

const ManageSubscriptionSchema = Schema.Struct({
  organizationId: Schema.String,
  action: Schema.Literal('resume', 'change_plan'),
  newPlanId: Schema.optional(Schema.String),
  billingPeriod: Schema.optional(Schema.Literal('monthly', 'yearly')),
});

// =============================================================================
// GET /api/billing/subscription - Get current subscription
// =============================================================================

export async function GET(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Get organization from query params
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return yield* Effect.fail(
        new MissingFieldError({
          field: 'organizationId',
          message: 'Organization ID is required',
        }),
      );
    }

    // Verify user is member of organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, organizationId);

    // Get subscription
    const billing = yield* Billing;
    const subscription = yield* billing.getSubscriptionOption(organizationId);

    if (Option.isNone(subscription)) {
      return { subscription: null, hasSubscription: false };
    }

    return {
      subscription: subscription.value,
      hasSubscription: true,
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}

// =============================================================================
// DELETE /api/billing/subscription - Cancel subscription
// =============================================================================

export async function DELETE(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Parse and validate body
    const { organizationId } = yield* validateRequestBody(CancelSubscriptionSchema, request);

    // Verify user is owner of organization
    const orgRepo = yield* OrganizationRepository;
    const roleOption = yield* orgRepo.getUserRole(user.id, organizationId);

    if (Option.isNone(roleOption) || roleOption.value !== 'owner') {
      return yield* Effect.fail(
        new MissingFieldError({
          field: 'role',
          message: 'Only organization owners can cancel subscriptions',
        }),
      );
    }

    // Cancel subscription
    const billing = yield* Billing;
    const subscription = yield* billing.cancelSubscription(organizationId);

    return {
      success: true,
      subscription,
      message: 'Subscription will be canceled at the end of the billing period',
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}

// =============================================================================
// PATCH /api/billing/subscription - Resume canceled subscription
// =============================================================================

export async function PATCH(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Parse and validate body
    const { organizationId, action, newPlanId, billingPeriod } = yield* validateRequestBody(
      ManageSubscriptionSchema,
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

    const billing = yield* Billing;

    if (action === 'resume') {
      const subscription = yield* billing.resumeSubscription(organizationId);
      return {
        success: true,
        subscription,
        message: 'Subscription resumed successfully',
      };
    }

    if (action === 'change_plan') {
      if (!newPlanId || !billingPeriod) {
        return yield* Effect.fail(
          new MissingFieldError({
            field: 'newPlanId',
            message: 'Plan ID and billing period are required for plan changes',
          }),
        );
      }

      const subscription = yield* billing.changePlan(organizationId, newPlanId, billingPeriod);
      return {
        success: true,
        subscription,
        message: 'Plan changed successfully',
      };
    }

    return yield* Effect.fail(
      new MissingFieldError({
        field: 'action',
        message: "Invalid action. Use 'resume' or 'change_plan'",
      }),
    );
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
