/**
 * Billing Service using Effect-TS
 *
 * High-level billing operations that coordinate between Stripe and the database.
 */

import { Context, Effect, Layer, Option } from "effect";
import type Stripe from "stripe";
import type {
  InvoiceStatus,
  NewInvoice,
  NewPaymentMethod,
  NewSubscription,
  Plan,
  PlanLimits,
  Subscription,
  SubscriptionStatus,
} from "@/lib/db/schema";
import {
  type BillingError,
  DatabaseError,
  NoSubscriptionError,
  PaymentFailedError,
  PlanLimitExceededError,
  PlanNotFoundError,
  StripeApiError,
  SubscriptionError,
} from "../errors";
import {
  BillingRepository,
  type OrganizationBillingInfo,
  type SubscriptionWithPlan,
  type UsageSummary,
} from "./billing-repository";
import { Database } from "./database";
import { StripeServiceTag } from "./stripe";

// =============================================================================
// Types
// =============================================================================

export interface CreateCheckoutParams {
  organizationId: string;
  planId: string;
  billingPeriod: "monthly" | "yearly";
  successUrl: string;
  cancelUrl: string;
  email: string;
  name?: string;
  trialDays?: number;
}

export interface SubscriptionUpgradePreview {
  currentPlan: Plan;
  newPlan: Plan;
  proratedAmount: number;
  immediateCharge: number;
  nextBillingDate: Date;
}

export type LimitResource = "storage" | "videos" | "members" | "bandwidth" | "ai_requests";

// =============================================================================
// Service Interface
// =============================================================================

export interface BillingServiceInterface {
  // Subscription Management
  readonly createCheckoutSession: (
    params: CreateCheckoutParams,
  ) => Effect.Effect<{ url: string }, StripeApiError | PlanNotFoundError | DatabaseError>;

  readonly createPortalSession: (
    organizationId: string,
    returnUrl: string,
  ) => Effect.Effect<{ url: string }, NoSubscriptionError | StripeApiError | DatabaseError>;

  readonly getSubscription: (
    organizationId: string,
  ) => Effect.Effect<SubscriptionWithPlan, NoSubscriptionError | DatabaseError>;

  readonly getSubscriptionOption: (
    organizationId: string,
  ) => Effect.Effect<Option.Option<SubscriptionWithPlan>, DatabaseError>;

  readonly cancelSubscription: (
    organizationId: string,
  ) => Effect.Effect<Subscription, NoSubscriptionError | StripeApiError | SubscriptionError | DatabaseError>;

  readonly resumeSubscription: (
    organizationId: string,
  ) => Effect.Effect<Subscription, NoSubscriptionError | StripeApiError | SubscriptionError | DatabaseError>;

  readonly changePlan: (
    organizationId: string,
    newPlanId: string,
    billingPeriod: "monthly" | "yearly",
  ) => Effect.Effect<
    Subscription,
    NoSubscriptionError | PlanNotFoundError | StripeApiError | SubscriptionError | DatabaseError
  >;

  // Billing Info
  readonly getBillingInfo: (organizationId: string) => Effect.Effect<OrganizationBillingInfo, DatabaseError>;

  readonly getUsageSummary: (
    organizationId: string,
  ) => Effect.Effect<UsageSummary, NoSubscriptionError | DatabaseError>;

  // Plan Limits
  readonly checkLimit: (
    organizationId: string,
    resource: LimitResource,
    additionalAmount?: number,
  ) => Effect.Effect<boolean, NoSubscriptionError | DatabaseError>;

  readonly enforceLimit: (
    organizationId: string,
    resource: LimitResource,
    additionalAmount?: number,
  ) => Effect.Effect<void, PlanLimitExceededError | NoSubscriptionError | DatabaseError>;

  readonly getFeatureAccess: (
    organizationId: string,
    feature: keyof Plan["features"],
  ) => Effect.Effect<boolean, NoSubscriptionError | DatabaseError>;

  // Plans
  readonly getPlans: () => Effect.Effect<Plan[], DatabaseError>;

  readonly getPlan: (planId: string) => Effect.Effect<Plan, PlanNotFoundError | DatabaseError>;

