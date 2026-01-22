/**
 * Slack Authentication Helpers
 *
 * OAuth flow and request signature verification utilities.
 */

import { SLACK_CONTENT_SCOPES } from './constants';

/**
 * Get Slack OAuth URL with content scopes
 */
export const getSlackContentAuthUrl = (clientId: string, redirectUri: string, state: string): string => {
  const scopes = SLACK_CONTENT_SCOPES.join(',');
  const params = new URLSearchParams({
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri,
    state,
  });
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
};

/**
 * Exchange Slack OAuth code for access token
 */
export const exchangeSlackCode = async (
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
): Promise<{
  access_token: string;
  token_type: string;
  scope: string;
  team: { id: string; name: string };
  authed_user: { id: string };
}> => {
  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Slack OAuth error: ${error}`);
  }

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Slack OAuth error: ${data.error || 'Unknown error'}`);
  }

  return data as {
    access_token: string;
    token_type: string;
    scope: string;
    team: { id: string; name: string };
    authed_user: { id: string };
  };
};

/**
 * Verify Slack request signature
 */
export const verifySlackSignature = (signature: string, timestamp: string, secret: string, body: string): boolean => {
  const crypto = require('node:crypto');
  const baseString = `v0:${timestamp}:${body}`;
  const expectedSignature = `v0=${crypto.createHmac('sha256', secret).update(baseString).digest('hex')}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch {
    return false;
  }
};
