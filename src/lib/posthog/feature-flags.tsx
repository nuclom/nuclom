'use client';

import { useFeatureFlagEnabled, useFeatureFlagPayload } from 'posthog-js/react';
import type { ReactNode } from 'react';

/**
 * Feature flag keys used in the application
 * Define all feature flags here for type safety and documentation
 */
export const FeatureFlags = {
  // Video features
  VIDEO_AI_SUMMARY: 'video-ai-summary',
  VIDEO_CHAPTERS: 'video-chapters',
  VIDEO_SEARCH: 'video-search',

  // Collaboration features
  REAL_TIME_COMMENTS: 'real-time-comments',
  MENTIONS: 'mentions',
  REACTIONS: 'reactions',

  // Clip features
  CLIP_CREATION: 'clip-creation',
  CLIP_SHARING: 'clip-sharing',

  // Transcription features
  AUTO_TRANSCRIPTION: 'auto-transcription',
  SPEAKER_DIARIZATION: 'speaker-diarization',
  TRANSLATION: 'translation',

  // Organization features
  TEAM_WORKSPACES: 'team-workspaces',
  SSO: 'sso',
  ADVANCED_PERMISSIONS: 'advanced-permissions',

  // Billing features
  NEW_PRICING: 'new-pricing',
  YEARLY_DISCOUNT: 'yearly-discount',

  // UI features
  NEW_DASHBOARD: 'new-dashboard',
  DARK_MODE: 'dark-mode',
  COMPACT_VIEW: 'compact-view',

  // Beta features
  BETA_FEATURES: 'beta-features',
  EXPERIMENTAL_AI: 'experimental-ai',
} as const;

export type FeatureFlagKey = (typeof FeatureFlags)[keyof typeof FeatureFlags];

/**
 * Hook to check if a feature flag is enabled
 * Returns undefined while loading, then true/false
 */
export function useFeatureFlag(flagKey: FeatureFlagKey): boolean | undefined {
  return useFeatureFlagEnabled(flagKey);
}

/**
 * Hook to get a feature flag's payload value
 * Useful for multivariate flags or flags with configuration
 */
export function useFeatureFlagValue<T = unknown>(flagKey: FeatureFlagKey): T | undefined {
  return useFeatureFlagPayload(flagKey) as T | undefined;
}

/**
 * Props for the FeatureGate component
 */
interface FeatureGateProps {
  /** The feature flag key to check */
  flag: FeatureFlagKey;
  /** Content to render when the flag is enabled */
  children: ReactNode;
  /** Optional content to render when the flag is disabled */
  fallback?: ReactNode;
  /** Optional content to render while the flag is loading */
  loading?: ReactNode;
}

/**
 * Component for conditionally rendering content based on feature flags
 *
 * @example
 * ```tsx
 * <FeatureGate flag={FeatureFlags.NEW_DASHBOARD} fallback={<OldDashboard />}>
 *   <NewDashboard />
 * </FeatureGate>
 * ```
 */
export function FeatureGate({ flag, children, fallback = null, loading = null }: FeatureGateProps) {
  const isEnabled = useFeatureFlag(flag);

  // Still loading
  if (isEnabled === undefined) {
    return <>{loading}</>;
  }

  return <>{isEnabled ? children : fallback}</>;
}

/**
 * Higher-order component for feature gating
 *
 * @example
 * ```tsx
 * const NewFeatureComponent = withFeatureFlag(
 *   FeatureFlags.NEW_FEATURE,
 *   MyComponent,
 *   FallbackComponent
 * );
 * ```
 */
export function withFeatureFlag<P extends object>(
  flagKey: FeatureFlagKey,
  Component: React.ComponentType<P>,
  FallbackComponent?: React.ComponentType<P>,
) {
  return function FeatureFlaggedComponent(props: P) {
    const isEnabled = useFeatureFlag(flagKey);

    if (isEnabled === undefined) {
      return null; // Loading
    }

    if (isEnabled) {
      return <Component {...props} />;
    }

    return FallbackComponent ? <FallbackComponent {...props} /> : null;
  };
}
