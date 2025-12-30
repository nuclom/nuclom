/**
 * Billing Repository Service using Effect-TS
 *
 * Provides database operations for billing-related entities.
 */

import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { Context, Effect, Layer, Option } from "effect";
import * as schema from "@/lib/db/schema";
import {
  type Invoice,
  invoices,
  members,
  type NewInvoice,
  type NewPaymentMethod,
  type NewSubscription,
  type NewUsage,
  type PaymentMethod,
  type Plan,
  type PlanFeatures,
  type PlanLimits,
  paymentMethods,
  plans,
  type Subscription,
  subscriptions,
  type Usage,
  usage,
  videos,
} from "@/lib/db/schema";
import { DatabaseError, NoSubscriptionError, NotFoundError, PlanNotFoundError, UsageTrackingError } from "../errors";
import { Database, type DrizzleDB } from "./database";

// =============================================================================
// Types
// =============================================================================

export interface SubscriptionWithPlan extends Subscription {
  plan: Plan;
}

export interface OrganizationBillingInfo {
  subscription: SubscriptionWithPlan | null;
  usage: Usage | null;
  invoices: Invoice[];
  paymentMethods: PaymentMethod[];
}

export interface UsageSummary {
  storageUsed: number;
  videosUploaded: number;
  bandwidthUsed: number;
  aiRequests: number;
  limits: PlanLimits;
  percentages: {
    storage: number;
    videos: number;
    bandwidth: number;
    aiRequests: number;
  };
}

// =============================================================================
// Service Interface
// =============================================================================

export interface BillingRepositoryService {
  // Plans
  readonly getPlans: () => Effect.Effect<Plan[], DatabaseError>;
  readonly getPlan: (planId: string) => Effect.Effect<Plan, PlanNotFoundError | DatabaseError>;
  readonly getPlanByStripePrice: (stripePriceId: string) => Effect.Effect<Plan, PlanNotFoundError | DatabaseError>;

  // Subscriptions
  readonly getSubscription: (
    organizationId: string,
  ) => Effect.Effect<SubscriptionWithPlan, NoSubscriptionError | DatabaseError>;
  readonly getSubscriptionOption: (
    organizationId: string,
  ) => Effect.Effect<Option.Option<SubscriptionWithPlan>, DatabaseError>;
  readonly createSubscription: (data: NewSubscription) => Effect.Effect<Subscription, DatabaseError>;
  readonly updateSubscription: (
    organizationId: string,
    data: Partial<NewSubscription>,
  ) => Effect.Effect<Subscription, DatabaseError>;
  readonly getSubscriptionByStripeId: (
    stripeSubscriptionId: string,
  ) => Effect.Effect<SubscriptionWithPlan, NotFoundError | DatabaseError>;

  // Usage
  readonly getCurrentUsage: (organizationId: string) => Effect.Effect<Usage, DatabaseError>;
  readonly getOrCreateCurrentUsage: (organizationId: string) => Effect.Effect<Usage, DatabaseError>;
  readonly incrementUsage: (
    organizationId: string,
    field: "storageUsed" | "videosUploaded" | "bandwidthUsed" | "aiRequests",
    amount: number,
  ) => Effect.Effect<Usage, UsageTrackingError>;
  readonly decrementUsage: (
    organizationId: string,
    field: "storageUsed" | "videosUploaded",
    amount: number,
  ) => Effect.Effect<Usage, UsageTrackingError>;
  readonly getUsageSummary: (
    organizationId: string,
  ) => Effect.Effect<UsageSummary, NoSubscriptionError | DatabaseError>;
  readonly getUsageHistory: (organizationId: string, months: number) => Effect.Effect<Usage[], DatabaseError>;

