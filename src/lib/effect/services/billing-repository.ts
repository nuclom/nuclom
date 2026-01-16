/**
 * Billing Repository Service using Effect-TS
 *
 * Provides database operations for billing-related entities.
 */

import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { Context, Effect, Layer, Option } from 'effect';
import {
  type Invoice,
  invoices,
  members,
  type NewInvoice,
  type NewPaymentMethod,
  type NewSubscription,
  type PaymentMethod,
  type Plan,
  type PlanLimits,
  paymentMethods,
  plans,
  type Subscription,
  subscriptions,
  type Usage,
  usage,
  videos,
} from '@/lib/db/schema';
import { DatabaseError, NoSubscriptionError, NotFoundError, PlanNotFoundError, UsageTrackingError } from '../errors';
import { Database, type DrizzleDB } from './database';

// =============================================================================
// Types
// =============================================================================

// Better Auth Stripe compatible subscription with plan info
export interface SubscriptionWithPlan extends Subscription {
  planInfo: Plan | null; // The local plan record if linked
}

export interface OrganizationBillingInfo {
  subscription: SubscriptionWithPlan | null;
  usage: Usage | null;
  invoices: Invoice[];
  paymentMethods: PaymentMethod[];
  planLimits: PlanLimits | null;
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

/**
 * Default plan limits based on plan name (synced with pricing.md)
 *
 * Note: There is no free plan - all users start with a 14-day Scale trial.
 *
 * Scale Plan: $25/user/month
 * - 5 GB storage/user
 * - 25 videos/user/month
 * - 25 team members max
 * - 25 GB bandwidth/month
 * - 60 min AI transcription/user/month
 *
 * Pro Plan: $45/user/month
 * - 25 GB storage/user
 * - 100 videos/user/month
 * - Unlimited team members
 * - 250 GB bandwidth/month
 * - 300 min AI transcription/user/month
 */
const DEFAULT_PLAN_LIMITS: Record<string, PlanLimits> = {
  // Scale Plan - entry tier ($25/user/month) - also used for trials
  scale: {
    storage: 5 * 1024 * 1024 * 1024, // 5GB per user
    videos: 25, // 25 per user per month
    members: 25, // max team members
    bandwidth: 25 * 1024 * 1024 * 1024, // 25GB/month
  },
  // Pro Plan - professional tier ($45/user/month)
  pro: {
    storage: 25 * 1024 * 1024 * 1024, // 25GB per user
    videos: 100, // 100 per user per month
    members: -1, // unlimited
    bandwidth: 250 * 1024 * 1024 * 1024, // 250GB/month
  },
  // Enterprise Plan - custom pricing
  enterprise: {
    storage: -1, // unlimited
    videos: -1, // unlimited
    members: -1, // unlimited
    bandwidth: -1, // unlimited
  },
};

// Get plan limits by plan name - defaults to scale (trial) limits
const getPlanLimitsByName = (planName: string): PlanLimits => {
  const normalizedName = planName.toLowerCase();
  return DEFAULT_PLAN_LIMITS[normalizedName] || DEFAULT_PLAN_LIMITS.scale;
};

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
  readonly createTrialSubscription: (
    organizationId: string,
    trialDays?: number,
  ) => Effect.Effect<Subscription, DatabaseError>;
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
    field: 'storageUsed' | 'videosUploaded' | 'bandwidthUsed' | 'aiRequests',
    amount: number,
  ) => Effect.Effect<Usage, UsageTrackingError>;
  readonly decrementUsage: (
    organizationId: string,
    field: 'storageUsed' | 'videosUploaded',
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

  // Overage tracking
  readonly incrementOverage: (
    organizationId: string,
    field: 'storageOverage' | 'bandwidthOverage' | 'videosOverage' | 'aiRequestsOverage',
    amount: number,
  ) => Effect.Effect<Usage, UsageTrackingError>;
  readonly calculateOverageCharges: (organizationId: string) => Effect.Effect<number, DatabaseError>;
  readonly markOverageReported: (organizationId: string) => Effect.Effect<void, DatabaseError>;
}

// =============================================================================
// Service Tag
// =============================================================================

export class BillingRepository extends Context.Tag('BillingRepository')<
  BillingRepository,
  BillingRepositoryService