  // Webhook Handlers
  readonly handleSubscriptionCreated: (
    stripeSubscription: Stripe.Subscription,
    organizationId: string,
  ) => Effect.Effect<Subscription, PlanNotFoundError | DatabaseError>;

  readonly handleSubscriptionUpdated: (
    stripeSubscription: Stripe.Subscription,
  ) => Effect.Effect<Subscription, DatabaseError>;

  readonly handleSubscriptionDeleted: (stripeSubscription: Stripe.Subscription) => Effect.Effect<void, DatabaseError>;

  readonly handleInvoicePaid: (stripeInvoice: Stripe.Invoice) => Effect.Effect<void, DatabaseError>;

  readonly handleInvoiceFailed: (stripeInvoice: Stripe.Invoice) => Effect.Effect<void, DatabaseError>;

  readonly handlePaymentMethodAttached: (
    paymentMethod: Stripe.PaymentMethod,
    organizationId: string,
  ) => Effect.Effect<void, DatabaseError>;

  readonly handlePaymentMethodDetached: (paymentMethodId: string) => Effect.Effect<void, DatabaseError>;
}

// =============================================================================
// Service Tag
// =============================================================================

export class Billing extends Context.Tag("Billing")<Billing, BillingServiceInterface>() {}

// =============================================================================
// Service Implementation
// =============================================================================

