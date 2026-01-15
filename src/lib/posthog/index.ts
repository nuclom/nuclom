/**
 * PostHog Analytics - Main Export
 *
 * This module provides PostHog analytics, feature flags, and error tracking
 * for the Nuclom application.
 *
 * ## Client-side Usage (React Components)
 *
 * ```tsx
 * 'use client';
 * import { usePostHog, useFeatureFlagEnabled } from '@/lib/posthog';
 *
 * function MyComponent() {
 *   const posthog = usePostHog();
 *   const isNewFeatureEnabled = useFeatureFlagEnabled('new-feature');
 *
 *   const handleClick = () => {
 *     posthog?.capture('button_clicked', { buttonName: 'signup' });
 *   };
 *
 *   if (!isNewFeatureEnabled) return null;
 *   return <button onClick={handleClick}>Sign Up</button>;
 * }
 * ```
 *
 * ## Server-side Usage (API Routes, Server Components)
 *
 * ```ts
 * import { captureServerEvent, isFeatureEnabled } from '@/lib/posthog/server';
 *
 * // In an API route
 * export async function POST(request: Request) {
 *   const userId = 'user-123';
 *
 *   // Capture event
 *   captureServerEvent(userId, 'api_call', { endpoint: '/api/videos' });
 *
 *   // Check feature flag
 *   const canUseNewFeature = await isFeatureEnabled(userId, 'new-feature');
 * }
 * ```
 *
 * ## Feature Flags
 *
 * Feature flags can be evaluated both client-side and server-side:
 *
 * - Client: `useFeatureFlagEnabled('flag-key')` hook
 * - Server: `await isFeatureEnabled(userId, 'flag-key')`
 *
 * ## Analytics Events
 *
 * Standard events to track:
 * - `video_uploaded` - User uploads a video
 * - `video_viewed` - User views a video
 * - `comment_added` - User adds a comment
 * - `clip_created` - User creates a clip
 * - `transcription_completed` - Transcription finishes
 * - `organization_created` - New organization created
 * - `user_invited` - User invites team member
 * - `subscription_upgraded` - User upgrades plan
 *
 * @see https://posthog.com/docs/libraries/next-js
 */

// Client-side exports
export {
  initPostHog,
  PostHogProvider,
  posthog,
  useActiveFeatureFlags,
  useFeatureFlagEnabled,
  useFeatureFlagPayload,
  usePostHog,
} from './client';

// Types for analytics events
export interface AnalyticsEventProperties {
  /** Video-related properties */
  videoId?: string;
  videoTitle?: string;
  videoDuration?: number;

  /** Organization properties */
  organizationId?: string;
  organizationName?: string;

  /** User action properties */
  actionType?: string;
  source?: string;

  /** Billing properties */
  plan?: string;
  billingCycle?: 'monthly' | 'yearly';

  /** Feature properties */
  featureName?: string;
  featureValue?: unknown;

  /** Generic properties */
  [key: string]: unknown;
}

// Common event names as constants for type safety
export const AnalyticsEvents = {
  // Video events
  VIDEO_UPLOADED: 'video_uploaded',
  VIDEO_VIEWED: 'video_viewed',
  VIDEO_DELETED: 'video_deleted',
  VIDEO_SHARED: 'video_shared',

  // Comment events
  COMMENT_ADDED: 'comment_added',
  COMMENT_REPLIED: 'comment_replied',
  COMMENT_DELETED: 'comment_deleted',

  // Clip events
  CLIP_CREATED: 'clip_created',
  CLIP_SHARED: 'clip_shared',

  // Transcription events
  TRANSCRIPTION_STARTED: 'transcription_started',
  TRANSCRIPTION_COMPLETED: 'transcription_completed',
  TRANSCRIPTION_FAILED: 'transcription_failed',

  // Organization events
  ORGANIZATION_CREATED: 'organization_created',
  ORGANIZATION_UPDATED: 'organization_updated',
  USER_INVITED: 'user_invited',
  USER_JOINED: 'user_joined',

  // Billing events
  SUBSCRIPTION_STARTED: 'subscription_started',
  SUBSCRIPTION_UPGRADED: 'subscription_upgraded',
  SUBSCRIPTION_DOWNGRADED: 'subscription_downgraded',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',

  // Feature usage events
  FEATURE_USED: 'feature_used',
  AI_FEATURE_USED: 'ai_feature_used',

  // Search events
  SEARCH_PERFORMED: 'search_performed',
  SEARCH_RESULT_CLICKED: 'search_result_clicked',

  // Authentication events
  USER_SIGNED_UP: 'user_signed_up',
  USER_SIGNED_IN: 'user_signed_in',
  USER_SIGNED_OUT: 'user_signed_out',
} as const;

export type AnalyticsEventName = (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];
