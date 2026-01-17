'use client';

import process from 'node:process';
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
import { ac, organizationRoles } from './access-control';

// Determine baseURL from Vercel automatic environment variables or browser origin
const getBaseURL = () => {
  // In browser, use current origin (most reliable)
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  // In SSR, derive from Vercel automatic env vars
  if (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
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

// Export convenient hooks and methods
export const { useSession, signIn, signOut, signUp, useActiveOrganization, organization, subscription, multiSession } =
  authClient;

// Export admin methods
export const { admin } = authClient;

// Last login method helpers
export const { getLastUsedLoginMethod, isLastUsedLoginMethod, clearLastUsedLoginMethod } = authClient;

// Helper types for subscription management
export type SubscriptionPlan = 'scale' | 'pro';
export type BillingPeriod = 'monthly' | 'yearly';

// Subscription helpers
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

export async function listSubscriptions(referenceId: string) {
  return authClient.subscription.list({
    query: { referenceId },
  });
}

export async function cancelSubscription(subscriptionId: string, returnUrl: string) {
  return authClient.subscription.cancel({
    subscriptionId,
    returnUrl,
  });
}

export async function restoreSubscription(subscriptionId: string) {
  return authClient.subscription.restore({
    subscriptionId,
  });
}

export async function openBillingPortal(returnUrl: string) {
  return authClient.subscription.billingPortal({
    returnUrl,
  });
}

export function hasActiveSubscription(subscriptions: Array<{ status: string }>) {
  return subscriptions.some((sub) => sub.status === 'active' || sub.status === 'trialing');
}

export function getSubscriptionStatus(subscriptions: Array<{ status: string; plan: string }>) {
  const activeSub = subscriptions.find((sub) => sub.status === 'active' || sub.status === 'trialing');
  return activeSub
    ? { isActive: true, plan: activeSub.plan, status: activeSub.status }
    : { isActive: false, plan: 'free', status: 'none' };
}

// Team management helpers
export async function createTeam(params: { name: string; organizationId: string }) {
  return authClient.organization.createTeam({
    name: params.name,
    organizationId: params.organizationId,
  });
}

export async function listTeams(organizationId: string) {
  return authClient.organization.listTeams({
    query: { organizationId },
  });
}

export async function updateTeam(params: { teamId: string; data: { name?: string } }) {
  return authClient.organization.updateTeam({
    teamId: params.teamId,
    data: params.data,
  });
}

export async function removeTeam(teamId: string) {
  return authClient.organization.removeTeam({
    teamId,
  });
}

export async function setActiveTeam(teamId: string) {
  return authClient.organization.setActiveTeam({
    teamId,
  });
}

export async function addTeamMember(params: { teamId: string; userId: string }) {
  return authClient.organization.addTeamMember({
    teamId: params.teamId,
    userId: params.userId,
  });
}

export async function removeTeamMember(params: { teamId: string; userId: string }) {
  return authClient.organization.removeTeamMember({
    teamId: params.teamId,
    userId: params.userId,
  });
}

export async function listTeamMembers(teamId: string) {
  return authClient.organization.listTeamMembers({
    query: { teamId },
  });
}

export async function listUserTeams() {
  return authClient.organization.listUserTeams({});
}

// Admin user management helpers
export async function listUsers(params?: { limit?: number; offset?: number; search?: string }) {
  return authClient.admin.listUsers({
    query: {
      limit: params?.limit,
      offset: params?.offset,
      searchValue: params?.search,
    },
  });
}

export async function createUser(params: { email: string; name: string; password: string; role?: 'admin' | 'user' }) {
  return authClient.admin.createUser({
    email: params.email,
    name: params.name,
    password: params.password,
    role: params.role || 'user',
  });
}

export async function banUser(params: { userId: string; reason?: string; expiresIn?: number }) {
  return authClient.admin.banUser({
    userId: params.userId,
    banReason: params.reason,
    banExpiresIn: params.expiresIn,
  });
}

export async function unbanUser(userId: string) {
  return authClient.admin.unbanUser({
    userId,
  });
}

export async function impersonateUser(userId: string) {
  return authClient.admin.impersonateUser({
    userId,
  });
}

export async function stopImpersonation() {
  return authClient.admin.stopImpersonating();
}

export async function revokeUserSessions(userId: string) {
  return authClient.admin.revokeUserSessions({
    userId,
  });
}

export async function setUserRole(params: { userId: string; role: 'admin' | 'user' }) {
  return authClient.admin.setRole({
    userId: params.userId,
    role: params.role,
  });
}

export async function removeUser(userId: string) {
  return authClient.admin.removeUser({
    userId,
  });
}
