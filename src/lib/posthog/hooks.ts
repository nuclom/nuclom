'use client';

import { usePostHog } from 'posthog-js/react';
import { useCallback } from 'react';
import { type AnalyticsEventProperties, AnalyticsEvents } from './index';

/**
 * Hook for tracking video-related analytics events
 */
export function useVideoAnalytics() {
  const posthog = usePostHog();

  const trackVideoUpload = useCallback(
    (videoId: string, properties?: Partial<AnalyticsEventProperties>) => {
      posthog?.capture(AnalyticsEvents.VIDEO_UPLOADED, {
        videoId,
        ...properties,
      });
    },
    [posthog],
  );

  const trackVideoView = useCallback(
    (videoId: string, properties?: Partial<AnalyticsEventProperties>) => {
      posthog?.capture(AnalyticsEvents.VIDEO_VIEWED, {
        videoId,
        ...properties,
      });
    },
    [posthog],
  );

  const trackVideoShare = useCallback(
    (videoId: string, properties?: Partial<AnalyticsEventProperties>) => {
      posthog?.capture(AnalyticsEvents.VIDEO_SHARED, {
        videoId,
        ...properties,
      });
    },
    [posthog],
  );

  const trackVideoDelete = useCallback(
    (videoId: string, properties?: Partial<AnalyticsEventProperties>) => {
      posthog?.capture(AnalyticsEvents.VIDEO_DELETED, {
        videoId,
        ...properties,
      });
    },
    [posthog],
  );

  return {
    trackVideoUpload,
    trackVideoView,
    trackVideoShare,
    trackVideoDelete,
  };
}

/**
 * Hook for tracking comment-related analytics events
 */
export function useCommentAnalytics() {
  const posthog = usePostHog();

  const trackCommentAdd = useCallback(
    (videoId: string, properties?: Partial<AnalyticsEventProperties>) => {
      posthog?.capture(AnalyticsEvents.COMMENT_ADDED, {
        videoId,
        ...properties,
      });
    },
    [posthog],
  );

  const trackCommentReply = useCallback(
    (videoId: string, parentCommentId: string, properties?: Partial<AnalyticsEventProperties>) => {
      posthog?.capture(AnalyticsEvents.COMMENT_REPLIED, {
        videoId,
        parentCommentId,
        ...properties,
      });
    },
    [posthog],
  );

  return {
    trackCommentAdd,
    trackCommentReply,
  };
}

/**
 * Hook for tracking clip-related analytics events
 */
export function useClipAnalytics() {
  const posthog = usePostHog();

  const trackClipCreate = useCallback(
    (videoId: string, clipId: string, properties?: Partial<AnalyticsEventProperties>) => {
      posthog?.capture(AnalyticsEvents.CLIP_CREATED, {
        videoId,
        clipId,
        ...properties,
      });
    },
    [posthog],
  );

  const trackClipShare = useCallback(
    (clipId: string, properties?: Partial<AnalyticsEventProperties>) => {
      posthog?.capture(AnalyticsEvents.CLIP_SHARED, {
        clipId,
        ...properties,
      });
    },
    [posthog],
  );

  return {
    trackClipCreate,
    trackClipShare,
  };
}

/**
 * Hook for tracking organization-related analytics events
 */
export function useOrganizationAnalytics() {
  const posthog = usePostHog();

  const trackOrganizationCreate = useCallback(
    (organizationId: string, properties?: Partial<AnalyticsEventProperties>) => {
      posthog?.capture(AnalyticsEvents.ORGANIZATION_CREATED, {
        organizationId,
        ...properties,
      });
    },
    [posthog],
  );

  const trackUserInvite = useCallback(
    (organizationId: string, inviteeEmail: string, properties?: Partial<AnalyticsEventProperties>) => {
      posthog?.capture(AnalyticsEvents.USER_INVITED, {
        organizationId,
        inviteeEmail,
        ...properties,
      });
    },
    [posthog],
  );

  return {
    trackOrganizationCreate,
    trackUserInvite,
  };
}

