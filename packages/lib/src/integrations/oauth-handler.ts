/**
 * OAuth Callback Handler Utilities
 *
 * Provides reusable utilities for OAuth callback handlers,
 * eliminating duplication across integration callback routes.
 */

import { Effect } from 'effect';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import type { IntegrationProvider } from '../db/schema';
import { IntegrationRepository } from '../effect/services/integration-repository';
import { logger } from '../logger';

// =============================================================================
// Types
// =============================================================================

export interface OAuthState {
  userId: string;
  organizationId: string;
  timestamp: number;
}

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string | null;
  expires_in?: number;
  scope?: string;
}

export interface OAuthCallbackResult {
  success: boolean;
  organizationId: string;
}

// =============================================================================
// State Utilities
// =============================================================================

/**
 * Parse and validate OAuth state from request
 */
export function parseOAuthState(state: string): OAuthState | null {
  try {
    return JSON.parse(Buffer.from(state, 'base64url').toString());
  } catch {
    return null;
  }
}

/**
 * Encode OAuth state for URL
 */
export function encodeOAuthState(state: OAuthState): string {
  return Buffer.from(JSON.stringify(state)).toString('base64url');
}

/**
 * Check if OAuth state has expired (default: 10 minutes)
 */
export function isStateExpired(timestamp: number, maxAgeMs = 600000): boolean {
  return Date.now() - timestamp > maxAgeMs;
}

// =============================================================================
// OAuth Callback Validation
// =============================================================================

/**
 * Validates OAuth callback parameters and returns parsed state.
 *
 * Handles common OAuth callback logic:
 * - Error handling from OAuth provider
 * - State validation and verification
 * - Cookie cleanup
 * - State expiration check
 *
 * @example
 * ```typescript
 * export async function GET(request: Request) {
 *   const validation = await validateOAuthCallback(request, "google");
 *   if (!validation.success) {
 *     return validation.redirect;
 *   }
 *   const { code, userId, organizationId } = validation;
 *   // ... exchange code for tokens
 * }
 * ```
 */
export async function validateOAuthCallback(
  request: Request,
  provider: string,
): Promise<
  | { success: true; code: string; state: OAuthState; organizationId: string; userId: string }
  | { success: false; redirect: Response }
> {
  await connection();

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const errorRedirectBase = '/settings/integrations';
  const providerKey = provider.toLowerCase();
  const stateCookieName = `${providerKey}_oauth_state`;

  // Handle OAuth errors from provider
  if (error) {
    logger.error('OAuth error from provider', undefined, {
      provider,
      error,
      errorDescription,
      component: 'oauth-handler',
    });
    return { success: false, redirect: redirect(`${errorRedirectBase}?error=${providerKey}_oauth_failed`) };
  }

  // Validate required parameters
  if (!code || !state) {
    return { success: false, redirect: redirect(`${errorRedirectBase}?error=${providerKey}_invalid_response`) };
  }

  // Verify state matches stored cookie
  const cookieStore = await cookies();
  const storedState = cookieStore.get(stateCookieName)?.value;

  if (!storedState || storedState !== state) {
    return { success: false, redirect: redirect(`${errorRedirectBase}?error=${providerKey}_state_mismatch`) };
  }

  // Clear the state cookie
  cookieStore.delete(stateCookieName);

  // Parse state
  const parsedState = parseOAuthState(state);
  if (!parsedState) {
    return { success: false, redirect: redirect(`${errorRedirectBase}?error=${providerKey}_invalid_state`) };
  }

  // Verify state is not expired (10 minutes)
  if (isStateExpired(parsedState.timestamp)) {
    return { success: false, redirect: redirect(`${errorRedirectBase}?error=${providerKey}_state_expired`) };
  }

  return {
    success: true,
    code,
    state: parsedState,
    organizationId: parsedState.organizationId,
    userId: parsedState.userId,
  };
}

// =============================================================================
// Integration Persistence
// =============================================================================

/**
 * Saves or updates an integration with the given tokens and metadata.
 *
 * Handles the common pattern of:
 * - Checking if integration already exists
 * - Updating existing integration (preserving refresh token if not provided)
 * - Creating new integration if none exists
 *
 * @example
 * ```typescript
 * yield* saveIntegration({
 *   userId,
 *   organizationId,
 *   provider: "google_meet",
 *   tokens: {
 *     access_token: tokens.access_token,
 *     refresh_token: tokens.refresh_token,
 *     expires_in: tokens.expires_in,
 *     scope: tokens.scope,
 *   },
 *   metadata: {
 *     email: userInfo.email,
 *   },
 * });
 * ```
 */
export function saveIntegration(params: {
  userId: string;
  organizationId: string;
  provider: IntegrationProvider;
  tokens: OAuthTokens;
  metadata: Record<string, unknown>;
}) {
  return Effect.gen(function* () {
    const integrationRepo = yield* IntegrationRepository;
    const { userId, organizationId, provider, tokens, metadata } = params;

    // Check if integration already exists
    const existingIntegration = yield* integrationRepo.getIntegrationByProvider(userId, provider);

    const integrationData = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? undefined,
      expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
      scope: tokens.scope,
      metadata,
    };

    if (existingIntegration) {
      yield* integrationRepo.updateIntegration(existingIntegration.id, {
        ...integrationData,
        refreshToken: integrationData.refreshToken ?? existingIntegration.refreshToken ?? undefined,
      });
    } else {
      yield* integrationRepo.createIntegration({
        userId,
        organizationId,
        provider,
        ...integrationData,
      });
    }

    return { success: true };
  });
}

// =============================================================================
// Redirect Helpers
// =============================================================================

/**
 * Creates a redirect response for successful OAuth callback
 */
export function successRedirect(organizationId: string, provider: string): Response {
  return redirect(`/org/${organizationId}/settings/integrations?success=${provider.toLowerCase()}`);
}

/**
 * Creates a redirect response for failed OAuth callback
 */
export function errorRedirect(organizationId: string, provider: string): Response {
  return redirect(`/org/${organizationId}/settings/integrations?error=${provider.toLowerCase()}_callback_failed`);
}
