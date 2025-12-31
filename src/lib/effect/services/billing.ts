/**
 * Billing Service using Effect-TS
 *
 * High-level billing operations that coordinate between Stripe and the database.
 */

import { eq } from "drizzle-orm";
import { Context, Effect, Layer, Option } from "effect";
import type Stripe from "stripe";
import {
  type InvoiceStatus,
  type NewInvoice,
  type NewPaymentMethod,
  type NewSubscription,
  notifications,
  organizations,
  type Plan,
  type PlanLimits,
  type Subscription,
  type SubscriptionStatus,
} from "@/lib/db/schema";
import { env } from "@/lib/env/client";
import {
  DatabaseError,
  NoSubscriptionError,
  PlanLimitExceededError,
  PlanNotFoundError,
  type StripeApiError,
  SubscriptionError,
} from "../errors";
import {
  BillingRepository,
  type OrganizationBillingInfo,
  type SubscriptionWithPlan,
  type UsageSummary,
} from "./billing-repository";
import { Database } from "./database";
import { EmailNotifications } from "./email-notifications";
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
  const { db } = yield* Database;
  const emailService = yield* EmailNotifications;

  const sendSubscriptionNotifications = (
    organizationId: string,
    eventType: "created" | "updated" | "canceled" | "payment_failed" | "payment_succeeded",
    planName?: string,
  ) =>
    Effect.gen(function* () {
      const baseUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

      // Get organization
      const org = yield* Effect.tryPromise({
        try: () =>
          db.query.organizations.findFirst({
            where: eq(organizations.id, organizationId),
          }),
        catch: () => new Error("Failed to get organization"),
      });

      if (!org) return;

      // Get organization owners
      const ownerMembers = yield* Effect.tryPromise({
        try: () =>
          db.query.members.findMany({
            where: (m, { and, eq: colEq }) => and(colEq(m.organizationId, organizationId), colEq(m.role, "owner")),
            with: { user: true },
          }),
        catch: () => new Error("Failed to get organization members"),
      });

      const notificationTitles = {
        created: "Subscription activated",
        updated: "Subscription updated",
        canceled: "Subscription canceled",
        payment_failed: "Payment failed",
        payment_succeeded: "Payment successful",
      };

      const notificationBodies = {
        created: `Your subscription to ${planName || "Nuclom Pro"} is now active.`,
        updated: `Your subscription has been updated${planName ? ` to ${planName}` : ""}.`,
        canceled: `Your subscription for ${org.name} has been canceled and will remain active until the end of the billing period.`,
        payment_failed: `We couldn't process your payment for ${org.name}. Please update your payment method.`,
        payment_succeeded: `Your payment for ${org.name} was processed successfully.`,
      };

      const notificationType =
        eventType === "payment_failed"
          ? "payment_failed"
          : eventType === "payment_succeeded"
            ? "payment_succeeded"
            : eventType === "canceled"
              ? "subscription_canceled"
              : eventType === "updated"
                ? "subscription_updated"
                : "subscription_created";

      for (const member of ownerMembers) {
        const user = (member as { user: { id: string; email: string; name: string } }).user;
        if (!user?.email) continue;

        // Create in-app notification
        yield* Effect.tryPromise({
          try: () =>
            db.insert(notifications).values({
              userId: user.id,
              type: notificationType,
              title: notificationTitles[eventType],
              body: notificationBodies[eventType],
              resourceType: "subscription",
              resourceId: organizationId,
            }),
          catch: () => new Error("Failed to create notification"),
        }).pipe(Effect.catchAll(() => Effect.succeed(undefined)));

        // Send email notification
        yield* emailService
          .sendSubscriptionNotification({
            recipientEmail: user.email,
            recipientName: user.name || "there",
            organizationName: org.name,
            eventType,
            planName,
            billingUrl: `${baseUrl}/${org.slug}/settings/billing`,
          })
          .pipe(Effect.catchAll(() => Effect.succeed(undefined)));
      }
    }).pipe(Effect.catchAll(() => Effect.succeed(undefined)));

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

        // Cast to access snake_case properties (Stripe API uses snake_case but types may vary)
        const sub = stripeSubscription as unknown as {
          current_period_start: number;
          current_period_end: number;
          cancel_at_period_end: boolean;
          trial_start: number | null;
          trial_end: number | null;
        };
        const subscriptionData: NewSubscription = {
          organizationId,
          planId: plan.id,
          stripeSubscriptionId: stripeSubscription.id,
          stripeCustomerId: stripeSubscription.customer as string,
          status: mapStripeStatus(stripeSubscription.status),
          currentPeriodStart: new Date(sub.current_period_start * 1000),
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          trialStart: sub.trial_start ? new Date(sub.trial_start * 1000) : null,
          trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
        };

        // Check if subscription exists
        const existingSubscription = yield* billingRepo.getSubscriptionOption(organizationId);

        let result: Subscription;
        if (Option.isSome(existingSubscription)) {
          result = yield* billingRepo.updateSubscription(organizationId, subscriptionData);
        } else {
          result = yield* billingRepo.createSubscription(subscriptionData);
        }

        // Send subscription created notification
        yield* sendSubscriptionNotifications(organizationId, "created", plan.name);

        return result;
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

        // Cast to access snake_case properties
        const sub = stripeSubscription as unknown as {
          current_period_start: number;
          current_period_end: number;
          cancel_at_period_end: boolean;
          canceled_at: number | null;
        };
        const result = yield* billingRepo.updateSubscription(subscription.organizationId, {
          planId,
          status: mapStripeStatus(stripeSubscription.status),
          currentPeriodStart: new Date(sub.current_period_start * 1000),
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
        });

        // Get plan name for notification
        const planResult = yield* billingRepo.getPlan(planId).pipe(Effect.option);
        const planName = Option.isSome(planResult) ? planResult.value.name : undefined;

        // Send subscription updated notification
        yield* sendSubscriptionNotifications(subscription.organizationId, "updated", planName);

        return result;
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

        // Send subscription canceled notification
        yield* sendSubscriptionNotifications(subscription.organizationId, "canceled");
      }),

    handleInvoicePaid: (stripeInvoice) =>
      Effect.gen(function* () {
        // Cast to access snake_case properties
        const inv = stripeInvoice as unknown as {
          subscription: string | { id: string } | null;
          payment_intent: string | { id: string } | null;
          amount_due: number;
          amount_paid: number;
          invoice_pdf: string | null;
          hosted_invoice_url: string | null;
          period_start: number | null;
          period_end: number | null;
        };
        const subscriptionId = typeof inv.subscription === "string" ? inv.subscription : inv.subscription?.id;
        if (!subscriptionId) return;

        const subscription = yield* billingRepo.getSubscriptionByStripeId(subscriptionId).pipe(Effect.option);

        if (Option.isNone(subscription)) return;

        const paymentIntentId = typeof inv.payment_intent === "string" ? inv.payment_intent : inv.payment_intent?.id;

        const invoiceData: NewInvoice = {
          organizationId: subscription.value.organizationId,
          stripeInvoiceId: stripeInvoice.id,
          stripePaymentIntentId: paymentIntentId ?? null,
          amount: inv.amount_due,
          amountPaid: inv.amount_paid,
          currency: stripeInvoice.currency ?? "usd",
          status: mapStripeInvoiceStatus(stripeInvoice.status),
          pdfUrl: inv.invoice_pdf ?? undefined,
          hostedInvoiceUrl: inv.hosted_invoice_url ?? undefined,
          periodStart: inv.period_start ? new Date(inv.period_start * 1000) : undefined,
          periodEnd: inv.period_end ? new Date(inv.period_end * 1000) : undefined,
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

        // Send payment succeeded notification
        yield* sendSubscriptionNotifications(subscription.value.organizationId, "payment_succeeded");
      }),

    handleInvoiceFailed: (stripeInvoice) =>
      Effect.gen(function* () {
        // Cast to access snake_case properties
        const inv = stripeInvoice as unknown as { subscription: string | { id: string } | null };
        const subscriptionId = typeof inv.subscription === "string" ? inv.subscription : inv.subscription?.id;
        if (!subscriptionId) return;

        const subscription = yield* billingRepo.getSubscriptionByStripeId(subscriptionId).pipe(Effect.option);

        if (Option.isNone(subscription)) return;

        // Update subscription status
        yield* billingRepo.updateSubscription(subscription.value.organizationId, {
          status: "past_due",
        });

        // Send payment failed notification
        yield* sendSubscriptionNotifications(subscription.value.organizationId, "payment_failed");
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
