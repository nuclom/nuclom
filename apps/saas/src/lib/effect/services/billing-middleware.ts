/**
 * Billing Middleware using Effect-TS
 *
 * Provides plan limits enforcement for API routes and business logic.
 *
 * Subscription Status Enforcement:
 * - active: Full access
 * - trialing: Full access (until trial ends)
 * - past_due: Limited access (30-day grace period)
 * - unpaid: Read-only access
 * - canceled: No access after period ends
 * - incomplete_expired: No access (trial expired without payment)
 */

import { Effect, Option } from 'effect';
import type { PlanFeatures, PlanLimits } from '@/lib/db/schema';
import { type DatabaseError, ForbiddenError, NoSubscriptionError, PlanLimitExceededError } from '../errors';
import { Billing, type LimitResource } from './billing';
import { BillingRepository } from './billing-repository';

// =============================================================================
// Types
// =============================================================================

export interface LimitCheckResult {
  allowed: boolean;
  currentUsage: number;
  limit: number;
  remaining: number;
  percentage: number;
}

export interface SubscriptionAccessResult {
  hasAccess: boolean;
  isReadOnly: boolean;
  isGracePeriod: boolean;
  daysRemaining?: number;
  status: string;
  message?: string;
}

// Valid subscription statuses for different access levels
const FULL_ACCESS_STATUSES = ['active', 'trialing'];
const LIMITED_ACCESS_STATUSES = ['past_due']; // Can still use, but with warnings
const READ_ONLY_STATUSES = ['unpaid']; // Can view but not create/modify
const _NO_ACCESS_STATUSES = ['canceled', 'incomplete_expired', 'incomplete'];

// =============================================================================
// Middleware Functions
// =============================================================================

/**
 * Check subscription access level without failing
 * Returns detailed information about what access the organization has
 */
export const checkSubscriptionAccess = (
  organizationId: string,
): Effect.Effect<SubscriptionAccessResult, DatabaseError, Billing> =>
  Effect.gen(function* () {
    const billing = yield* Billing;
    const subscriptionOption = yield* billing.getSubscriptionOption(organizationId);

    if (Option.isNone(subscriptionOption)) {
      return {
        hasAccess: false,
        isReadOnly: false,
        isGracePeriod: false,
        status: 'none',
        message: 'No active subscription. Please subscribe to access this feature.',
      };
    }

    const subscription = subscriptionOption.value;
    const status = subscription.status ?? 'incomplete';

    // Full access
    if (FULL_ACCESS_STATUSES.includes(status)) {
      // Check if trial has expired (based on date, not status)
      if (status === 'trialing' && subscription.trialEnd) {
        const trialEndDate = new Date(subscription.trialEnd);
        const now = Date.now();
        const daysRemaining = Math.ceil((trialEndDate.getTime() - now) / (24 * 60 * 60 * 1000));

        // If trial has expired, deny access
        if (daysRemaining <= 0) {
          return {
            hasAccess: false,
            isReadOnly: false,
            isGracePeriod: false,
            daysRemaining: 0,
            status: 'incomplete_expired',
            message: 'Your trial has expired. Please subscribe to continue using Nuclom.',
          };
        }

        return {
          hasAccess: true,
          isReadOnly: false,
          isGracePeriod: false,
          daysRemaining,
          status,
          message:
            daysRemaining <= 3 ? `Trial ends in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}` : undefined,
        };
      }
      return {
        hasAccess: true,
        isReadOnly: false,
        isGracePeriod: false,
        status,
      };
    }

    // Limited access (grace period)
    if (LIMITED_ACCESS_STATUSES.includes(status)) {
      return {
        hasAccess: true,
        isReadOnly: false,
        isGracePeriod: true,
        status,
        message: 'Payment overdue. Please update your payment method to avoid service interruption.',
      };
    }

    // Read-only access
    if (READ_ONLY_STATUSES.includes(status)) {
      return {
        hasAccess: true,
        isReadOnly: true,
        isGracePeriod: true,
        status,
        message: 'Account suspended. Update payment to restore full access.',
      };
    }

    // No access
    return {
      hasAccess: false,
      isReadOnly: false,
      isGracePeriod: false,
      status,
      message: getNoAccessMessage(status),
    };
  });

/**
 * Get appropriate error message for no-access statuses
 */
