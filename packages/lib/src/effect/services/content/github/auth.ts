/**
 * GitHub Authentication Helpers
 *
 * OAuth flow and webhook signature verification utilities.
 */

// =============================================================================
// OAuth Helpers
// =============================================================================

/**
 * Get GitHub OAuth authorization URL
 */
export const getGitHubAuthUrl = (clientId: string, redirectUri: string, state: string, scope?: string): string => {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: scope || 'repo read:org read:user',
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
};

import { exchangeWebFlowCode } from '@octokit/oauth-methods';

/**
 * Exchange GitHub OAuth code for access token
 */
export const exchangeGitHubCode = async (
  clientId: string,
  clientSecret: string,
  code: string,
): Promise<{ access_token: string; token_type: string; scope: string }> => {
  try {
    const result = await exchangeWebFlowCode({
      clientType: 'oauth-app',
      clientId,
      clientSecret,
      code,
    });

    return {
      access_token: result.data.access_token,
      token_type: result.data.token_type,
      scope: result.data.scope ?? '',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`GitHub OAuth error: ${message}`);
  }
};

// =============================================================================
// Webhook Helpers
// =============================================================================

/**
 * Verify GitHub webhook signature
 */
export const verifyGitHubWebhookSignature = (signature: string, secret: string, body: string): boolean => {
  const crypto = require('node:crypto');
  const expectedSignature = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch {
    return false;
  }
};
