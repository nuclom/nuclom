'use client';

/**
 * Auth client re-exported from @nuclom/auth package
 *
 * This module exists for backwards compatibility - all auth functionality
 * is now consolidated in the @nuclom/auth package.
 *
 * For new code, prefer importing directly from '@nuclom/auth/client'
 */
export {
  addTeamMember,
  admin,
  authClient,
  type BillingPeriod,
  banUser,
  cancelSubscription,
  clearLastUsedLoginMethod,
  // Team helpers
  createTeam,
  createUser,
  getLastUsedLoginMethod,
  getSubscriptionStatus,
  hasActiveSubscription,
  impersonateUser,
  isLastUsedLoginMethod,
  listSubscriptions,
  listTeamMembers,
  listTeams,
  // Admin helpers
  listUsers,
  listUserTeams,
  multiSession,
  openBillingPortal,
  organization,
  removeTeam,
  removeTeamMember,
  removeUser,
  restoreSubscription,
  revokeUserSessions,
  // Types
  type SubscriptionPlan,
  setActiveTeam,
  setUserRole,
  signIn,
  signOut,
  signUp,
  stopImpersonation,
  subscription,
  unbanUser,
  updateTeam,
  // Subscription helpers
  upgradeSubscription,
  useActiveOrganization,
  useAuth,
  useRequireAuth,
  useSession,
} from '@nuclom/auth/client';