function getNoAccessMessage(status: string): string {
  switch (status) {
    case 'canceled':
      return 'Subscription has been canceled. Please subscribe again to access this feature.';
    case 'incomplete_expired':
      return 'Trial has expired. Please add a payment method to continue.';
    case 'incomplete':
      return 'Subscription setup incomplete. Please complete the checkout process.';
    default:
      return 'Subscription is inactive. Please update your billing information.';
  }
}

/**
 * Check if organization has a valid subscription
 * Fails if subscription is not valid for full access
 * Note: There is no free plan - all users start with a 14-day trial
 */
export const requireActiveSubscription = (organizationId: string) =>
  Effect.gen(function* () {
    const billing = yield* Billing;
    const subscriptionOption = yield* billing.getSubscriptionOption(organizationId);

    if (Option.isNone(subscriptionOption)) {
      return yield* Effect.fail(
        new NoSubscriptionError({
          message: 'This organization requires an active subscription. Please subscribe to continue.',
          organizationId,
        }),
      );
    }

    const subscription = subscriptionOption.value;
    const status = subscription.status ?? 'incomplete';

    // Check if trial has expired (based on date)
    if (status === 'trialing' && subscription.trialEnd) {
      const trialEndDate = new Date(subscription.trialEnd);
      if (trialEndDate.getTime() <= Date.now()) {
        return yield* Effect.fail(
          new NoSubscriptionError({
            message: 'Your trial has expired. Please subscribe to continue using Nuclom.',
            organizationId,
          }),
        );
      }
    }

    // Allow full access statuses
    if (FULL_ACCESS_STATUSES.includes(status)) {
      return subscription;
    }

    // Allow limited access statuses (past_due gets a grace period)
    if (LIMITED_ACCESS_STATUSES.includes(status)) {
      return subscription;
    }

    // Deny access for all other statuses
    return yield* Effect.fail(
      new NoSubscriptionError({
        message: getNoAccessMessage(status),
        organizationId,
      }),
    );
  });

/**
 * Require active subscription for write operations
 * More strict than requireActiveSubscription - doesn't allow read-only statuses
 */
export const requireWriteAccess = (organizationId: string) =>
  Effect.gen(function* () {
    const billing = yield* Billing;
    const subscriptionOption = yield* billing.getSubscriptionOption(organizationId);

    if (Option.isNone(subscriptionOption)) {
      return yield* Effect.fail(
        new NoSubscriptionError({
          message: 'This organization requires an active subscription. Please subscribe to continue.',
          organizationId,
        }),
      );
    }

    const subscription = subscriptionOption.value;
    const status = subscription.status ?? 'incomplete';

    // Check if trial has expired (based on date)
    if (status === 'trialing' && subscription.trialEnd) {
      const trialEndDate = new Date(subscription.trialEnd);
      if (trialEndDate.getTime() <= Date.now()) {
        return yield* Effect.fail(
          new NoSubscriptionError({
            message: 'Your trial has expired. Please subscribe to continue using Nuclom.',
            organizationId,
          }),
        );
      }
    }

    // Only allow full access statuses for writes
    if (FULL_ACCESS_STATUSES.includes(status)) {
      return subscription;
    }

    // Past due gets limited write access (warn but allow)
    if (LIMITED_ACCESS_STATUSES.includes(status)) {
      return subscription;
    }

    // Read-only and no-access statuses cannot write
    if (READ_ONLY_STATUSES.includes(status)) {
      return yield* Effect.fail(
        new ForbiddenError({
          message: 'Account is in read-only mode due to payment issues. Please update your payment method.',
          resource: 'subscription',
        }),
      );
    }

    return yield* Effect.fail(
      new NoSubscriptionError({
        message: getNoAccessMessage(status),
        organizationId,
      }),
    );
  });

/**
 * Check if a resource limit allows the requested operation
 */
