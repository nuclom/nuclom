/**
 * PostHog Analytics - Main Export
 *
 * This module provides PostHog analytics, feature flags, and error tracking.
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
