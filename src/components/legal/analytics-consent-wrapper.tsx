"use client";

import { Analytics } from "@vercel/analytics/next";
import { useCookieConsent } from "./cookie-consent";

/**
 * Wrapper for Vercel Analytics that respects cookie consent preferences.
 * Analytics will only be enabled when the user has explicitly consented.
 */
export function AnalyticsWithConsent() {
  const { preferences, isLoaded } = useCookieConsent();

  // Don't render analytics until we've checked consent
  // and only if user has explicitly consented to analytics
  if (!isLoaded || !preferences?.analytics) {
    return null;
  }

  return <Analytics />;
}
