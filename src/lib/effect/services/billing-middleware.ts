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
        currentUsage = yield* billingRepo.getVideoCount(organizationId);
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
// Usage Tracking Helpers
// =============================================================================

/**
 * Track and enforce storage usage when uploading a file
 */
export const trackStorageUsage = (organizationId: string, fileSize: number) =>
  Effect.gen(function* () {
    // First check if we have capacity
    yield* enforceResourceLimit(organizationId, 'storage', fileSize);

    // Then increment the usage
    const billingRepo = yield* BillingRepository;
    yield* billingRepo.incrementUsage(organizationId, 'storageUsed', fileSize);
  });

/**
 * Track video upload
 */
export const trackVideoUpload = (organizationId: string, fileSize: number) =>
  Effect.gen(function* () {
    // Check storage limit
    yield* enforceResourceLimit(organizationId, 'storage', fileSize);

    // Check video count limit
    yield* enforceResourceLimit(organizationId, 'videos', 1);

    // Increment both storage and video count
    const billingRepo = yield* BillingRepository;
    yield* Effect.all([
      billingRepo.incrementUsage(organizationId, 'storageUsed', fileSize),
      billingRepo.incrementUsage(organizationId, 'videosUploaded', 1),
    ]);
  });

/**
 * Track bandwidth usage (for video streaming)
 *
 * Policy: Users are contacted if exceeding >2x allocation (from pricing.md)
 * - Up to 100%: Normal usage
 * - 100-200%: Warning logged, usage allowed
 * - >200%: Hard block - must upgrade or wait for next billing cycle
 */
export const trackBandwidthUsage = (organizationId: string, bytes: number) =>
  Effect.gen(function* () {
    const billingRepo = yield* BillingRepository;

    const result = yield* checkResourceLimit(organizationId, 'bandwidth', bytes);

    // Hard limit at 2x allocation (200%)
    if (result.limit !== -1 && result.percentage >= 200) {
      return yield* Effect.fail(
        new PlanLimitExceededError({
          message:
            'You have exceeded your bandwidth limit (2x allocation). Please upgrade your plan or wait for the next billing cycle.',
          resource: 'bandwidth',
          currentUsage: result.currentUsage,
          limit: result.limit,
        }),
      );
    }

    // Soft warning at 100%
    if (!result.allowed) {
      console.warn(
        `[Billing] Organization ${organizationId} is exceeding bandwidth limit: ${result.currentUsage}/${result.limit} (${result.percentage}%)`,
      );
    }

    yield* billingRepo.incrementUsage(organizationId, 'bandwidthUsed', bytes);
  });

/**
 * Track AI request usage
 */
export const trackAIRequest = (organizationId: string) =>
  Effect.gen(function* () {
    // Check if AI insights is enabled
    yield* requireFeature(organizationId, 'aiInsights', 'AI Insights');

    // Increment AI request count
    const billingRepo = yield* BillingRepository;
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