export const checkResourceLimit = (
  organizationId: string,
  resource: LimitResource,
  additionalAmount = 0,
): Effect.Effect<LimitCheckResult, NoSubscriptionError | DatabaseError, Billing | BillingRepository> =>
  Effect.gen(function* () {
    const billingRepo = yield* BillingRepository;
    const subscription = yield* billingRepo.getSubscription(organizationId);

    const limits = subscription.planInfo?.limits;
    const limit = limits?.[resource as keyof PlanLimits] ?? -1; // Default to unlimited if no plan info

    // Unlimited
    if (limit === -1) {
      return {
        allowed: true,
        currentUsage: 0,
        limit: -1,
        remaining: -1,
        percentage: 0,
      };
    }

    let currentUsage: number;

    switch (resource) {
      case 'members': {
        currentUsage = yield* billingRepo.getMemberCount(organizationId);
        break;
      }
      case 'videos': {
        // Use monthly video upload count from usage table, not total video count
        // This ensures limits are per billing period (calendar month)
        const usage = yield* billingRepo.getCurrentUsage(organizationId);
        currentUsage = usage.videosUploaded;
        break;
      }
      case 'storage':
      case 'bandwidth':
      case 'ai_requests': {
        const usage = yield* billingRepo.getCurrentUsage(organizationId);
        currentUsage =
          resource === 'storage'
            ? usage.storageUsed
            : resource === 'bandwidth'
              ? usage.bandwidthUsed
              : usage.aiRequests;
        break;
      }
      default:
        currentUsage = 0;
    }

    const newTotal = currentUsage + additionalAmount;
    const remaining = Math.max(0, limit - currentUsage);
    const percentage = Math.min(Math.round((currentUsage / limit) * 100), 100);

    return {
      allowed: newTotal <= limit,
      currentUsage,
      limit,
      remaining,
      percentage,
    };
  });

/**
 * Enforce a resource limit - fails if limit exceeded
 */
export const enforceResourceLimit = (
  organizationId: string,
  resource: LimitResource,
  additionalAmount = 0,
): Effect.Effect<void, PlanLimitExceededError | NoSubscriptionError | DatabaseError, Billing | BillingRepository> =>
  Effect.gen(function* () {
    const result = yield* checkResourceLimit(organizationId, resource, additionalAmount);

    if (!result.allowed) {
      const resourceLabel = resource.replace('_', ' ');
      return yield* Effect.fail(
        new PlanLimitExceededError({
          message: `You have reached your ${resourceLabel} limit. Please upgrade your plan to continue.`,
          resource,
          currentUsage: result.currentUsage,
          limit: result.limit,
        }),
      );
    }
  });

/**
 * Check if a feature is available on the current plan
 */
export const checkFeatureAccess = (
  organizationId: string,
  feature: keyof PlanFeatures,
): Effect.Effect<boolean, NoSubscriptionError | DatabaseError, BillingRepository> =>
  Effect.gen(function* () {
    const billingRepo = yield* BillingRepository;
    const subscription = yield* billingRepo.getSubscription(organizationId);
    return subscription.planInfo?.features?.[feature] ?? false;
  });

/**
 * Require a feature to be available - fails if not
 */
export const requireFeature = (
  organizationId: string,
  feature: keyof PlanFeatures,
  featureLabel?: string,
): Effect.Effect<void, ForbiddenError | NoSubscriptionError | DatabaseError, BillingRepository> =>
  Effect.gen(function* () {
    const hasAccess = yield* checkFeatureAccess(organizationId, feature);

    if (!hasAccess) {
      const label = featureLabel || feature.replace(/([A-Z])/g, ' $1').trim();
      return yield* Effect.fail(
        new ForbiddenError({
          message: `${label} is not available on your current plan. Please upgrade to access this feature.`,
          resource: feature,
        }),
      );
    }
  });

/**
 * Get organization's plan limits
 */
export const getPlanLimits = (
  organizationId: string,
): Effect.Effect<PlanLimits | null, NoSubscriptionError | DatabaseError, BillingRepository> =>
  Effect.gen(function* () {
    const billingRepo = yield* BillingRepository;
    const subscription = yield* billingRepo.getSubscription(organizationId);
    return subscription.planInfo?.limits ?? null;
  });

/**
 * Get organization's plan features
 */
export const getPlanFeatures = (
  organizationId: string,
): Effect.Effect<PlanFeatures | null, NoSubscriptionError | DatabaseError, BillingRepository> =>
  Effect.gen(function* () {
    const billingRepo = yield* BillingRepository;
    const subscription = yield* billingRepo.getSubscription(organizationId);
    return subscription.planInfo?.features ?? null;
  });

// =============================================================================
// Usage Alert Thresholds
// =============================================================================

const USAGE_ALERT_THRESHOLDS = [80, 90, 100] as const;
type UsageAlertThreshold = (typeof USAGE_ALERT_THRESHOLDS)[number];

/**
 * Check if a usage alert should be sent for a given percentage
 * Only alerts at 80%, 90%, and 100% thresholds
 */