/**
 * Hook for tracking billing-related analytics events
 */
export function useBillingAnalytics() {
  const posthog = usePostHog();

  const trackSubscriptionStart = useCallback(
    (plan: string, billingCycle: 'monthly' | 'yearly', properties?: Partial<AnalyticsEventProperties>) => {
      posthog?.capture(AnalyticsEvents.SUBSCRIPTION_STARTED, {
        plan,
        billingCycle,
        ...properties,
      });
    },
    [posthog],
  );

  const trackSubscriptionUpgrade = useCallback(
    (fromPlan: string, toPlan: string, properties?: Partial<AnalyticsEventProperties>) => {
      posthog?.capture(AnalyticsEvents.SUBSCRIPTION_UPGRADED, {
        fromPlan,
        toPlan,
        ...properties,
      });
    },
    [posthog],
  );

  const trackSubscriptionCancel = useCallback(
    (plan: string, properties?: Partial<AnalyticsEventProperties>) => {
      posthog?.capture(AnalyticsEvents.SUBSCRIPTION_CANCELLED, {
        plan,
        ...properties,
      });
    },
    [posthog],
  );

  return {
    trackSubscriptionStart,
    trackSubscriptionUpgrade,
    trackSubscriptionCancel,
  };
}

/**
 * Hook for tracking search-related analytics events
 */
export function useSearchAnalytics() {
  const posthog = usePostHog();

  const trackSearch = useCallback(
    (query: string, resultCount: number, properties?: Partial<AnalyticsEventProperties>) => {
      posthog?.capture(AnalyticsEvents.SEARCH_PERFORMED, {
        query,
        resultCount,
        ...properties,
      });
    },
    [posthog],
  );

  const trackSearchResultClick = useCallback(
    (query: string, resultId: string, position: number, properties?: Partial<AnalyticsEventProperties>) => {
      posthog?.capture(AnalyticsEvents.SEARCH_RESULT_CLICKED, {
        query,
        resultId,
        position,
        ...properties,
      });
    },
    [posthog],
  );

  return {
    trackSearch,
    trackSearchResultClick,
  };
}

/**
 * Hook for tracking feature usage
 */
export function useFeatureAnalytics() {
  const posthog = usePostHog();

  const trackFeatureUse = useCallback(
    (featureName: string, properties?: Partial<AnalyticsEventProperties>) => {
      posthog?.capture(AnalyticsEvents.FEATURE_USED, {
        featureName,
        ...properties,
      });
    },
    [posthog],
  );

  const trackAIFeatureUse = useCallback(
    (featureName: string, properties?: Partial<AnalyticsEventProperties>) => {
      posthog?.capture(AnalyticsEvents.AI_FEATURE_USED, {
        featureName,
        ...properties,
      });
    },
    [posthog],
  );

  return {
    trackFeatureUse,
    trackAIFeatureUse,
  };
}

/**
 * Generic analytics hook for custom events
 */
export function useAnalytics() {
  const posthog = usePostHog();

  const capture = useCallback(
    (eventName: string, properties?: Record<string, unknown>) => {
      posthog?.capture(eventName, properties);
    },
    [posthog],
  );

  const identify = useCallback(
    (userId: string, properties?: Record<string, unknown>) => {
      posthog?.identify(userId, properties);
    },
    [posthog],
  );

  const reset = useCallback(() => {
    posthog?.reset();
  }, [posthog]);

  const setPersonProperties = useCallback(
    (properties: Record<string, unknown>) => {
      posthog?.setPersonProperties(properties);
    },
    [posthog],
  );

  const group = useCallback(
    (groupType: string, groupKey: string, properties?: Record<string, unknown>) => {
      posthog?.group(groupType, groupKey, properties);
    },
    [posthog],
  );

  return {
    capture,
    identify,
    reset,
    setPersonProperties,
    group,
    posthog,
  };
}
