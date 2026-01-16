'use client';

import { useFeatureFlagEnabled, useFeatureFlagPayload } from 'posthog-js/react';
import type { ReactNode } from 'react';

/**
 * Hook to check if a feature flag is enabled
 * Returns undefined while loading, then true/false
 */
export function useFeatureFlag(flagKey: string): boolean | undefined {
  return useFeatureFlagEnabled(flagKey);
}

/**
 * Hook to get a feature flag's payload value
 * Useful for multivariate flags or flags with configuration
 */
export function useFeatureFlagValue<T = unknown>(flagKey: string): T | undefined {
  return useFeatureFlagPayload(flagKey) as T | undefined;
}

/**
 * Props for the FeatureGate component
 */
interface FeatureGateProps {
  /** The feature flag key to check */
  flag: string;
  /** Content to render when the flag is enabled */
  children: ReactNode;
  /** Optional content to render when the flag is disabled */
  fallback?: ReactNode;
  /** Optional content to render while the flag is loading */
  loading?: ReactNode;
}

/**
 * Component for conditionally rendering content based on feature flags
 */
export function FeatureGate({ flag, children, fallback = null, loading = null }: FeatureGateProps) {
  const isEnabled = useFeatureFlag(flag);

  if (isEnabled === undefined) {
    return <>{loading}</>;
  }

  return <>{isEnabled ? children : fallback}</>;
}