const makeBillingService = Effect.gen(function* () {
  const stripe = yield* StripeServiceTag;
  const billingRepo = yield* BillingRepository;

  const mapStripeStatus = (status: Stripe.Subscription.Status): SubscriptionStatus => {
    const statusMap: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
      active: "active",
      canceled: "canceled",
      past_due: "past_due",
      trialing: "trialing",
      incomplete: "incomplete",
      incomplete_expired: "incomplete_expired",
      unpaid: "unpaid",
      paused: "active", // Treat paused as active for our purposes
    };
    return statusMap[status] ?? "active";
  };

  const mapStripeInvoiceStatus = (status: Stripe.Invoice.Status | null): InvoiceStatus => {
    if (!status) return "draft";
    const statusMap: Record<string, InvoiceStatus> = {
      draft: "draft",
      open: "open",
      paid: "paid",
      void: "void",
      uncollectible: "uncollectible",
    };
    return statusMap[status] ?? "open";
  };

  const service: BillingServiceInterface = {
    createCheckoutSession: (params) =>
      Effect.gen(function* () {
        const plan = yield* billingRepo.getPlan(params.planId);

        // Get or create Stripe customer
        let customerId: string;
        const existingSubscription = yield* billingRepo.getSubscriptionOption(params.organizationId);

        if (Option.isSome(existingSubscription) && existingSubscription.value.stripeCustomerId) {
          customerId = existingSubscription.value.stripeCustomerId;
        } else {
          const customer = yield* stripe.createCustomer({
            email: params.email,
            name: params.name,
            metadata: { organizationId: params.organizationId },
          });
          customerId = customer.id;
        }

        const priceId = params.billingPeriod === "yearly" ? plan.stripePriceIdYearly : plan.stripePriceIdMonthly;

        if (!priceId) {
          return yield* Effect.fail(
            new PlanNotFoundError({
              message: `No ${params.billingPeriod} price configured for plan: ${params.planId}`,
              planId: params.planId,
            }),
          );
        }

        const session = yield* stripe.createCheckoutSession({
          customerId,
          priceId,
          successUrl: params.successUrl,
          cancelUrl: params.cancelUrl,
          metadata: { organizationId: params.organizationId, planId: params.planId },
          trialPeriodDays: params.trialDays,
        });

        return { url: session.url! };
      }),

    createPortalSession: (organizationId, returnUrl) =>
      Effect.gen(function* () {
        const subscription = yield* billingRepo.getSubscription(organizationId);

        if (!subscription.stripeCustomerId) {
          return yield* Effect.fail(
            new NoSubscriptionError({
              message: "No Stripe customer ID found",
              organizationId,
            }),
          );
        }

        const session = yield* stripe.createPortalSession({
          customerId: subscription.stripeCustomerId,
          returnUrl,
        });

        return { url: session.url };
      }),

    getSubscription: (organizationId) => billingRepo.getSubscription(organizationId),

    getSubscriptionOption: (organizationId) => billingRepo.getSubscriptionOption(organizationId),

    cancelSubscription: (organizationId) =>
      Effect.gen(function* () {
        const subscription = yield* billingRepo.getSubscription(organizationId);

        if (!subscription.stripeSubscriptionId) {
          return yield* Effect.fail(
            new SubscriptionError({
              message: "No Stripe subscription to cancel",
            }),
          );
        }

        yield* stripe.cancelSubscriptionAtPeriodEnd(subscription.stripeSubscriptionId);

        return yield* billingRepo.updateSubscription(organizationId, {
          cancelAtPeriodEnd: true,
        });
      }),

    resumeSubscription: (organizationId) =>
      Effect.gen(function* () {
        const subscription = yield* billingRepo.getSubscription(organizationId);

        if (!subscription.stripeSubscriptionId) {
          return yield* Effect.fail(
            new SubscriptionError({
              message: "No Stripe subscription to resume",
            }),
          );
        }

        yield* stripe.resumeSubscription(subscription.stripeSubscriptionId);

        return yield* billingRepo.updateSubscription(organizationId, {
          cancelAtPeriodEnd: false,
        });
      }),

    changePlan: (organizationId, newPlanId, billingPeriod) =>
      Effect.gen(function* () {
        const subscription = yield* billingRepo.getSubscription(organizationId);
        const newPlan = yield* billingRepo.getPlan(newPlanId);

        if (!subscription.stripeSubscriptionId) {
          return yield* Effect.fail(
            new SubscriptionError({
              message: "No Stripe subscription to update",
            }),
          );
        }

        const priceId = billingPeriod === "yearly" ? newPlan.stripePriceIdYearly : newPlan.stripePriceIdMonthly;

        if (!priceId) {
          return yield* Effect.fail(
            new PlanNotFoundError({
              message: `No ${billingPeriod} price for plan: ${newPlanId}`,
              planId: newPlanId,
            }),
          );
        }

        // Get current subscription items
        const stripeSubscription = yield* stripe.getSubscription(subscription.stripeSubscriptionId);
        const currentItemId = stripeSubscription.items.data[0]?.id;

        if (!currentItemId) {
          return yield* Effect.fail(
            new SubscriptionError({
              message: "No subscription item found",
              subscriptionId: subscription.stripeSubscriptionId,
            }),
          );
        }

        // Update the subscription with the new price
        yield* stripe.updateSubscription(subscription.stripeSubscriptionId, {
          items: [
            {
              id: currentItemId,
              price: priceId,
            },
          ],
          proration_behavior: "create_prorations",
        });

        return yield* billingRepo.updateSubscription(organizationId, {
          planId: newPlanId,
        });
      }),

    getBillingInfo: (organizationId) => billingRepo.getBillingInfo(organizationId),

    getUsageSummary: (organizationId) => billingRepo.getUsageSummary(organizationId),

    checkLimit: (organizationId, resource, additionalAmount = 0) =>
      Effect.gen(function* () {
        const subscription = yield* billingRepo.getSubscription(organizationId);
        const limits = subscription.plan.limits;

        const limit = limits[resource as keyof PlanLimits];
        if (limit === -1) return true; // Unlimited

        let currentUsage: number;

        switch (resource) {
          case "members": {
            currentUsage = yield* billingRepo.getMemberCount(organizationId);
            break;
          }
          case "videos": {
            currentUsage = yield* billingRepo.getVideoCount(organizationId);
            break;
          }
          case "storage":
          case "bandwidth":
          case "ai_requests": {
            const usage = yield* billingRepo.getCurrentUsage(organizationId);
            currentUsage =
              resource === "storage"
                ? usage.storageUsed
                : resource === "bandwidth"
                  ? usage.bandwidthUsed
                  : usage.aiRequests;
            break;
          }
          default:
            return true;
        }

        return currentUsage + additionalAmount < limit;
      }),

    enforceLimit: (organizationId, resource, additionalAmount = 0) =>
      Effect.gen(function* () {
        const subscription = yield* billingRepo.getSubscription(organizationId);
        const limits = subscription.plan.limits;

        const limit = limits[resource as keyof PlanLimits];
        if (limit === -1) return; // Unlimited

        let currentUsage: number;

        switch (resource) {
          case "members": {
            currentUsage = yield* billingRepo.getMemberCount(organizationId);
            break;
          }
          case "videos": {
            currentUsage = yield* billingRepo.getVideoCount(organizationId);
            break;
          }
          case "storage":
          case "bandwidth":
          case "ai_requests": {
            const usage = yield* billingRepo.getCurrentUsage(organizationId);
            currentUsage =
              resource === "storage"
                ? usage.storageUsed
                : resource === "bandwidth"
                  ? usage.bandwidthUsed
                  : usage.aiRequests;
            break;
          }
          default:
            return;
        }

        if (currentUsage + additionalAmount >= limit) {
          return yield* Effect.fail(
            new PlanLimitExceededError({
              message: `You have reached your ${resource} limit. Please upgrade your plan.`,
              resource,
              currentUsage,
              limit,
            }),
          );
        }
      }),

    getFeatureAccess: (organizationId, feature) =>
      Effect.gen(function* () {
        const subscription = yield* billingRepo.getSubscription(organizationId);
        const features = subscription.plan.features;
        return features[feature] ?? false;
      }),

    getPlans: () => billingRepo.getPlans(),

    getPlan: (planId) => billingRepo.getPlan(planId),

    // Webhook Handlers
    handleSubscriptionCreated: (stripeSubscription, organizationId) =>
      Effect.gen(function* () {
        const priceId = stripeSubscription.items.data[0]?.price.id;
        if (!priceId) {
          return yield* Effect.fail(
            new PlanNotFoundError({
              message: "No price ID in subscription",
              planId: "unknown",
            }),
          );
        }

        const plan = yield* billingRepo.getPlanByStripePrice(priceId);

        const subscriptionData: NewSubscription = {
          organizationId,
          planId: plan.id,
          stripeSubscriptionId: stripeSubscription.id,
          stripeCustomerId: stripeSubscription.customer as string,
          status: mapStripeStatus(stripeSubscription.status),
          currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          trialStart: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : null,
          trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
        };

        // Check if subscription exists
        const existingSubscription = yield* billingRepo.getSubscriptionOption(organizationId);

        if (Option.isSome(existingSubscription)) {
          return yield* billingRepo.updateSubscription(organizationId, subscriptionData);
        }

        return yield* billingRepo.createSubscription(subscriptionData);
      }),

    handleSubscriptionUpdated: (stripeSubscription) =>
      Effect.gen(function* () {
        const subscription = yield* billingRepo
          .getSubscriptionByStripeId(stripeSubscription.id)
          .pipe(Effect.mapError(() => new DatabaseError({ message: "Subscription not found" })));

        const priceId = stripeSubscription.items.data[0]?.price.id;
        let planId = subscription.planId;

        if (priceId) {
          const planResult = yield* billingRepo.getPlanByStripePrice(priceId).pipe(Effect.option);
          if (Option.isSome(planResult)) {
            planId = planResult.value.id;
          }
        }

        return yield* billingRepo.updateSubscription(subscription.organizationId, {
          planId,
          status: mapStripeStatus(stripeSubscription.status),
          currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          canceledAt: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000) : null,
        });
      }),

    handleSubscriptionDeleted: (stripeSubscription) =>
      Effect.gen(function* () {
        const subscription = yield* billingRepo
          .getSubscriptionByStripeId(stripeSubscription.id)
          .pipe(Effect.mapError(() => new DatabaseError({ message: "Subscription not found" })));

        // Instead of deleting, downgrade to free plan
        yield* billingRepo.updateSubscription(subscription.organizationId, {
          planId: "free",
          status: "canceled",
          stripeSubscriptionId: null,
          canceledAt: new Date(),
        });
      }),

    handleInvoicePaid: (stripeInvoice) =>
      Effect.gen(function* () {
        if (!stripeInvoice.subscription) return;

        const subscription = yield* billingRepo
          .getSubscriptionByStripeId(stripeInvoice.subscription as string)
          .pipe(Effect.option);

        if (Option.isNone(subscription)) return;

        const invoiceData: NewInvoice = {
          organizationId: subscription.value.organizationId,
          stripeInvoiceId: stripeInvoice.id,
          stripePaymentIntentId: stripeInvoice.payment_intent as string,
          amount: stripeInvoice.amount_due,
          amountPaid: stripeInvoice.amount_paid,
          currency: stripeInvoice.currency,
          status: mapStripeInvoiceStatus(stripeInvoice.status),
          pdfUrl: stripeInvoice.invoice_pdf ?? undefined,
          hostedInvoiceUrl: stripeInvoice.hosted_invoice_url ?? undefined,
          periodStart: stripeInvoice.period_start ? new Date(stripeInvoice.period_start * 1000) : undefined,
          periodEnd: stripeInvoice.period_end ? new Date(stripeInvoice.period_end * 1000) : undefined,
          paidAt: new Date(),
        };

        // Try to update existing or create new
        const existingInvoice = yield* billingRepo.getInvoiceByStripeId(stripeInvoice.id).pipe(Effect.option);

        if (Option.isSome(existingInvoice)) {
          yield* billingRepo.updateInvoice(stripeInvoice.id, invoiceData);
        } else {
          yield* billingRepo.createInvoice(invoiceData);
        }

        // Update subscription status if needed
        yield* billingRepo.updateSubscription(subscription.value.organizationId, {
          status: "active",
        });
      }),

    handleInvoiceFailed: (stripeInvoice) =>
      Effect.gen(function* () {
        if (!stripeInvoice.subscription) return;

        const subscription = yield* billingRepo
          .getSubscriptionByStripeId(stripeInvoice.subscription as string)
          .pipe(Effect.option);

        if (Option.isNone(subscription)) return;

        // Update subscription status
        yield* billingRepo.updateSubscription(subscription.value.organizationId, {
          status: "past_due",
        });
      }),

    handlePaymentMethodAttached: (paymentMethod, organizationId) =>
      Effect.gen(function* () {
        const paymentMethodData: NewPaymentMethod = {
          organizationId,
          stripePaymentMethodId: paymentMethod.id,
          type: paymentMethod.type,
          brand: paymentMethod.card?.brand,
          last4: paymentMethod.card?.last4,
          expMonth: paymentMethod.card?.exp_month,
          expYear: paymentMethod.card?.exp_year,
          isDefault: false,
        };

        yield* billingRepo.createPaymentMethod(paymentMethodData);
      }),

    handlePaymentMethodDetached: (paymentMethodId) => billingRepo.deletePaymentMethod(paymentMethodId),
  };

  return service;
});

