/**
 * Slack Integration Service using Effect-TS
 *
 * Provides type-safe Slack API operations for OAuth and messaging.
 */

import type {
  ChatPostMessageArguments,
  ChatPostMessageResponse,
  ConversationsListResponse,
  KnownBlock,
  OauthV2AccessResponse,
  UsersIdentityResponse,
} from '@slack/web-api';
import { Config, Context, Effect, Layer, Option } from 'effect';
import { HttpError } from '../errors';
import { SlackClient } from './slack-client';

// =============================================================================
// Types
// =============================================================================

export interface SlackConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly signingSecret: string;
}

export type SlackTokenResponse = OauthV2AccessResponse;
export type SlackUserInfo = UsersIdentityResponse;
export type SlackChannelsResponse = ConversationsListResponse;
export type SlackMessagePayload = ChatPostMessageArguments;
export type SlackMessageResponse = ChatPostMessageResponse;

// =============================================================================
// Slack Service Interface
// =============================================================================

export interface SlackServiceInterface {
  /**
   * Check if the Slack integration is configured
   */
  readonly isConfigured: boolean;

  /**
   * Get the OAuth authorization URL
   */
  readonly getAuthorizationUrl: (state: string) => Effect.Effect<string, never>;

  /**
   * Exchange authorization code for access token
   */
  readonly exchangeCodeForToken: (code: string) => Effect.Effect<SlackTokenResponse, HttpError>;

  /**
   * Get the current user's info
   */
  readonly getUserInfo: (accessToken: string) => Effect.Effect<SlackUserInfo, HttpError>;

  /**
   * List channels the bot has access to
   */
  readonly listChannels: (accessToken: string, cursor?: string) => Effect.Effect<SlackChannelsResponse, HttpError>;

  /**
   * Send a message to a channel
   */
  readonly sendMessage: (
    accessToken: string,
    payload: SlackMessagePayload,
  ) => Effect.Effect<SlackMessageResponse, HttpError>;

  /**
   * Send a video notification to Slack
   */
  readonly sendVideoNotification: (
    accessToken: string,
    channel: string,
    videoTitle: string,
    videoUrl: string,
    thumbnailUrl?: string,
    authorName?: string,
  ) => Effect.Effect<SlackMessageResponse, HttpError>;

  /**
   * Verify a webhook signature from Slack
   */
  readonly verifySignature: (signature: string, timestamp: string, body: string) => Effect.Effect<boolean, never>;
}

// =============================================================================
// Slack Service Tag
// =============================================================================

export class Slack extends Context.Tag('Slack')<Slack, SlackServiceInterface>() {}

// =============================================================================
// Slack Configuration
// =============================================================================

const SLACK_AUTH_BASE = 'https://slack.com';

const SlackConfigEffect = Config.all({
  clientId: Config.string('SLACK_CLIENT_ID').pipe(Config.option),
  clientSecret: Config.string('SLACK_CLIENT_SECRET').pipe(Config.option),
  signingSecret: Config.string('SLACK_SIGNING_SECRET').pipe(Config.option),
  baseUrl: Config.string('NEXT_PUBLIC_URL').pipe(Config.option),
});

// =============================================================================
// Slack Service Implementation
// =============================================================================