const shouldSendAlert = (previousPercentage: number, currentPercentage: number): UsageAlertThreshold | null => {
  for (const threshold of USAGE_ALERT_THRESHOLDS) {
    if (previousPercentage < threshold && currentPercentage >= threshold) {
      return threshold;
    }
  }
  return null;
};

/**
 * Check usage levels and queue alert notifications if thresholds are crossed
 * This is called after usage is tracked to proactively warn users
 */
export const checkAndSendUsageAlerts = (
  organizationId: string,
  resource: 'storage' | 'videos' | 'bandwidth' | 'ai_requests',
  previousUsage: number,
  currentUsage: number,
  limit: number,
): Effect.Effect<void, never, BillingRepository> =>
  Effect.gen(function* () {
    if (limit === -1) return; // Unlimited, no alerts needed

    const previousPercentage = Math.round((previousUsage / limit) * 100);
    const currentPercentage = Math.round((currentUsage / limit) * 100);

    const threshold = shouldSendAlert(previousPercentage, currentPercentage);
    if (!threshold) return;

    // Log the alert (in production, this would queue a notification job)
    const resourceLabel = resource.replace('_', ' ');
    console.info(
      `[Usage Alert] Organization ${organizationId} has reached ${threshold}% of their ${resourceLabel} limit (${currentUsage}/${limit})`,
    );

    // Queue notification for organization owners
    // In production, this would use a durable workflow to send emails
    // For now, we create an in-app notification record

    // Get organization details for notification
    yield* Effect.tryPromise({
      try: async () => {
        // Import dynamically to avoid circular dependencies
        const { db } = await import('@/lib/db');
        const { notifications, members } = await import('@/lib/db/schema');
        const { eq, and } = await import('drizzle-orm');

        // Find organization owners
        const ownerMembers = await db.query.members.findMany({
          where: and(eq(members.organizationId, organizationId), eq(members.role, 'owner')),
        });

        // Create notifications for each owner
        for (const member of ownerMembers) {
          await db.insert(notifications).values({
            userId: member.userId,
            type: 'usage_alert',
            title: `${resourceLabel.charAt(0).toUpperCase() + resourceLabel.slice(1)} usage at ${threshold}%`,
            body:
              threshold === 100
                ? `You've reached your ${resourceLabel} limit. ${resource === 'bandwidth' ? 'Consider upgrading to avoid service interruption.' : 'Please upgrade your plan or free up space.'}`
                : `You're approaching your ${resourceLabel} limit. Consider upgrading your plan to avoid disruptions.`,
            resourceType: 'billing',
            resourceId: organizationId,
          });
        }
      },
      catch: (error) => {
        console.error('[Usage Alert] Failed to create notifications:', error);
        return null;
      },
    }).pipe(Effect.catchAll(() => Effect.succeed(undefined)));
  });

// =============================================================================
// Usage Tracking Helpers
// =============================================================================

/**
 * Track and enforce storage usage when uploading a file
 * Supports pay-as-you-go overage if configured on the plan
 */
export const trackStorageUsage = (organizationId: string, fileSize: number) =>
  Effect.gen(function* () {
    const billingRepo = yield* BillingRepository;
    const subscription = yield* billingRepo.getSubscription(organizationId);
    const limits = subscription.planInfo?.limits;
    const overageRates = subscription.planInfo?.overageRates;
    const limit = limits?.storage ?? -1;

    // Get current usage
    const currentUsage = yield* billingRepo.getCurrentUsage(organizationId);
    const newTotal = currentUsage.storageUsed + fileSize;

    // Check if this would exceed the limit
    if (limit !== -1 && newTotal > limit) {
      const overageAmount = newTotal - limit;

      // If pay-as-you-go is enabled for storage, allow and track overage
      if (overageRates?.storagePerGb !== null && overageRates?.storagePerGb !== undefined) {
        // Increment base usage
        yield* billingRepo.incrementUsage(organizationId, 'storageUsed', fileSize);
        // Track the overage amount
        yield* billingRepo.incrementOverage(organizationId, 'storageOverage', overageAmount);
        return;
      }

      // No pay-as-you-go - enforce hard limit
      return yield* Effect.fail(
        new PlanLimitExceededError({
          message: `Storage limit exceeded. Please upgrade your plan to continue.`,
          resource: 'storage',
          currentUsage: currentUsage.storageUsed,
          limit,
        }),
      );
    }

    // Within limits - just increment usage
    yield* billingRepo.incrementUsage(organizationId, 'storageUsed', fileSize);
  });

