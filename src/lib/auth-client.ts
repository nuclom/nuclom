"use client";

import { passkeyClient } from "@better-auth/passkey/client";
import { stripeClient } from "@better-auth/stripe/client";
import { adminClient, apiKeyClient, organizationClient, twoFactorClient } from "better-auth/client/plugins";
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
    stripeClient({
      subscription: true,
    }),
  ],
});

// Export convenient hooks and methods for subscription management
export const { useSession, signIn, signOut, signUp, useActiveOrganization, organization, subscription } = authClient;

// Helper types for subscription management
export type SubscriptionPlan = "scale" | "pro";
export type BillingPeriod = "monthly" | "yearly";

// Helper function to upgrade subscription
export async function upgradeSubscription(params: {
  plan: SubscriptionPlan;
  annual?: boolean;
  referenceId: string;
  successUrl: string;
  cancelUrl: string;
  seats?: number;
}) {
  return authClient.subscription.upgrade({
    plan: params.plan,
    annual: params.annual ?? false,
    referenceId: params.referenceId,
    successUrl: params.successUrl,
    cancelUrl: params.cancelUrl,
    seats: params.seats,
  });
}

// Helper function to list subscriptions for an organization
export async function listSubscriptions(referenceId: string) {
  return authClient.subscription.list({
    query: {
      referenceId,
    },
  });
}

// Helper function to cancel subscription (cancels at period end by default)
export async function cancelSubscription(subscriptionId: string, returnUrl: string) {
  return authClient.subscription.cancel({
    subscriptionId,
    returnUrl,
  });
}

// Helper function to restore a canceled subscription
export async function restoreSubscription(subscriptionId: string) {
  return authClient.subscription.restore({
    subscriptionId,
  });
}

// Helper function to open billing portal
export async function openBillingPortal(returnUrl: string) {
  return authClient.subscription.billingPortal({
    returnUrl,
  });
}

// Check if organization has active subscription
export function hasActiveSubscription(subscriptions: Array<{ status: string }>) {
  return subscriptions.some((sub) => sub.status === "active" || sub.status === "trialing");
}

// Get current subscription status
export function getSubscriptionStatus(subscriptions: Array<{ status: string; plan: string }>) {
  const activeSub = subscriptions.find((sub) => sub.status === "active" || sub.status === "trialing");
  return activeSub
    ? { isActive: true, plan: activeSub.plan, status: activeSub.status }
    : { isActive: false, plan: "free", status: "none" };
}
