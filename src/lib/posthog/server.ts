import 'server-only';
import process from 'node:process';
import { PostHog } from 'posthog-node';

// Environment variables
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

/**
 * Server-side PostHog client
 * Used for server-side feature flag evaluation, server-side event capture,
 * and any analytics needs in API routes or server components
 */
function createServerPostHog(): PostHog | null {
  if (!POSTHOG_KEY) {
    console.warn('[PostHog Server] NEXT_PUBLIC_POSTHOG_KEY is not set, server analytics disabled');
    return null;
  }

  return new PostHog(POSTHOG_KEY, {
    host: POSTHOG_HOST,
    // Flush events every 10 events or every 5 seconds
    flushAt: 10,
    flushInterval: 5000,
  });
}

// Singleton instance for server-side usage
let serverPostHog: PostHog | null = null;

/**
 * Get the server-side PostHog instance
 * Creates a singleton to avoid creating multiple instances
 */
export function getServerPostHog(): PostHog | null {
  if (!serverPostHog) {
    serverPostHog = createServerPostHog();
  }
  return serverPostHog;
}

/**
 * Capture an event server-side
 * Useful for tracking backend events, API calls, background jobs, etc.
 */
export function captureServerEvent(distinctId: string, event: string, properties?: Record<string, unknown>) {
  const ph = getServerPostHog();
  if (!ph) return;

  ph.capture({
    distinctId,
    event,
    properties,
  });
}

/**
 * Identify a user server-side
 * Sets user properties that persist across sessions
 */
export function identifyUser(distinctId: string, properties?: Record<string, unknown>) {
  const ph = getServerPostHog();
  if (!ph) return;

  ph.identify({
    distinctId,
    properties,
  });
}

/**
 * Evaluate a feature flag server-side
 * Returns the flag value (boolean or multivariate string/JSON)
 */
export async function getFeatureFlag(
  distinctId: string,
  flagKey: string,
  options?: {
    groups?: Record<string, string>;
    personProperties?: Record<string, string>;
    groupProperties?: Record<string, Record<string, string>>;
  },
): Promise<string | boolean | undefined> {
  const ph = getServerPostHog();
  if (!ph) return undefined;

  return ph.getFeatureFlag(flagKey, distinctId, options);
}

/**
 * Evaluate a feature flag with payload server-side
 * Returns both the flag value and any associated payload
 */
export async function getFeatureFlagPayload(distinctId: string, flagKey: string): Promise<unknown> {
  const ph = getServerPostHog();
  if (!ph) return undefined;

  return ph.getFeatureFlagPayload(flagKey, distinctId);
}

/**
 * Get all feature flags for a user server-side
 * Useful for bootstrapping flags to the client
 */
export async function getAllFeatureFlags(
  distinctId: string,
  options?: {
    groups?: Record<string, string>;
    personProperties?: Record<string, string>;
    groupProperties?: Record<string, Record<string, string>>;
  },
): Promise<Record<string, string | boolean>> {
  const ph = getServerPostHog();
  if (!ph) return {};

  return ph.getAllFlags(distinctId, options);
}

/**
 * Check if a feature flag is enabled server-side
 * Convenience wrapper for boolean flags
 */
export async function isFeatureEnabled(
  distinctId: string,
  flagKey: string,
  options?: {
    groups?: Record<string, string>;
    personProperties?: Record<string, string>;
    groupProperties?: Record<string, Record<string, string>>;
  },
): Promise<boolean> {
  const value = await getFeatureFlag(distinctId, flagKey, options);
  return value === true || value === 'true';
}

/**
 * Flush all pending events
 * Call this before exiting a serverless function
 */
export async function flushServerEvents(): Promise<void> {
  const ph = getServerPostHog();
  if (!ph) return;

  await ph.flush();
}

/**
 * Shutdown the PostHog client
 * Call this on application shutdown for graceful cleanup
 */
export async function shutdownServerPostHog(): Promise<void> {
  const ph = getServerPostHog();
  if (!ph) return;

  await ph.shutdown();
  serverPostHog = null;
}
