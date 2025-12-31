"use client";

import { adminClient, apiKeyClient, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { env } from "@/lib/env/client";

// Determine baseURL: use env var if set, otherwise use relative URL (empty string)
// which will work correctly on any domain including Vercel preview deployments
const getBaseURL = () => {
  if (env.NEXT_PUBLIC_BETTER_AUTH_URL) {
    return env.NEXT_PUBLIC_BETTER_AUTH_URL;
  }
  // Use current origin in browser, empty string for SSR (relative URLs)
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "";
};

export const authClient = createAuthClient({
  baseURL: getBaseURL(),
  plugins: [organizationClient(), adminClient(), apiKeyClient()],
});