  // Invoices
  readonly createInvoice: (data: NewInvoice) => Effect.Effect<Invoice, DatabaseError>;
  readonly updateInvoice: (stripeInvoiceId: string, data: Partial<NewInvoice>) => Effect.Effect<Invoice, DatabaseError>;
  readonly getInvoices: (organizationId: string, limit?: number) => Effect.Effect<Invoice[], DatabaseError>;
  readonly getInvoice: (invoiceId: string) => Effect.Effect<Invoice, NotFoundError | DatabaseError>;
  readonly getInvoiceByStripeId: (stripeInvoiceId: string) => Effect.Effect<Invoice, NotFoundError | DatabaseError>;

  // Payment Methods
  readonly createPaymentMethod: (data: NewPaymentMethod) => Effect.Effect<PaymentMethod, DatabaseError>;
  readonly getPaymentMethods: (organizationId: string) => Effect.Effect<PaymentMethod[], DatabaseError>;
  readonly deletePaymentMethod: (stripePaymentMethodId: string) => Effect.Effect<void, DatabaseError>;
  readonly setDefaultPaymentMethod: (
    organizationId: string,
    stripePaymentMethodId: string,
  ) => Effect.Effect<void, DatabaseError>;

  // Billing Info
  readonly getBillingInfo: (organizationId: string) => Effect.Effect<OrganizationBillingInfo, DatabaseError>;

  // Limits checking
  readonly getMemberCount: (organizationId: string) => Effect.Effect<number, DatabaseError>;
  readonly getStorageUsed: (organizationId: string) => Effect.Effect<number, DatabaseError>;
  readonly getVideoCount: (organizationId: string) => Effect.Effect<number, DatabaseError>;
}

// =============================================================================
// Service Tag
// =============================================================================

export class BillingRepository extends Context.Tag("BillingRepository")<
  BillingRepository,
  BillingRepositoryService
>() {}

// =============================================================================
// Helper Functions
// =============================================================================

const getCurrentPeriod = () => {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { periodStart, periodEnd };
};

const calculatePercentage = (used: number, limit: number): number => {
  if (limit === -1) return 0; // Unlimited
  if (limit === 0) return 100;
  return Math.min(Math.round((used / limit) * 100), 100);
};

// =============================================================================
// Service Implementation
// =============================================================================

