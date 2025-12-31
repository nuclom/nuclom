/**
 * Billing Middleware using Effect-TS
 *
 * Provides plan limits enforcement for API routes and business logic.
 */

import { Effect, Option } from "effect";
import type { PlanFeatures, PlanLimits } from "@/lib/db/schema";
import { type DatabaseError, ForbiddenError, NoSubscriptionError, PlanLimitExceededError } from "../errors";
import { Billing, type LimitResource } from "./billing";
import { BillingRepository } from "./billing-repository";

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

// =============================================================================
// Middleware Functions
// =============================================================================

/**
 * Check if organization has a valid subscription (not on free plan or has active subscription)
 */
export const requireActiveSubscription = (organizationId: string) =>
  Effect.gen(function* () {
    const billing = yield* Billing;
    const subscriptionOption = yield* billing.getSubscriptionOption(organizationId);

    if (Option.isNone(subscriptionOption)) {
      return yield* Effect.fail(
        new NoSubscriptionError({
          message: "This organization requires an active subscription",
          organizationId,
        }),
      );
    }

    const subscription = subscriptionOption.value;

    if (subscription.status !== "active" && subscription.status !== "trialing") {
      return yield* Effect.fail(
        new NoSubscriptionError({
          message: `Subscription is ${subscription.status}. Please update your payment method.`,
          organizationId,
        }),
      );
    }

    return subscription;
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
      const resourceLabel = resource.replace("_", " ");
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
      const label = featureLabel || feature.replace(/([A-Z])/g, " $1").trim();
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
    yield* enforceResourceLimit(organizationId, "storage", fileSize);

    // Then increment the usage
    const billingRepo = yield* BillingRepository;
    yield* billingRepo.incrementUsage(organizationId, "storageUsed", fileSize);
  });

/**
 * Track video upload
 */
export const trackVideoUpload = (organizationId: string, fileSize: number) =>
  Effect.gen(function* () {
    // Check storage limit
    yield* enforceResourceLimit(organizationId, "storage", fileSize);

    // Check video count limit
    yield* enforceResourceLimit(organizationId, "videos", 1);

    // Increment both storage and video count
    const billingRepo = yield* BillingRepository;
    yield* Effect.all([
      billingRepo.incrementUsage(organizationId, "storageUsed", fileSize),
      billingRepo.incrementUsage(organizationId, "videosUploaded", 1),
    ]);
  });

/**
 * Track bandwidth usage (for video streaming)
 */
export const trackBandwidthUsage = (organizationId: string, bytes: number) =>
  Effect.gen(function* () {
    const billingRepo = yield* BillingRepository;

    // Check limit but don't fail - just log warning
    const result = yield* checkResourceLimit(organizationId, "bandwidth", bytes);

    if (!result.allowed) {
      // Log warning but allow - we might implement throttling later
      console.warn(
        `[Billing] Organization ${organizationId} is exceeding bandwidth limit: ${result.currentUsage}/${result.limit}`,
      );
    }

    yield* billingRepo.incrementUsage(organizationId, "bandwidthUsed", bytes);
  });

/**
 * Track AI request usage
 */
export const trackAIRequest = (organizationId: string) =>
  Effect.gen(function* () {
    // Check if AI insights is enabled
    yield* requireFeature(organizationId, "aiInsights", "AI Insights");

    // Increment AI request count
    const billingRepo = yield* BillingRepository;
    yield* billingRepo.incrementUsage(organizationId, "aiRequests", 1);
  });

/**
 * Release storage when deleting a file
 */
export const releaseStorageUsage = (organizationId: string, fileSize: number) =>
  Effect.gen(function* () {
    const billingRepo = yield* BillingRepository;
    yield* billingRepo.decrementUsage(organizationId, "storageUsed", fileSize);
  });

/**
 * Release video count when deleting a video
 */
export const releaseVideoCount = (organizationId: string) =>
  Effect.gen(function* () {
    const billingRepo = yield* BillingRepository;
    yield* billingRepo.decrementUsage(organizationId, "videosUploaded", 1);
  });

// =============================================================================
// Aliases for convenience
// =============================================================================

export { checkResourceLimit as checkLimit, enforceResourceLimit as enforceLimit };
