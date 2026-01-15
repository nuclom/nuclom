'use client';

import process from 'node:process';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react';
import { Suspense, useEffect } from 'react';

// Environment variables
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

/**
 * Initialize PostHog client-side SDK
 * Uses the recommended 2025-11-30 defaults for automatic pageview and pageleave tracking
 */
export function initPostHog() {
  if (typeof window === 'undefined') return;
  if (!POSTHOG_KEY) {
    console.warn('[PostHog] NEXT_PUBLIC_POSTHOG_KEY is not set, analytics disabled');
    return;
  }

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    // Use 2025-11-30 defaults for automatic pageview/pageleave tracking
    defaults: '2025-11-30',
    // Capture performance metrics
    capture_performance: true,
    // Enable session recording (if available in your plan)
    disable_session_recording: false,
    // Enable heatmaps (if available in your plan)
    enable_heatmaps: true,
    // Enable dead click detection for rage click analysis
    capture_dead_clicks: true,
    // Enable autocapture for automatic event tracking
    autocapture: true,
    // Capture console errors automatically
    capture_exceptions: true,
    // Persist user identity across sessions
    persistence: 'localStorage+cookie',
    // Enable debug mode in development
    debug: process.env.NODE_ENV === 'development',
    // Bootstrap feature flags on load for immediate availability
    bootstrap: {
      // Feature flags will be fetched on init
    },
    // Respect Do Not Track browser settings
    respect_dnt: true,
  });
}

/**
 * Track pageview events manually (for SPA navigation)
 * With defaults: '2025-11-30', this is handled automatically via history_change
 * This component provides additional tracking flexibility if needed
 */
function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthogInstance = usePostHog();

  useEffect(() => {
    if (!pathname || !posthogInstance) return;

    // Capture pageview with URL (already handled by defaults, but useful for debugging)
    const url = `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ''}`;
    posthogInstance.capture('$pageview', {
      $current_url: url,
    });
  }, [pathname, searchParams, posthogInstance]);

  return null;
}

/**
 * PostHog Provider wrapper for the application
 * Initializes PostHog and provides context to all child components
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initPostHog();
  }, []);

  // Don't render provider if no API key (graceful degradation)
  if (!POSTHOG_KEY) {
    return <>{children}</>;
  }

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
      {children}
    </PHProvider>
  );
}

// Re-export posthog instance for direct usage
export { posthog };

// Re-export useful hooks
export { useActiveFeatureFlags, useFeatureFlagEnabled, useFeatureFlagPayload, usePostHog } from 'posthog-js/react';