const makeBillingRepository = (db: DrizzleDB): BillingRepositoryService => ({
  // Plans
  getPlans: () =>
    Effect.tryPromise({
      try: () =>
        db.query.plans.findMany({
          where: eq(plans.isActive, true),
          orderBy: plans.sortOrder,
        }),
      catch: (error) =>
        new DatabaseError({
          message: "Failed to get plans",
          operation: "getPlans",
          cause: error,
        }),
    }),

  getPlan: (planId) =>
    Effect.gen(function* () {
      const plan = yield* Effect.tryPromise({
        try: () =>
          db.query.plans.findFirst({
            where: eq(plans.id, planId),
          }),
        catch: (error) =>
          new DatabaseError({
            message: "Failed to get plan",
            operation: "getPlan",
            cause: error,
          }),
      });

      if (!plan) {
        return yield* Effect.fail(
          new PlanNotFoundError({
            message: `Plan not found: ${planId}`,
            planId,
          }),
        );
      }

      return plan;
    }),

  getPlanByStripePrice: (stripePriceId) =>
    Effect.gen(function* () {
      const plan = yield* Effect.tryPromise({
        try: () =>
          db.query.plans.findFirst({
            where: (table, { or, eq }) =>
              or(eq(table.stripePriceIdMonthly, stripePriceId), eq(table.stripePriceIdYearly, stripePriceId)),
          }),
        catch: (error) =>
          new DatabaseError({
            message: "Failed to get plan by Stripe price",
            operation: "getPlanByStripePrice",
            cause: error,
          }),
      });

      if (!plan) {
        return yield* Effect.fail(
          new PlanNotFoundError({
            message: `Plan not found for Stripe price: ${stripePriceId}`,
            planId: stripePriceId,
          }),
        );
      }

      return plan;
    }),

  // Subscriptions
  getSubscription: (organizationId) =>
    Effect.gen(function* () {
      const subscription = yield* Effect.tryPromise({
        try: () =>
          db.query.subscriptions.findFirst({
            where: eq(subscriptions.organizationId, organizationId),
            with: {
              plan: true,
            },
          }),
        catch: (error) =>
          new DatabaseError({
            message: "Failed to get subscription",
            operation: "getSubscription",
            cause: error,
          }),
      });

      if (!subscription) {
        return yield* Effect.fail(
          new NoSubscriptionError({
            message: "Organization has no subscription",
            organizationId,
          }),
        );
      }

      return subscription as SubscriptionWithPlan;
    }),

  getSubscriptionOption: (organizationId) =>
    Effect.gen(function* () {
      const subscription = yield* Effect.tryPromise({
        try: () =>
          db.query.subscriptions.findFirst({
            where: eq(subscriptions.organizationId, organizationId),
            with: {
              plan: true,
            },
          }),
        catch: (error) =>
          new DatabaseError({
            message: "Failed to get subscription",
            operation: "getSubscriptionOption",
            cause: error,
          }),
      });

      return subscription ? Option.some(subscription as SubscriptionWithPlan) : Option.none();
    }),

  createSubscription: (data) =>
    Effect.tryPromise({
      try: async () => {
        const [subscription] = await db.insert(subscriptions).values(data).returning();
        return subscription;
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to create subscription",
          operation: "createSubscription",
          cause: error,
        }),
    }),

  updateSubscription: (organizationId, data) =>
    Effect.tryPromise({
      try: async () => {
        const [subscription] = await db
          .update(subscriptions)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(subscriptions.organizationId, organizationId))
          .returning();
        return subscription;
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to update subscription",
          operation: "updateSubscription",
          cause: error,
        }),
    }),

  getSubscriptionByStripeId: (stripeSubscriptionId) =>
    Effect.gen(function* () {
      const subscription = yield* Effect.tryPromise({
        try: () =>
          db.query.subscriptions.findFirst({
            where: eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId),
            with: {
              plan: true,
            },
          }),
        catch: (error) =>
          new DatabaseError({
            message: "Failed to get subscription by Stripe ID",
            operation: "getSubscriptionByStripeId",
            cause: error,
          }),
      });

      if (!subscription) {
        return yield* Effect.fail(
          new NotFoundError({
            message: "Subscription not found",
            entity: "Subscription",
            id: stripeSubscriptionId,
          }),
        );
      }

      return subscription as SubscriptionWithPlan;
    }),

  // Usage
  getCurrentUsage: (organizationId) =>
    Effect.gen(function* () {
      const { periodStart, periodEnd } = getCurrentPeriod();

      const usageRecord = yield* Effect.tryPromise({
        try: () =>
          db.query.usage.findFirst({
            where: and(
              eq(usage.organizationId, organizationId),
              gte(usage.periodStart, periodStart),
              lte(usage.periodEnd, periodEnd),
            ),
          }),
        catch: (error) =>
          new DatabaseError({
            message: "Failed to get current usage",
            operation: "getCurrentUsage",
            cause: error,
          }),
      });

      if (!usageRecord) {
        // Return empty usage if not found
        return {
          id: "",
          organizationId,
          periodStart,
          periodEnd,
          storageUsed: 0,
          videosUploaded: 0,
          bandwidthUsed: 0,
          aiRequests: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        } satisfies Usage;
      }

      return usageRecord;
    }),

  getOrCreateCurrentUsage: (organizationId) =>
    Effect.gen(function* () {
      const { periodStart, periodEnd } = getCurrentPeriod();

      const existingUsage = yield* Effect.tryPromise({
        try: () =>
          db.query.usage.findFirst({
            where: and(eq(usage.organizationId, organizationId), eq(usage.periodStart, periodStart)),
          }),
        catch: (error) =>
          new DatabaseError({
            message: "Failed to get current usage",
            operation: "getOrCreateCurrentUsage",
            cause: error,
          }),
      });

      if (existingUsage) {
        return existingUsage;
      }

      // Create new usage record
      const [newUsage] = yield* Effect.tryPromise({
        try: () =>
          db
            .insert(usage)
            .values({
              organizationId,
              periodStart,
              periodEnd,
              storageUsed: 0,
              videosUploaded: 0,
              bandwidthUsed: 0,
              aiRequests: 0,
            })
            .returning(),
        catch: (error) =>
          new DatabaseError({
            message: "Failed to create usage record",
            operation: "getOrCreateCurrentUsage",
            cause: error,
          }),
      });

      return newUsage;
    }),

  incrementUsage: (organizationId, field, amount) =>
    Effect.gen(function* () {
      const currentUsage = yield* makeBillingRepository(db)
        .getOrCreateCurrentUsage(organizationId)
        .pipe(
          Effect.mapError(
            (error) =>
              new UsageTrackingError({
                message: "Failed to get current usage",
                organizationId,
                cause: error,
              }),
          ),
        );

      const [updatedUsage] = yield* Effect.tryPromise({
        try: () =>
          db
            .update(usage)
            .set({
              [field]: sql`${usage[field]} + ${amount}`,
              updatedAt: new Date(),
            })
            .where(eq(usage.id, currentUsage.id))
            .returning(),
        catch: (error) =>
          new UsageTrackingError({
            message: `Failed to increment ${field}`,
            organizationId,
            cause: error,
          }),
      });

      return updatedUsage;
    }),

  decrementUsage: (organizationId, field, amount) =>
    Effect.gen(function* () {
      const currentUsage = yield* makeBillingRepository(db)
        .getOrCreateCurrentUsage(organizationId)
        .pipe(
          Effect.mapError(
            (error) =>
              new UsageTrackingError({
                message: "Failed to get current usage",
                organizationId,
                cause: error,
              }),
          ),
        );

      const [updatedUsage] = yield* Effect.tryPromise({
        try: () =>
          db
            .update(usage)
            .set({
              [field]: sql`GREATEST(0, ${usage[field]} - ${amount})`,
              updatedAt: new Date(),
            })
            .where(eq(usage.id, currentUsage.id))
            .returning(),
        catch: (error) =>
          new UsageTrackingError({
            message: `Failed to decrement ${field}`,
            organizationId,
            cause: error,
          }),
      });

      return updatedUsage;
    }),

  getUsageSummary: (organizationId) =>
    Effect.gen(function* () {
      const subscription = yield* makeBillingRepository(db).getSubscription(organizationId);
      const currentUsage = yield* makeBillingRepository(db).getCurrentUsage(organizationId);

      const limits = subscription.plan.limits;

      return {
        storageUsed: currentUsage.storageUsed,
        videosUploaded: currentUsage.videosUploaded,
        bandwidthUsed: currentUsage.bandwidthUsed,
        aiRequests: currentUsage.aiRequests,
        limits,
        percentages: {
          storage: calculatePercentage(currentUsage.storageUsed, limits.storage),
          videos: calculatePercentage(currentUsage.videosUploaded, limits.videos),
          bandwidth: calculatePercentage(currentUsage.bandwidthUsed, limits.bandwidth),
          aiRequests: calculatePercentage(currentUsage.aiRequests, 1000), // AI requests limit per month
        },
      };
    }),

  getUsageHistory: (organizationId, months) =>
    Effect.tryPromise({
      try: () => {
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - months);

        return db.query.usage.findMany({
          where: and(eq(usage.organizationId, organizationId), gte(usage.periodStart, startDate)),
          orderBy: desc(usage.periodStart),
        });
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to get usage history",
          operation: "getUsageHistory",
          cause: error,
        }),
    }),

  // Invoices
  createInvoice: (data) =>
    Effect.tryPromise({
      try: async () => {
        const [invoice] = await db.insert(invoices).values(data).returning();
        return invoice;
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to create invoice",
          operation: "createInvoice",
          cause: error,
        }),
    }),

  updateInvoice: (stripeInvoiceId, data) =>
    Effect.tryPromise({
      try: async () => {
        const [invoice] = await db
          .update(invoices)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(invoices.stripeInvoiceId, stripeInvoiceId))
          .returning();
        return invoice;
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to update invoice",
          operation: "updateInvoice",
          cause: error,
        }),
    }),

  getInvoices: (organizationId, limit = 12) =>
    Effect.tryPromise({
      try: () =>
        db.query.invoices.findMany({
          where: eq(invoices.organizationId, organizationId),
          orderBy: desc(invoices.createdAt),
          limit,
        }),
      catch: (error) =>
        new DatabaseError({
          message: "Failed to get invoices",
          operation: "getInvoices",
          cause: error,
        }),
    }),

  getInvoice: (invoiceId) =>
    Effect.gen(function* () {
      const invoice = yield* Effect.tryPromise({
        try: () =>
          db.query.invoices.findFirst({
            where: eq(invoices.id, invoiceId),
          }),
        catch: (error) =>
          new DatabaseError({
            message: "Failed to get invoice",
            operation: "getInvoice",
            cause: error,
          }),
      });

      if (!invoice) {
        return yield* Effect.fail(
          new NotFoundError({
            message: "Invoice not found",
            entity: "Invoice",
            id: invoiceId,
          }),
        );
      }

      return invoice;
    }),

  getInvoiceByStripeId: (stripeInvoiceId) =>
    Effect.gen(function* () {
      const invoice = yield* Effect.tryPromise({
        try: () =>
          db.query.invoices.findFirst({
            where: eq(invoices.stripeInvoiceId, stripeInvoiceId),
          }),
        catch: (error) =>
          new DatabaseError({
            message: "Failed to get invoice by Stripe ID",
            operation: "getInvoiceByStripeId",
            cause: error,
          }),
      });

      if (!invoice) {
        return yield* Effect.fail(
          new NotFoundError({
            message: "Invoice not found",
            entity: "Invoice",
            id: stripeInvoiceId,
          }),
        );
      }

      return invoice;
    }),

  // Payment Methods
  createPaymentMethod: (data) =>
    Effect.tryPromise({
      try: async () => {
        const [paymentMethod] = await db.insert(paymentMethods).values(data).returning();
        return paymentMethod;
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to create payment method",
          operation: "createPaymentMethod",
          cause: error,
        }),
    }),

  getPaymentMethods: (organizationId) =>
    Effect.tryPromise({
      try: () =>
        db.query.paymentMethods.findMany({
          where: eq(paymentMethods.organizationId, organizationId),
          orderBy: desc(paymentMethods.isDefault),
        }),
      catch: (error) =>
        new DatabaseError({
          message: "Failed to get payment methods",
          operation: "getPaymentMethods",
          cause: error,
        }),
    }),

  deletePaymentMethod: (stripePaymentMethodId) =>
    Effect.tryPromise({
      try: async () => {
        await db.delete(paymentMethods).where(eq(paymentMethods.stripePaymentMethodId, stripePaymentMethodId));
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to delete payment method",
          operation: "deletePaymentMethod",
          cause: error,
        }),
    }),

  setDefaultPaymentMethod: (organizationId, stripePaymentMethodId) =>
    Effect.tryPromise({
      try: async () => {
        // First, unset all defaults for this org
        await db
          .update(paymentMethods)
          .set({ isDefault: false })
          .where(eq(paymentMethods.organizationId, organizationId));

        // Then set the new default
        await db
          .update(paymentMethods)
          .set({ isDefault: true })
          .where(eq(paymentMethods.stripePaymentMethodId, stripePaymentMethodId));
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to set default payment method",
          operation: "setDefaultPaymentMethod",
          cause: error,
        }),
    }),

  // Billing Info
  getBillingInfo: (organizationId) =>
    Effect.gen(function* () {
      const repo = makeBillingRepository(db);

      const subscriptionOption = yield* repo.getSubscriptionOption(organizationId);
      const subscription = Option.getOrNull(subscriptionOption);

      const [currentUsage, invoiceList, paymentMethodsList] = yield* Effect.all([
        repo.getCurrentUsage(organizationId),
        repo.getInvoices(organizationId, 12),
        repo.getPaymentMethods(organizationId),
      ]);

      return {
        subscription,
        usage: currentUsage.id ? currentUsage : null,
        invoices: invoiceList,
        paymentMethods: paymentMethodsList,
      };
    }),

  // Limits checking
  getMemberCount: (organizationId) =>
    Effect.tryPromise({
      try: async () => {
        const result = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(members)
          .where(eq(members.organizationId, organizationId));
        return result[0]?.count ?? 0;
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to get member count",
          operation: "getMemberCount",
          cause: error,
        }),
    }),

  getStorageUsed: (organizationId) =>
    Effect.gen(function* () {
      const currentUsage = yield* makeBillingRepository(db).getCurrentUsage(organizationId);
      return currentUsage.storageUsed;
    }),

  getVideoCount: (organizationId) =>
    Effect.tryPromise({
      try: async () => {
        const result = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(videos)
          .where(eq(videos.organizationId, organizationId));
        return result[0]?.count ?? 0;
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to get video count",
          operation: "getVideoCount",
          cause: error,
        }),
    }),
});