/**
 * Track video upload
 * Supports pay-as-you-go overage if configured on the plan
 */
export const trackVideoUpload = (organizationId: string, fileSize: number) =>
  Effect.gen(function* () {
    const billingRepo = yield* BillingRepository;
    const subscription = yield* billingRepo.getSubscription(organizationId);
    const limits = subscription.planInfo?.limits;
    const overageRates = subscription.planInfo?.overageRates;

    // Get current usage
    const currentUsage = yield* billingRepo.getCurrentUsage(organizationId);

    // Check storage limit
    const storageLimit = limits?.storage ?? -1;
    const newStorageTotal = currentUsage.storageUsed + fileSize;
    let storageOverageAmount = 0;

    if (storageLimit !== -1 && newStorageTotal > storageLimit) {
      storageOverageAmount = Math.max(0, newStorageTotal - storageLimit);

      // If no pay-as-you-go for storage, enforce hard limit
      if (overageRates?.storagePerGb === null || overageRates?.storagePerGb === undefined) {
        return yield* Effect.fail(
          new PlanLimitExceededError({
            message: `Storage limit exceeded. Please upgrade your plan to continue.`,
            resource: 'storage',
            currentUsage: currentUsage.storageUsed,
            limit: storageLimit,
          }),
        );
      }
    }

    // Check video count limit
    const videoLimit = limits?.videos ?? -1;
    const newVideoTotal = currentUsage.videosUploaded + 1;
    let videoOverageAmount = 0;

    if (videoLimit !== -1 && newVideoTotal > videoLimit) {
      videoOverageAmount = 1;

      // If no pay-as-you-go for videos, enforce hard limit
      if (overageRates?.videosPerUnit === null || overageRates?.videosPerUnit === undefined) {
        return yield* Effect.fail(
          new PlanLimitExceededError({
            message: `Video upload limit exceeded. You have uploaded ${currentUsage.videosUploaded} videos this month (limit: ${videoLimit}). Please upgrade your plan.`,
            resource: 'videos',
            currentUsage: currentUsage.videosUploaded,
            limit: videoLimit,
          }),
        );
      }
    }

    // Store previous usage for alerts
    const previousStorageUsed = currentUsage.storageUsed;
    const previousVideosUploaded = currentUsage.videosUploaded;

    // Increment base usage
    yield* Effect.all([
      billingRepo.incrementUsage(organizationId, 'storageUsed', fileSize),
      billingRepo.incrementUsage(organizationId, 'videosUploaded', 1),
    ]);

    // Track overage if any
    if (storageOverageAmount > 0) {
      yield* billingRepo.incrementOverage(organizationId, 'storageOverage', storageOverageAmount);
    }
    if (videoOverageAmount > 0) {
      yield* billingRepo.incrementOverage(organizationId, 'videosOverage', videoOverageAmount);
    }

    // Check and send usage alerts (non-blocking)
    yield* checkAndSendUsageAlerts(
      organizationId,
      'storage',
      previousStorageUsed,
      previousStorageUsed + fileSize,
      storageLimit,
    ).pipe(Effect.catchAll(() => Effect.succeed(undefined)));

    yield* checkAndSendUsageAlerts(
      organizationId,
      'videos',
      previousVideosUploaded,
      previousVideosUploaded + 1,
      videoLimit,
    ).pipe(Effect.catchAll(() => Effect.succeed(undefined)));
  });

/**
 * Track bandwidth usage (for video streaming)
 * Supports pay-as-you-go overage if configured on the plan
 *
 * Policy (when no pay-as-you-go):
 * - Up to 100%: Normal usage
 * - 100-200%: Warning logged, usage allowed (grace period)
 * - >200%: Hard block - must upgrade or wait for next billing cycle
 *
 * Policy (with pay-as-you-go):
 * - Up to 100%: Normal usage
 * - >100%: Overage tracked and billed per configured rate
 */
