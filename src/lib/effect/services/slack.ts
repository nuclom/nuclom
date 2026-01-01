/**
 * Slack Integration Service using Effect-TS
 *
 * Provides type-safe Slack API operations for OAuth and messaging.
 */

import { Config, Context, Effect, Layer, Option } from "effect";
import { HttpError } from "../errors";

// =============================================================================
// Types
// =============================================================================

export interface SlackConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly signingSecret: string;
}

export interface SlackTokenResponse {
  readonly ok: boolean;
  readonly access_token: string;
  readonly token_type: string;
  readonly scope: string;
  readonly bot_user_id?: string;
  readonly app_id: string;
  readonly team: {
    readonly id: string;
    readonly name: string;
  };
  readonly authed_user: {
    readonly id: string;
    readonly scope: string;
    readonly access_token: string;
    readonly token_type: string;
  };
  readonly incoming_webhook?: {
    readonly channel: string;
    readonly channel_id: string;
    readonly configuration_url: string;
    readonly url: string;
  };
}

export interface SlackUserInfo {
  readonly ok: boolean;
  readonly user: {
    readonly id: string;
    readonly team_id: string;
    readonly name: string;
    readonly real_name: string;
    readonly profile: {
      readonly email?: string;
      readonly image_48?: string;
      readonly image_72?: string;
      readonly image_192?: string;
    };
  };
}

export interface SlackChannel {
  readonly id: string;
  readonly name: string;
  readonly is_private: boolean;
  readonly is_member: boolean;
}

export interface SlackChannelsResponse {
  readonly ok: boolean;
  readonly channels: SlackChannel[];
  readonly response_metadata?: {
    readonly next_cursor?: string;
  };
}

export interface SlackMessagePayload {
  readonly channel: string;
  readonly text?: string;
  readonly blocks?: SlackBlock[];
  readonly attachments?: SlackAttachment[];
  readonly thread_ts?: string;
  readonly unfurl_links?: boolean;
  readonly unfurl_media?: boolean;
}

export interface SlackBlock {
  readonly type: string;
  readonly text?: {
    readonly type: string;
    readonly text: string;
    readonly emoji?: boolean;
  };
  readonly accessory?: Record<string, unknown>;
  readonly elements?: SlackBlockElement[];
}

export interface SlackBlockElement {
  readonly type: string;
  readonly text?: {
    readonly type: string;
    readonly text: string;
    readonly emoji?: boolean;
  };
  readonly url?: string;
  readonly action_id?: string;
  readonly value?: string;
}

export interface SlackAttachment {
  readonly color?: string;
  readonly pretext?: string;
  readonly title?: string;
  readonly title_link?: string;
  readonly text?: string;
  readonly fields?: {
    readonly title: string;
    readonly value: string;
    readonly short?: boolean;
  }[];
  readonly image_url?: string;
  readonly thumb_url?: string;
  readonly footer?: string;
  readonly ts?: number;
}

export interface SlackMessageResponse {
  readonly ok: boolean;
  readonly channel: string;
  readonly ts: string;
  readonly message: {
    readonly text: string;
    readonly user: string;
    readonly ts: string;
  };
}

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

export class Slack extends Context.Tag("Slack")<Slack, SlackServiceInterface>() {}

// =============================================================================
// Slack Configuration
// =============================================================================

const SLACK_API_BASE = "https://slack.com/api";
const SLACK_AUTH_BASE = "https://slack.com";

const SlackConfigEffect = Config.all({
  clientId: Config.string("SLACK_CLIENT_ID").pipe(Config.option),
  clientSecret: Config.string("SLACK_CLIENT_SECRET").pipe(Config.option),
  signingSecret: Config.string("SLACK_SIGNING_SECRET").pipe(Config.option),
  baseUrl: Config.string("NEXT_PUBLIC_URL").pipe(Config.option),
});

// =============================================================================
// Slack Service Implementation
// =============================================================================