const makeSlackService = Effect.gen(function* () {
  const config = yield* SlackConfigEffect;
  const slackClient = yield* SlackClient;

  const isConfigured =
    Option.isSome(config.clientId) &&
    Option.isSome(config.clientSecret) &&
    Option.isSome(config.signingSecret) &&
    Option.isSome(config.baseUrl);

  const getConfig = (): SlackConfig | null => {
    if (!isConfigured) return null;
    return {
      clientId: Option.getOrThrow(config.clientId),
      clientSecret: Option.getOrThrow(config.clientSecret),
      signingSecret: Option.getOrThrow(config.signingSecret),
      redirectUri: `${Option.getOrThrow(config.baseUrl)}/api/integrations/slack/callback`,
    };
  };

  const getAuthorizationUrl = (state: string): Effect.Effect<string, never> =>
    Effect.sync(() => {
      const cfg = getConfig();
      if (!cfg) {
        throw new Error('Slack is not configured');
      }

      const scopes = ['channels:read', 'chat:write', 'incoming-webhook', 'users:read', 'users:read.email'].join(',');

      const params = new URLSearchParams({
        client_id: cfg.clientId,
        scope: scopes,
        redirect_uri: cfg.redirectUri,
        state,
      });

      return `${SLACK_AUTH_BASE}/oauth/v2/authorize?${params.toString()}`;
    });

  const exchangeCodeForToken = (code: string): Effect.Effect<SlackTokenResponse, HttpError> =>
    Effect.gen(function* () {
      const cfg = getConfig();
      if (!cfg) {
        return yield* Effect.fail(
          new HttpError({
            message: 'Slack is not configured',
            status: 503,
          }),
        );
      }

      const response = yield* Effect.gen(function* () {
        const client = yield* slackClient.create();
        return yield* Effect.tryPromise({
          try: async () => {
            const data = await client.oauth.v2.access({
              client_id: cfg.clientId,
              client_secret: cfg.clientSecret,
              code,
              redirect_uri: cfg.redirectUri,
            });

            if (!data.ok) {
              throw new Error(`Slack token exchange failed: ${data.error || 'Unknown error'}`);
            }

            return data;
          },
          catch: (error) =>
            new HttpError({
              message: `Failed to exchange code for token: ${error instanceof Error ? error.message : 'Unknown error'}`,
              status: 500,
            }),
        });
      });

      return response;
    });

  const getUserInfo = (accessToken: string): Effect.Effect<SlackUserInfo, HttpError> =>
    Effect.gen(function* () {
      const client = yield* slackClient.create(accessToken);
      return yield* Effect.tryPromise({
        try: async () => {
          const data = await client.users.identity({});
          if (!data.ok) {
            throw new Error(`Slack API error: ${JSON.stringify(data)}`);
          }
          return data;
        },
        catch: (error) =>
          new HttpError({
            message: `Failed to get user info: ${error instanceof Error ? error.message : 'Unknown error'}`,
            status: 500,
          }),
      });
    });

  const listChannels = (accessToken: string, cursor?: string): Effect.Effect<SlackChannelsResponse, HttpError> =>
    Effect.gen(function* () {
      const client = yield* slackClient.create(accessToken);
      return yield* Effect.tryPromise({
        try: async () => {
          const data = await client.conversations.list({
            types: 'public_channel,private_channel',
            exclude_archived: true,
            limit: 100,
            cursor,
          });

          if (!data.ok) {
            throw new Error(`Slack API error: ${JSON.stringify(data)}`);
          }

          return data;
        },
        catch: (error) =>
          new HttpError({
            message: `Failed to list channels: ${error instanceof Error ? error.message : 'Unknown error'}`,
            status: 500,
          }),
      });
    });

  const sendMessage = (
    accessToken: string,
    payload: SlackMessagePayload,
  ): Effect.Effect<SlackMessageResponse, HttpError> =>
    Effect.gen(function* () {
      const client = yield* slackClient.create(accessToken);
      return yield* Effect.tryPromise({
        try: async () => {
          const data = await client.chat.postMessage(payload);
          if (!data.ok) {
            throw new Error(`Slack API error: ${JSON.stringify(data)}`);
          }
          return data;
        },
        catch: (error) =>
          new HttpError({
            message: `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`,
            status: 500,
          }),
      });
    });

  const sendVideoNotification = (
    accessToken: string,
    channel: string,
    videoTitle: string,
    videoUrl: string,
    thumbnailUrl?: string,
    authorName?: string,
  ): Effect.Effect<SlackMessageResponse, HttpError> => {
    const blocks: KnownBlock[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:movie_camera: *New Video*\n*${videoTitle}*${authorName ? `\nBy ${authorName}` : ''}`,
        },
        accessory: thumbnailUrl
          ? {
              type: 'image',
              image_url: thumbnailUrl,
              alt_text: videoTitle,
            }
          : undefined,
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Watch Video',
              emoji: true,
            },
            url: videoUrl,
            action_id: 'watch_video',
          },
        ],
      },
    ];

    return sendMessage(accessToken, {
      channel,
      text: `New video: ${videoTitle}`,
      blocks,
      unfurl_links: false,
      unfurl_media: false,
    });
  };

  const verifySignature = (signature: string, timestamp: string, body: string): Effect.Effect<boolean, never> =>
    Effect.sync(() => {
      const cfg = getConfig();
      if (!cfg) return false;

      // Check timestamp is within 5 minutes
      const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
      if (Number.parseInt(timestamp, 10) < fiveMinutesAgo) {
        return false;
      }

      // Compute expected signature
      const sigBaseString = `v0:${timestamp}:${body}`;
      const crypto = require('node:crypto');
      const hmac = crypto.createHmac('sha256', cfg.signingSecret);
      hmac.update(sigBaseString);
      const expectedSignature = `v0=${hmac.digest('hex')}`;

      // Compare signatures using timing-safe comparison
      try {
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
      } catch {
        return false;
      }
    });

  return {
    isConfigured,
    getAuthorizationUrl,
    exchangeCodeForToken,
    getUserInfo,
    listChannels,
    sendMessage,
    sendVideoNotification,
    verifySignature,
  } satisfies SlackServiceInterface;
});

// =============================================================================
// Slack Layer
// =============================================================================

export const SlackLive = Layer.effect(Slack, makeSlackService);

// =============================================================================
// Slack Helper Functions
// =============================================================================

export const getSlackAuthorizationUrl = (state: string): Effect.Effect<string, never, Slack> =>
  Effect.gen(function* () {
    const slack = yield* Slack;
    return yield* slack.getAuthorizationUrl(state);
  });

export const exchangeSlackCodeForToken = (code: string): Effect.Effect<SlackTokenResponse, HttpError, Slack> =>
  Effect.gen(function* () {
    const slack = yield* Slack;
    return yield* slack.exchangeCodeForToken(code);
  });

export const getSlackUserInfo = (accessToken: string): Effect.Effect<SlackUserInfo, HttpError, Slack> =>
  Effect.gen(function* () {
    const slack = yield* Slack;
    return yield* slack.getUserInfo(accessToken);
  });

export const listSlackChannels = (
  accessToken: string,
  cursor?: string,
): Effect.Effect<SlackChannelsResponse, HttpError, Slack> =>
  Effect.gen(function* () {
    const slack = yield* Slack;
    return yield* slack.listChannels(accessToken, cursor);
  });

export const sendSlackMessage = (
  accessToken: string,
  payload: SlackMessagePayload,
): Effect.Effect<SlackMessageResponse, HttpError, Slack> =>
  Effect.gen(function* () {
    const slack = yield* Slack;
    return yield* slack.sendMessage(accessToken, payload);
  });

export const sendSlackVideoNotification = (
  accessToken: string,
  channel: string,
  videoTitle: string,
  videoUrl: string,
  thumbnailUrl?: string,
  authorName?: string,
): Effect.Effect<SlackMessageResponse, HttpError, Slack> =>
  Effect.gen(function* () {
    const slack = yield* Slack;
    return yield* slack.sendVideoNotification(accessToken, channel, videoTitle, videoUrl, thumbnailUrl, authorName);
  });

export const verifySlackSignature = (
  signature: string,
  timestamp: string,
  body: string,
): Effect.Effect<boolean, never, Slack> =>
  Effect.gen(function* () {
    const slack = yield* Slack;
    return yield* slack.verifySignature(signature, timestamp, body);
  });