export const trackBandwidthUsage = (organizationId: string, bytes: number) =>
  Effect.gen(function* () {
    const billingRepo = yield* BillingRepository;
    const subscription = yield* billingRepo.getSubscription(organizationId);
    const limits = subscription.planInfo?.limits;
    const overageRates = subscription.planInfo?.overageRates;
    const limit = limits?.bandwidth ?? -1;

    // Get current usage
    const currentUsage = yield* billingRepo.getCurrentUsage(organizationId);
    const newTotal = currentUsage.bandwidthUsed + bytes;

    // Check if this would exceed the limit
    if (limit !== -1 && newTotal > limit) {
      const overageAmount = newTotal - limit;
      const percentage = Math.round((newTotal / limit) * 100);

      // If pay-as-you-go is enabled for bandwidth, allow and track overage
      if (overageRates?.bandwidthPerGb !== null && overageRates?.bandwidthPerGb !== undefined) {
        // Increment base usage
        yield* billingRepo.incrementUsage(organizationId, 'bandwidthUsed', bytes);
        // Track the overage amount
        yield* billingRepo.incrementOverage(organizationId, 'bandwidthOverage', overageAmount);
        return;
      }

      // No pay-as-you-go - apply grace period policy
      // Hard limit at 2x allocation (200%)
      if (percentage >= 200) {
        return yield* Effect.fail(
          new PlanLimitExceededError({
            message:
              'You have exceeded your bandwidth limit (2x allocation). Please upgrade your plan or wait for the next billing cycle.',
            resource: 'bandwidth',
            currentUsage: currentUsage.bandwidthUsed,
            limit,
          }),
        );
      }

      // 100-200%: Warning logged, usage still allowed (grace period)
      console.warn(
        `[Billing] Organization ${organizationId} is exceeding bandwidth limit: ${currentUsage.bandwidthUsed}/${limit} (${percentage}%)`,
      );
    }

    // Store previous usage for alerts
    const previousBandwidthUsed = currentUsage.bandwidthUsed;

    // Increment usage
    yield* billingRepo.incrementUsage(organizationId, 'bandwidthUsed', bytes);

    // Check and send usage alerts (non-blocking)
    yield* checkAndSendUsageAlerts(
      organizationId,
      'bandwidth',
      previousBandwidthUsed,
      previousBandwidthUsed + bytes,
      limit,
    ).pipe(Effect.catchAll(() => Effect.succeed(undefined)));
  });

/**
 * Track AI request usage
 * Supports pay-as-you-go overage if configured on the plan
 */
export const trackAIRequest = (organizationId: string) =>
  Effect.gen(function* () {
    // Check if AI insights is enabled on the plan
    yield* requireFeature(organizationId, 'aiInsights', 'AI Insights');

    const billingRepo = yield* BillingRepository;
    const subscription = yield* billingRepo.getSubscription(organizationId);
    const overageRates = subscription.planInfo?.overageRates;

    // Get current usage and check against a reasonable limit
    // AI requests don't have a defined limit in PlanLimits, so we use a default of 1000/month
    const AI_REQUEST_LIMIT = 1000;
    const currentUsage = yield* billingRepo.getCurrentUsage(organizationId);
    const newTotal = currentUsage.aiRequests + 1;

    if (newTotal > AI_REQUEST_LIMIT) {
      // If pay-as-you-go is enabled for AI requests, allow and track overage
      if (overageRates?.aiRequestsPerUnit !== null && overageRates?.aiRequestsPerUnit !== undefined) {
        yield* billingRepo.incrementUsage(organizationId, 'aiRequests', 1);
        yield* billingRepo.incrementOverage(organizationId, 'aiRequestsOverage', 1);
        return;
      }

      // No pay-as-you-go - enforce limit
      return yield* Effect.fail(
        new PlanLimitExceededError({
          message: `AI request limit exceeded. You have used ${currentUsage.aiRequests} AI requests this month (limit: ${AI_REQUEST_LIMIT}). Please upgrade your plan.`,
          resource: 'ai_requests',
          currentUsage: currentUsage.aiRequests,
          limit: AI_REQUEST_LIMIT,
        }),
      );
    }

    // Within limits - increment usage
    yield* billingRepo.incrementUsage(organizationId, 'aiRequests', 1);
  });

/**
 * Release storage when deleting a file
 */
export const releaseStorageUsage = (organizationId: string, fileSize: number) =>
  Effect.gen(function* () {
    const billingRepo = yield* BillingRepository;
    yield* billingRepo.decrementUsage(organizationId, 'storageUsed', fileSize);
  });

/**
 * Release video count when deleting a video
 */
export const releaseVideoCount = (organizationId: string) =>
  Effect.gen(function* () {
    const billingRepo = yield* BillingRepository;
    yield* billingRepo.decrementUsage(organizationId, 'videosUploaded', 1);
  });

// =============================================================================
// Aliases for convenience
// =============================================================================

export { checkResourceLimit as checkLimit, enforceResourceLimit as enforceLimit };
