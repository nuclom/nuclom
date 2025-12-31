"use client";

import {
  adminClient,
  apiKeyClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";
import { createAuthClient } from "better-auth/react";
import { env } from "@/lib/env/client";

// Determine baseURL from Vercel automatic environment variables or browser origin
const getBaseURL = () => {
  // In browser, use current origin (most reliable)
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  // In SSR, derive from Vercel automatic env vars
  if (env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${env.NEXT_PUBLIC_VERCEL_URL}`;
  }
  // Fallback to relative URLs for local development
  return "";
};

export const authClient = createAuthClient({
  baseURL: getBaseURL(),
  plugins: [
    organizationClient(),
    adminClient(),
    apiKeyClient(),
    twoFactorClient(),
    passkeyClient(),
  ],
});