// =============================================================================
// Service Layer
// =============================================================================

export const BillingLive = Layer.effect(Billing, makeBillingService);

// =============================================================================
// Helper Effects
// =============================================================================

export const createCheckoutSession = (params: CreateCheckoutParams) =>
  Effect.flatMap(Billing, (billing) => billing.createCheckoutSession(params));

export const createPortalSession = (organizationId: string, returnUrl: string) =>
  Effect.flatMap(Billing, (billing) => billing.createPortalSession(organizationId, returnUrl));

export const cancelSubscription = (organizationId: string) =>
  Effect.flatMap(Billing, (billing) => billing.cancelSubscription(organizationId));

export const resumeSubscription = (organizationId: string) =>
  Effect.flatMap(Billing, (billing) => billing.resumeSubscription(organizationId));

export const changePlan = (organizationId: string, newPlanId: string, billingPeriod: "monthly" | "yearly") =>
  Effect.flatMap(Billing, (billing) => billing.changePlan(organizationId, newPlanId, billingPeriod));

export const checkLimit = (organizationId: string, resource: LimitResource, additionalAmount?: number) =>
  Effect.flatMap(Billing, (billing) => billing.checkLimit(organizationId, resource, additionalAmount));

export const enforceLimit = (organizationId: string, resource: LimitResource, additionalAmount?: number) =>
  Effect.flatMap(Billing, (billing) => billing.enforceLimit(organizationId, resource, additionalAmount));

export const getFeatureAccess = (organizationId: string, feature: keyof Plan["features"]) =>
  Effect.flatMap(Billing, (billing) => billing.getFeatureAccess(organizationId, feature));
