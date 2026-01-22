/**
 * Slack Authentication Helpers
 *
 * OAuth flow and request signature verification utilities.
 */

import type { OauthV2AccessResponse } from '@slack/web-api';
import { Effect } from 'effect';
import { SlackClient } from '../../slack-client';
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
export const exchangeSlackCode = (
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
): Effect.Effect<OauthV2AccessResponse, Error, SlackClient> =>
  Effect.gen(function* () {
    const slackClient = yield* SlackClient;
    const client = yield* slackClient.create();
    return yield* Effect.tryPromise({
      try: async () => {
        const data = await client.oauth.v2.access({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
        });

        if (!data.ok) {
          throw new Error(`Slack OAuth error: ${data.error || 'Unknown error'}`);
        }

        return data;
      },
      catch: (error) => {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return new Error(`Slack OAuth error: ${message}`);
      },
    });
  });

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