// =============================================================================
// Service Layer
// =============================================================================

export const BillingRepositoryLive = Layer.effect(
  BillingRepository,
  Effect.gen(function* () {
    const { db } = yield* Database;
    return makeBillingRepository(db);
  }),
);

// =============================================================================
// Helper Effects
// =============================================================================

export const getPlans = Effect.flatMap(BillingRepository, (repo) => repo.getPlans());

export const getPlan = (planId: string) => Effect.flatMap(BillingRepository, (repo) => repo.getPlan(planId));

export const getSubscription = (organizationId: string) =>
  Effect.flatMap(BillingRepository, (repo) => repo.getSubscription(organizationId));

export const getSubscriptionOption = (organizationId: string) =>
  Effect.flatMap(BillingRepository, (repo) => repo.getSubscriptionOption(organizationId));

export const getCurrentUsage = (organizationId: string) =>
  Effect.flatMap(BillingRepository, (repo) => repo.getCurrentUsage(organizationId));

export const getUsageSummary = (organizationId: string) =>
  Effect.flatMap(BillingRepository, (repo) => repo.getUsageSummary(organizationId));

export const incrementUsage = (
  organizationId: string,
  field: "storageUsed" | "videosUploaded" | "bandwidthUsed" | "aiRequests",
  amount: number,
) => Effect.flatMap(BillingRepository, (repo) => repo.incrementUsage(organizationId, field, amount));

export const decrementUsage = (organizationId: string, field: "storageUsed" | "videosUploaded", amount: number) =>
  Effect.flatMap(BillingRepository, (repo) => repo.decrementUsage(organizationId, field, amount));

export const getBillingInfo = (organizationId: string) =>
  Effect.flatMap(BillingRepository, (repo) => repo.getBillingInfo(organizationId));

export const getInvoices = (organizationId: string, limit?: number) =>
  Effect.flatMap(BillingRepository, (repo) => repo.getInvoices(organizationId, limit));

export const getMemberCount = (organizationId: string) =>
  Effect.flatMap(BillingRepository, (repo) => repo.getMemberCount(organizationId));

export const getVideoCount = (organizationId: string) =>
  Effect.flatMap(BillingRepository, (repo) => repo.getVideoCount(organizationId));