const makeSlackService = Effect.gen(function* () {
  const config = yield* SlackConfigEffect;

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
        throw new Error("Slack is not configured");
      }

      const scopes = ["channels:read", "chat:write", "incoming-webhook", "users:read", "users:read.email"].join(",");

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
            message: "Slack is not configured",
            status: 503,
          }),
        );
      }

      const response = yield* Effect.tryPromise({
        try: async () => {
          const res = await fetch(`${SLACK_API_BASE}/oauth.v2.access`, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              client_id: cfg.clientId,
              client_secret: cfg.clientSecret,
              code,
              redirect_uri: cfg.redirectUri,
            }),
          });

          if (!res.ok) {
            const error = await res.text();
            throw new Error(`Slack token exchange failed: ${res.status} - ${error}`);
          }

          const data = (await res.json()) as SlackTokenResponse;
          if (!data.ok) {
            throw new Error(`Slack token exchange failed: ${JSON.stringify(data)}`);
          }

          return data;
        },
        catch: (error) =>
          new HttpError({
            message: `Failed to exchange code for token: ${error instanceof Error ? error.message : "Unknown error"}`,
            status: 500,
          }),
      });

      return response;
    });

  const getUserInfo = (accessToken: string): Effect.Effect<SlackUserInfo, HttpError> =>
    Effect.tryPromise({
      try: async () => {
        const res = await fetch(`${SLACK_API_BASE}/users.identity`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!res.ok) {
          const error = await res.text();
          throw new Error(`Slack API error: ${res.status} - ${error}`);
        }

        const data = (await res.json()) as SlackUserInfo;
        if (!data.ok) {
          throw new Error(`Slack API error: ${JSON.stringify(data)}`);
        }

        return data;
      },
      catch: (error) =>
        new HttpError({
          message: `Failed to get user info: ${error instanceof Error ? error.message : "Unknown error"}`,
          status: 500,
        }),
    });

  const listChannels = (accessToken: string, cursor?: string): Effect.Effect<SlackChannelsResponse, HttpError> =>
    Effect.tryPromise({
      try: async () => {
        const params = new URLSearchParams({
          types: "public_channel,private_channel",
          exclude_archived: "true",
          limit: "100",
        });

        if (cursor) {
          params.set("cursor", cursor);
        }

        const res = await fetch(`${SLACK_API_BASE}/conversations.list?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!res.ok) {
          const error = await res.text();
          throw new Error(`Slack API error: ${res.status} - ${error}`);
        }

        const data = (await res.json()) as SlackChannelsResponse;
        if (!data.ok) {
          throw new Error(`Slack API error: ${JSON.stringify(data)}`);
        }

        return data;
      },
      catch: (error) =>
        new HttpError({
          message: `Failed to list channels: ${error instanceof Error ? error.message : "Unknown error"}`,
          status: 500,
        }),
    });

  const sendMessage = (
    accessToken: string,
    payload: SlackMessagePayload,
  ): Effect.Effect<SlackMessageResponse, HttpError> =>
    Effect.tryPromise({
      try: async () => {
        const res = await fetch(`${SLACK_API_BASE}/chat.postMessage`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const error = await res.text();
          throw new Error(`Slack API error: ${res.status} - ${error}`);
        }

        const data = (await res.json()) as SlackMessageResponse;
        if (!data.ok) {
          throw new Error(`Slack API error: ${JSON.stringify(data)}`);
        }

        return data;
      },
      catch: (error) =>
        new HttpError({
          message: `Failed to send message: ${error instanceof Error ? error.message : "Unknown error"}`,
          status: 500,
        }),
    });

  const sendVideoNotification = (
    accessToken: string,
    channel: string,
    videoTitle: string,
    videoUrl: string,
    thumbnailUrl?: string,
    authorName?: string,
  ): Effect.Effect<SlackMessageResponse, HttpError> => {
    const blocks: SlackBlock[] = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:movie_camera: *New Video*\n*${videoTitle}*${authorName ? `\nBy ${authorName}` : ""}`,
        },
        accessory: thumbnailUrl
          ? {
              type: "image",
              image_url: thumbnailUrl,
              alt_text: videoTitle,
            }
          : undefined,
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Watch Video",
              emoji: true,
            },
            url: videoUrl,
            action_id: "watch_video",
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
      const crypto = require("node:crypto");
      const hmac = crypto.createHmac("sha256", cfg.signingSecret);
      hmac.update(sigBaseString);
      const expectedSignature = `v0=${hmac.digest("hex")}`;

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