>() {}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the current billing period (calendar month) with UTC normalization.
 * Uses UTC to ensure consistent period boundaries across all timezones.
 * This prevents issues where a request at 11:59 PM UTC-12 and one at
 * 12:01 AM UTC+14 might be counted in different periods.
 */
const getCurrentPeriod = () => {
  const now = new Date();

  // Create UTC-normalized start of month (day 1, 00:00:00.000 UTC)
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));

  // Create UTC-normalized end of month (last day, 23:59:59.999 UTC)
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

  return { periodStart, periodEnd };
};

/**
 * Get a specific billing period for a given date with UTC normalization.
 * Useful for historical lookups or testing.
 * @internal Exported for testing purposes
 */
export const getPeriodForDate = (date: Date) => {
  const periodStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
  const periodEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { periodStart, periodEnd };
};

/**
 * Check if a given date falls within the current billing period.
 * @internal Exported for testing purposes
 */
export const isInCurrentPeriod = (date: Date): boolean => {
  const { periodStart, periodEnd } = getCurrentPeriod();
  return date >= periodStart && date <= periodEnd;
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
          message: 'Failed to get plans',
          operation: 'getPlans',
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
            message: 'Failed to get plan',
            operation: 'getPlan',
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
            message: 'Failed to get plan by Stripe price',
            operation: 'getPlanByStripePrice',
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

  // Subscriptions - Updated for Better Auth Stripe compatibility
  // Query by referenceId (organization ID) for active/trialing subscriptions
  getSubscription: (organizationId) =>
    Effect.gen(function* () {
      const subscription = yield* Effect.tryPromise({
        try: () =>
          db.query.subscriptions.findFirst({
            where: and(
              eq(subscriptions.referenceId, organizationId),
              sql`${subscriptions.status} IN ('active', 'trialing')`,
            ),
          }),
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to get subscription',
            operation: 'getSubscription',
            cause: error,
          }),
      });

      if (!subscription) {
        return yield* Effect.fail(
          new NoSubscriptionError({
            message: 'Organization has no active subscription',
            organizationId,
          }),
        );
      }

      // Look up local plan by name to get limits/features
      const localPlan = yield* Effect.tryPromise({
        try: () =>
          db.query.plans.findFirst({
            where: eq(plans.name, subscription.plan),
          }),
        catch: () => null,
      }).pipe(Effect.catchAll(() => Effect.succeed(null)));

      const subscriptionWithPlan: SubscriptionWithPlan = {
        ...subscription,
        planInfo: localPlan ?? null,
      };

      return subscriptionWithPlan;
    }),

  getSubscriptionOption: (organizationId) =>
    Effect.gen(function* () {
      const subscription = yield* Effect.tryPromise({
        try: () =>
          db.query.subscriptions.findFirst({
            where: and(
              eq(subscriptions.referenceId, organizationId),
              sql`${subscriptions.status} IN ('active', 'trialing')`,
            ),
          }),
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to get subscription',
            operation: 'getSubscriptionOption',
            cause: error,
          }),
      });

      if (!subscription) {
        return Option.none();
      }

      // Look up local plan by name to get limits/features
      const localPlan = yield* Effect.tryPromise({
        try: () =>
          db.query.plans.findFirst({
            where: eq(plans.name, subscription.plan),
          }),
        catch: () => null,
      }).pipe(Effect.catchAll(() => Effect.succeed(null)));

      const subscriptionWithPlan: SubscriptionWithPlan = {
        ...subscription,
        planInfo: localPlan ?? null,
      };

      return Option.some(subscriptionWithPlan);
    }),

  createSubscription: (data) =>
    Effect.tryPromise({
      try: async () => {
        const [subscription] = await db.insert(subscriptions).values(data).returning();
        return subscription;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to create subscription',
          operation: 'createSubscription',
          cause: error,
        }),
    }),

  createTrialSubscription: (organizationId, trialDays = 14) =>
    Effect.tryPromise({
      try: async () => {
        const now = new Date();
        const trialEnd = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

        const [subscription] = await db
          .insert(subscriptions)
          .values({
            id: crypto.randomUUID(),
            plan: 'scale', // Trial users get Scale plan features
            referenceId: organizationId,
            status: 'trialing',
            trialStart: now,
            trialEnd: trialEnd,
            periodStart: now,
            periodEnd: trialEnd,
          })
          .returning();
        return subscription;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to create trial subscription',
          operation: 'createTrialSubscription',
          cause: error,
        }),
    }),

  updateSubscription: (organizationId, data) =>
    Effect.tryPromise({
      try: async () => {
        const [subscription] = await db
          .update(subscriptions)
          .set(data)
          .where(eq(subscriptions.referenceId, organizationId))
          .returning();
        return subscription;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to update subscription',
          operation: 'updateSubscription',
          cause: error,
        }),
    }),

  getSubscriptionByStripeId: (stripeSubscriptionId) =>
    Effect.gen(function* () {
      const subscription = yield* Effect.tryPromise({
        try: () =>
          db.query.subscriptions.findFirst({
            where: eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId),
          }),
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to get subscription by Stripe ID',
            operation: 'getSubscriptionByStripeId',
            cause: error,
          }),
      });

      if (!subscription) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Subscription not found',
            entity: 'Subscription',
            id: stripeSubscriptionId,
          }),
        );
      }

      // Look up local plan by name to get limits/features
      const localPlan = yield* Effect.tryPromise({
        try: () =>
          db.query.plans.findFirst({
            where: eq(plans.name, subscription.plan),
          }),
        catch: () => null,
      }).pipe(Effect.catchAll(() => Effect.succeed(null)));

      const subscriptionWithPlan: SubscriptionWithPlan = {
        ...subscription,
        planInfo: localPlan ?? null,
      };

      return subscriptionWithPlan;
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
            message: 'Failed to get current usage',
            operation: 'getCurrentUsage',
            cause: error,
          }),
      });

      if (!usageRecord) {
        // Return empty usage if not found
        return {
          id: '',
          organizationId,
          periodStart,
          periodEnd,
          storageUsed: 0,
          videosUploaded: 0,
          bandwidthUsed: 0,
          aiRequests: 0,
          // Overage fields
          storageOverage: 0,
          bandwidthOverage: 0,
          videosOverage: 0,
          aiRequestsOverage: 0,
          overageCharges: 0,
          overageReportedToStripe: false,
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
            message: 'Failed to get current usage',
            operation: 'getOrCreateCurrentUsage',
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
            message: 'Failed to create usage record',
            operation: 'getOrCreateCurrentUsage',
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
                message: 'Failed to get current usage',
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
                message: 'Failed to get current usage',
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

      // Get limits from local plan or from plan name-based defaults
      const limits = subscription.planInfo?.limits || getPlanLimitsByName(subscription.plan);

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
          message: 'Failed to get usage history',
          operation: 'getUsageHistory',
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
          message: 'Failed to create invoice',
          operation: 'createInvoice',
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
          message: 'Failed to update invoice',
          operation: 'updateInvoice',
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
          message: 'Failed to get invoices',
          operation: 'getInvoices',
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
            message: 'Failed to get invoice',
            operation: 'getInvoice',
            cause: error,
          }),
      });

      if (!invoice) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Invoice not found',
            entity: 'Invoice',
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
            message: 'Failed to get invoice by Stripe ID',
            operation: 'getInvoiceByStripeId',
            cause: error,
          }),
      });

      if (!invoice) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Invoice not found',
            entity: 'Invoice',
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
          message: 'Failed to create payment method',
          operation: 'createPaymentMethod',
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
          message: 'Failed to get payment methods',
          operation: 'getPaymentMethods',
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
          message: 'Failed to delete payment method',
          operation: 'deletePaymentMethod',
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
          message: 'Failed to set default payment method',
          operation: 'setDefaultPaymentMethod',
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

      // Get plan limits from subscription - default to scale (trial) limits if no subscription
      const planLimits = subscription
        ? subscription.planInfo?.limits || getPlanLimitsByName(subscription.plan)
        : getPlanLimitsByName('scale');

      return {
        subscription,
        usage: currentUsage.id ? currentUsage : null,
        invoices: invoiceList,
        paymentMethods: paymentMethodsList,
        planLimits,
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
          message: 'Failed to get member count',
          operation: 'getMemberCount',
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
          message: 'Failed to get video count',
          operation: 'getVideoCount',
          cause: error,
        }),
    }),

  // Overage tracking
  incrementOverage: (organizationId, field, amount) =>
    Effect.gen(function* () {
      const currentUsage = yield* makeBillingRepository(db)
        .getOrCreateCurrentUsage(organizationId)
        .pipe(
          Effect.mapError(
            (error) =>
              new UsageTrackingError({
                message: 'Failed to get current usage for overage tracking',
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
            message: `Failed to increment overage ${field}`,
            organizationId,
            cause: error,
          }),
      });

      return updatedUsage;
    }),

  calculateOverageCharges: (organizationId) =>
    Effect.gen(function* () {
      const repo = makeBillingRepository(db);
      const subscription = yield* repo
        .getSubscription(organizationId)
        .pipe(Effect.catchTag('NoSubscriptionError', () => Effect.succeed(null)));

      if (!subscription?.planInfo?.overageRates) {
        return 0; // No overage rates configured
      }

      const currentUsage = yield* repo.getCurrentUsage(organizationId);
      const rates = subscription.planInfo.overageRates;

      let totalCharges = 0;

      // Calculate storage overage charges (per GB)
      if (rates.storagePerGb && currentUsage.storageOverage > 0) {
        const storageOverageGb = currentUsage.storageOverage / (1024 * 1024 * 1024);
        totalCharges += Math.ceil(storageOverageGb * rates.storagePerGb);
      }

      // Calculate bandwidth overage charges (per GB)
      if (rates.bandwidthPerGb && currentUsage.bandwidthOverage > 0) {
        const bandwidthOverageGb = currentUsage.bandwidthOverage / (1024 * 1024 * 1024);
        totalCharges += Math.ceil(bandwidthOverageGb * rates.bandwidthPerGb);
      }

      // Calculate video overage charges (per unit)
      if (rates.videosPerUnit && currentUsage.videosOverage > 0) {
        totalCharges += currentUsage.videosOverage * rates.videosPerUnit;
      }

      // Calculate AI request overage charges (per unit)
      if (rates.aiRequestsPerUnit && currentUsage.aiRequestsOverage > 0) {
        totalCharges += currentUsage.aiRequestsOverage * rates.aiRequestsPerUnit;
      }

      // Update the usage record with calculated charges
      yield* Effect.tryPromise({
        try: () =>
          db
            .update(usage)
            .set({
              overageCharges: totalCharges,
              updatedAt: new Date(),
            })
            .where(eq(usage.id, currentUsage.id)),
        catch: () =>
          new DatabaseError({ message: 'Failed to update overage charges', operation: 'calculateOverageCharges' }),
      });

      return totalCharges;
    }),

  markOverageReported: (organizationId) =>
    Effect.gen(function* () {
      const currentUsage = yield* makeBillingRepository(db).getCurrentUsage(organizationId);

      if (!currentUsage.id) return;

      yield* Effect.tryPromise({
        try: () =>
          db
            .update(usage)
            .set({
              overageReportedToStripe: true,
              updatedAt: new Date(),
            })
            .where(eq(usage.id, currentUsage.id)),
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to mark overage as reported',
            operation: 'markOverageReported',
            cause: error,
          }),
      });
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
  field: 'storageUsed' | 'videosUploaded' | 'bandwidthUsed' | 'aiRequests',
  amount: number,
) => Effect.flatMap(BillingRepository, (repo) => repo.incrementUsage(organizationId, field, amount));

export const decrementUsage = (organizationId: string, field: 'storageUsed' | 'videosUploaded', amount: number) =>
  Effect.flatMap(BillingRepository, (repo) => repo.decrementUsage(organizationId, field, amount));

export const getBillingInfo = (organizationId: string) =>
  Effect.flatMap(BillingRepository, (repo) => repo.getBillingInfo(organizationId));

export const getInvoices = (organizationId: string, limit?: number) =>
  Effect.flatMap(BillingRepository, (repo) => repo.getInvoices(organizationId, limit));

export const getMemberCount = (organizationId: string) =>
  Effect.flatMap(BillingRepository, (repo) => repo.getMemberCount(organizationId));

export const getVideoCount = (organizationId: string) =>
  Effect.flatMap(BillingRepository, (repo) => repo.getVideoCount(organizationId));

export const createTrialSubscription = (organizationId: string, trialDays = 14) =>
  Effect.flatMap(BillingRepository, (repo) => repo.createTrialSubscription(organizationId, trialDays));
