'use client';

import { oauthProviderClient } from '@better-auth/oauth-provider/client';
import { passkeyClient } from '@better-auth/passkey/client';
import { ssoClient } from '@better-auth/sso/client';
import { stripeClient } from '@better-auth/stripe/client';
import {
  adminClient,
  apiKeyClient,
  lastLoginMethodClient,
  multiSessionClient,
  organizationClient,
  twoFactorClient,
} from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { ac, organizationRoles } from '@/lib/access-control';
import { env } from '@/lib/env/client';

// Determine baseURL from Vercel automatic environment variables or browser origin
const getBaseURL = () => {
  // In browser, use current origin (most reliable)
  if (typeof window !== 'undefined') {
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
  return '';
};

export const authClient = createAuthClient({
  baseURL: getBaseURL(),
  plugins: [
    organizationClient({
      ac,
      roles: organizationRoles,
      // Enable teams feature for sub-group management
      teams: {
        enabled: true,
      },
    }),
    adminClient(),
    apiKeyClient(),
    twoFactorClient(),
    passkeyClient(),
    ssoClient({
      domainVerification: {
        enabled: true,
      },
    }),
    stripeClient({
      subscription: true,
    }),
    lastLoginMethodClient(),
    multiSessionClient(),
    oauthProviderClient(),
  ],
});

// Export convenient hooks and methods for subscription management
export const { useSession, signIn, signOut, signUp, useActiveOrganization, organization, subscription, multiSession } =
  authClient;

// Export admin methods for user management
export const { admin } = authClient;

// Last login method helpers - methods available directly on authClient
export const { getLastUsedLoginMethod, isLastUsedLoginMethod, clearLastUsedLoginMethod } = authClient;

// Helper types for subscription management
export type SubscriptionPlan = 'scale' | 'pro';
export type BillingPeriod = 'monthly' | 'yearly';

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
  return subscriptions.some((sub) => sub.status === 'active' || sub.status === 'trialing');
}

// Get current subscription status
export function getSubscriptionStatus(subscriptions: Array<{ status: string; plan: string }>) {
  const activeSub = subscriptions.find((sub) => sub.status === 'active' || sub.status === 'trialing');
  return activeSub
    ? { isActive: true, plan: activeSub.plan, status: activeSub.status }
    : { isActive: false, plan: 'free', status: 'none' };
}

// =============================================================================
// Team Management Helpers
// =============================================================================

// Helper function to create a team within an organization
export async function createTeam(params: { name: string; organizationId: string }) {
  return authClient.organization.createTeam({
    name: params.name,
    organizationId: params.organizationId,
  });
}

// Helper function to list teams in an organization
export async function listTeams(organizationId: string) {
  return authClient.organization.listTeams({
    query: { organizationId },
  });
}

// Helper function to update a team
export async function updateTeam(params: { teamId: string; data: { name?: string } }) {
  return authClient.organization.updateTeam({
    teamId: params.teamId,
    data: params.data,
  });
}

// Helper function to remove a team
export async function removeTeam(teamId: string) {
  return authClient.organization.removeTeam({
    teamId,
  });
}

// Helper function to set the active team for the current session
export async function setActiveTeam(teamId: string) {
  return authClient.organization.setActiveTeam({
    teamId,
  });
}

// Helper function to add a member to a team
export async function addTeamMember(params: { teamId: string; userId: string }) {
  return authClient.organization.addTeamMember({
    teamId: params.teamId,
    userId: params.userId,
  });
}

// Helper function to remove a member from a team
export async function removeTeamMember(params: { teamId: string; userId: string }) {
  return authClient.organization.removeTeamMember({
    teamId: params.teamId,
    userId: params.userId,
  });
}

// Helper function to list team members
export async function listTeamMembers(teamId: string) {
  return authClient.organization.listTeamMembers({
    query: { teamId },
  });
}

// Helper function to list teams the current user belongs to
export async function listUserTeams() {
  return authClient.organization.listUserTeams({});
}

// =============================================================================
// Admin User Management Helpers
// =============================================================================

// Helper function to list all users (admin only)
export async function listUsers(params?: { limit?: number; offset?: number; search?: string }) {
  return authClient.admin.listUsers({
    query: {
      limit: params?.limit,
      offset: params?.offset,
      searchValue: params?.search,
    },
  });
}

// Helper function to create a new user (admin only)
export async function createUser(params: { email: string; name: string; password: string; role?: 'admin' | 'user' }) {
  return authClient.admin.createUser({
    email: params.email,
    name: params.name,
    password: params.password,
    role: params.role || 'user',
  });
}

// Helper function to ban a user (admin only)
export async function banUser(params: { userId: string; reason?: string; expiresIn?: number }) {
  return authClient.admin.banUser({
    userId: params.userId,
    banReason: params.reason,
    banExpiresIn: params.expiresIn,
  });
}

// Helper function to unban a user (admin only)
export async function unbanUser(userId: string) {
  return authClient.admin.unbanUser({
    userId,
  });
}

// Helper function to impersonate a user (admin only)
export async function impersonateUser(userId: string) {
  return authClient.admin.impersonateUser({
    userId,
  });
}

// Helper function to stop impersonating a user
export async function stopImpersonation() {
  return authClient.admin.stopImpersonating();
}

// Helper function to revoke all sessions for a user (admin only)
export async function revokeUserSessions(userId: string) {
  return authClient.admin.revokeUserSessions({
    userId,
  });
}

// Helper function to update a user's role (admin only)
export async function setUserRole(params: { userId: string; role: 'admin' | 'user' }) {
  return authClient.admin.setRole({
    userId: params.userId,
    role: params.role,
  });
}

// Helper function to remove a user (admin only)
export async function removeUser(userId: string) {
  return authClient.admin.removeUser({
    userId,
  });
}
