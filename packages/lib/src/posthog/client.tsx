'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react';
import { Suspense, useEffect, useRef } from 'react';
import { useSession } from '../auth-client';
import { env } from '../env/client';

// Environment variables
const POSTHOG_KEY = env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = env.NEXT_PUBLIC_POSTHOG_HOST;

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
    debug: env.NODE_ENV === 'development',
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
 * PostHog User Identifier
 * Identifies users in PostHog when they log in and resets on logout.
 * This ensures user activity is attributed to the correct person.
 */
function PostHogIdentifier() {
  const { data: session, isPending } = useSession();
  const posthogInstance = usePostHog();
  const previousUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (isPending || !posthogInstance) return;

    const user = session?.user;
    const currentUserId = user?.id ?? null;

    // Only process if user state has changed
    if (currentUserId === previousUserIdRef.current) return;

    if (user) {
      // User logged in - identify them in PostHog
      posthogInstance.identify(user.id, {
        email: user.email,
        name: user.name,
        // Include additional user properties for richer analytics
        createdAt: user.createdAt,
        emailVerified: user.emailVerified,
      });
    } else if (previousUserIdRef.current !== null) {
      // User logged out - reset PostHog identity
      posthogInstance.reset();
    }

    previousUserIdRef.current = currentUserId;
  }, [session, isPending, posthogInstance]);

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

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
      <PostHogIdentifier />
      {children}
    </PHProvider>
  );
}

// Re-export posthog instance for direct usage
export { posthog };

// Re-export useful hooks
export { useActiveFeatureFlags, useFeatureFlagEnabled, useFeatureFlagPayload, usePostHog } from 'posthog-js/react';
