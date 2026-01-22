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

/**
 * Exchange GitHub OAuth code for access token
 */
export const exchangeGitHubCode = async (
  clientId: string,
  clientSecret: string,
  code: string,
): Promise<{ access_token: string; token_type: string; scope: string }> => {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub OAuth error: ${error}`);
  }

  return (await response.json()) as { access_token: string; token_type: string; scope: string };
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
