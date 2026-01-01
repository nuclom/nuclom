/**
 * Microsoft Teams Integration Service using Effect-TS
 *
 * Provides type-safe Microsoft Graph API operations for OAuth and messaging.
 */

import { Config, Context, Effect, Layer, Option } from "effect";
import { HttpError } from "../errors";

// =============================================================================
// Types
// =============================================================================

export interface MicrosoftTeamsConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly tenantId: string;
}

export interface MicrosoftTokenResponse {
  readonly access_token: string;
  readonly token_type: string;
  readonly expires_in: number;
  readonly scope: string;
  readonly refresh_token?: string;
}

export interface MicrosoftUserInfo {
  readonly id: string;
  readonly displayName: string;
  readonly mail: string;
  readonly userPrincipalName: string;
  readonly jobTitle?: string;
  readonly officeLocation?: string;
}

export interface TeamsChannel {
  readonly id: string;
  readonly displayName: string;
  readonly description?: string;
  readonly webUrl: string;
  readonly membershipType: "standard" | "private" | "unknownFutureValue";
}

export interface TeamsTeam {
  readonly id: string;
  readonly displayName: string;
  readonly description?: string;
  readonly webUrl: string;
}

export interface TeamsChannelsResponse {
  readonly value: TeamsChannel[];
  readonly "@odata.nextLink"?: string;
}

export interface TeamsTeamsResponse {
  readonly value: TeamsTeam[];
  readonly "@odata.nextLink"?: string;
}

export interface TeamsMessagePayload {
  readonly body: {
    readonly contentType: "text" | "html";
    readonly content: string;
  };
  readonly attachments?: TeamsAttachment[];
}

export interface TeamsAttachment {
  readonly id: string;
  readonly contentType: string;
  readonly contentUrl?: string;
  readonly name?: string;
  readonly content?: string;
  readonly thumbnailUrl?: string;
}

export interface TeamsAdaptiveCard {
  readonly type: "AdaptiveCard";
  readonly body: TeamsAdaptiveCardElement[];
  readonly actions?: TeamsAdaptiveCardAction[];
  readonly "$schema": string;
  readonly version: string;
}

export interface TeamsAdaptiveCardElement {
  readonly type: string;
  readonly text?: string;
  readonly size?: string;
  readonly weight?: string;
  readonly url?: string;
  readonly altText?: string;
  readonly columns?: TeamsAdaptiveCardColumn[];
  readonly items?: TeamsAdaptiveCardElement[];
  readonly wrap?: boolean;
}

export interface TeamsAdaptiveCardColumn {
  readonly type: "Column";
  readonly width: string | number;
  readonly items: TeamsAdaptiveCardElement[];
}

export interface TeamsAdaptiveCardAction {
  readonly type: string;
  readonly title: string;
  readonly url?: string;
  readonly data?: Record<string, unknown>;
}

export interface TeamsMessageResponse {
  readonly id: string;
  readonly createdDateTime: string;
  readonly body: {
    readonly contentType: string;
    readonly content: string;
  };
  readonly from: {
    readonly user?: {
      readonly id: string;
      readonly displayName: string;
    };
    readonly application?: {
      readonly id: string;
      readonly displayName: string;
    };
  };
}

// =============================================================================
// Microsoft Teams Service Interface
// =============================================================================

export interface MicrosoftTeamsServiceInterface {
  /**
   * Check if the Microsoft Teams integration is configured
   */
  readonly isConfigured: boolean;

  /**
   * Get the OAuth authorization URL
   */
  readonly getAuthorizationUrl: (state: string) => Effect.Effect<string, never>;

  /**
   * Exchange authorization code for access token
   */
  readonly exchangeCodeForToken: (code: string) => Effect.Effect<MicrosoftTokenResponse, HttpError>;

  /**
   * Refresh an access token
   */
  readonly refreshAccessToken: (refreshToken: string) => Effect.Effect<MicrosoftTokenResponse, HttpError>;

  /**
   * Get the current user's info
   */
  readonly getUserInfo: (accessToken: string) => Effect.Effect<MicrosoftUserInfo, HttpError>;

  /**
   * List teams the user is a member of
   */
  readonly listTeams: (accessToken: string) => Effect.Effect<TeamsTeamsResponse, HttpError>;

  /**
   * List channels in a team
   */
  readonly listChannels: (
    accessToken: string,
    teamId: string,
  ) => Effect.Effect<TeamsChannelsResponse, HttpError>;

  /**
   * Send a message to a channel
   */
  readonly sendMessage: (
    accessToken: string,
    teamId: string,
    channelId: string,
    payload: TeamsMessagePayload,
  ) => Effect.Effect<TeamsMessageResponse, HttpError>;

  /**
   * Send a video notification card to Teams
   */
  readonly sendVideoNotification: (
    accessToken: string,
    teamId: string,
    channelId: string,
    videoTitle: string,
    videoUrl: string,
    thumbnailUrl?: string,
    authorName?: string,
    description?: string,
  ) => Effect.Effect<TeamsMessageResponse, HttpError>;
}

// =============================================================================
// Microsoft Teams Service Tag
// =============================================================================

export class MicrosoftTeams extends Context.Tag("MicrosoftTeams")<
  MicrosoftTeams,
  MicrosoftTeamsServiceInterface
>() {}

// =============================================================================
// Microsoft Teams Configuration
// =============================================================================

const MICROSOFT_AUTH_BASE = "https://login.microsoftonline.com";
const MICROSOFT_GRAPH_BASE = "https://graph.microsoft.com/v1.0";

const MicrosoftTeamsConfigEffect = Config.all({
  clientId: Config.string("MICROSOFT_CLIENT_ID").pipe(Config.option),
  clientSecret: Config.string("MICROSOFT_CLIENT_SECRET").pipe(Config.option),
  tenantId: Config.string("MICROSOFT_TENANT_ID").pipe(Config.withDefault("common"), Config.option),
  baseUrl: Config.string("NEXT_PUBLIC_URL").pipe(Config.option),
});

// =============================================================================
// Microsoft Teams Service Implementation
// =============================================================================

const makeMicrosoftTeamsService = Effect.gen(function* () {
  const config = yield* MicrosoftTeamsConfigEffect;

  const isConfigured =
    Option.isSome(config.clientId) &&
    Option.isSome(config.clientSecret) &&
    Option.isSome(config.baseUrl);

  const getConfig = (): MicrosoftTeamsConfig | null => {
    if (!isConfigured) return null;
    return {
      clientId: Option.getOrThrow(config.clientId),
      clientSecret: Option.getOrThrow(config.clientSecret),
      tenantId: Option.isSome(config.tenantId) ? Option.getOrThrow(config.tenantId) : "common",
      redirectUri: `${Option.getOrThrow(config.baseUrl)}/api/integrations/teams/callback`,
    };
  };

  const getAuthorizationUrl = (state: string): Effect.Effect<string, never> =>
    Effect.sync(() => {
      const cfg = getConfig();
      if (!cfg) {
        throw new Error("Microsoft Teams is not configured");
      }

      const scopes = [
        "User.Read",
        "Team.ReadBasic.All",
        "Channel.ReadBasic.All",
        "ChannelMessage.Send",
        "offline_access",
      ].join(" ");

      const params = new URLSearchParams({
        client_id: cfg.clientId,
        response_type: "code",
        redirect_uri: cfg.redirectUri,
        scope: scopes,
        state,
        response_mode: "query",
      });

      return `${MICROSOFT_AUTH_BASE}/${cfg.tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
    });

  const exchangeCodeForToken = (code: string): Effect.Effect<MicrosoftTokenResponse, HttpError> =>
    Effect.gen(function* () {
      const cfg = getConfig();
      if (!cfg) {
        return yield* Effect.fail(
          new HttpError({
            message: "Microsoft Teams is not configured",
            status: 503,
          }),
        );
      }

      const response = yield* Effect.tryPromise({
        try: async () => {
          const res = await fetch(
            `${MICROSOFT_AUTH_BASE}/${cfg.tenantId}/oauth2/v2.0/token`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                client_id: cfg.clientId,
                client_secret: cfg.clientSecret,
                code,
                redirect_uri: cfg.redirectUri,
                grant_type: "authorization_code",
              }),
            },
          );

          if (!res.ok) {
            const error = await res.text();
            throw new Error(`Microsoft token exchange failed: ${res.status} - ${error}`);
          }

          return res.json() as Promise<MicrosoftTokenResponse>;
        },
        catch: (error) =>
          new HttpError({
            message: `Failed to exchange code for token: ${error instanceof Error ? error.message : "Unknown error"}`,
            status: 500,
          }),
      });

      return response;
    });

  const refreshAccessToken = (
    refreshToken: string,
  ): Effect.Effect<MicrosoftTokenResponse, HttpError> =>
    Effect.gen(function* () {
      const cfg = getConfig();
      if (!cfg) {
        return yield* Effect.fail(
          new HttpError({
            message: "Microsoft Teams is not configured",
            status: 503,
          }),
        );
      }

      const response = yield* Effect.tryPromise({
        try: async () => {
          const res = await fetch(
            `${MICROSOFT_AUTH_BASE}/${cfg.tenantId}/oauth2/v2.0/token`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                client_id: cfg.clientId,
                client_secret: cfg.clientSecret,
                refresh_token: refreshToken,
                grant_type: "refresh_token",
              }),
            },
          );

          if (!res.ok) {
            const error = await res.text();
            throw new Error(`Microsoft token refresh failed: ${res.status} - ${error}`);
          }

          return res.json() as Promise<MicrosoftTokenResponse>;
        },
        catch: (error) =>
          new HttpError({
            message: `Failed to refresh access token: ${error instanceof Error ? error.message : "Unknown error"}`,
            status: 500,
          }),
      });

      return response;
    });

  const getUserInfo = (accessToken: string): Effect.Effect<MicrosoftUserInfo, HttpError> =>
    Effect.tryPromise({
      try: async () => {
        const res = await fetch(`${MICROSOFT_GRAPH_BASE}/me`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!res.ok) {
          const error = await res.text();
          throw new Error(`Microsoft Graph API error: ${res.status} - ${error}`);
        }

        return res.json() as Promise<MicrosoftUserInfo>;
      },
      catch: (error) =>
        new HttpError({
          message: `Failed to get user info: ${error instanceof Error ? error.message : "Unknown error"}`,
          status: 500,
        }),
    });

  const listTeams = (accessToken: string): Effect.Effect<TeamsTeamsResponse, HttpError> =>
    Effect.tryPromise({
      try: async () => {
        const res = await fetch(`${MICROSOFT_GRAPH_BASE}/me/joinedTeams`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!res.ok) {
          const error = await res.text();
          throw new Error(`Microsoft Graph API error: ${res.status} - ${error}`);
        }

        return res.json() as Promise<TeamsTeamsResponse>;
      },
      catch: (error) =>
        new HttpError({
          message: `Failed to list teams: ${error instanceof Error ? error.message : "Unknown error"}`,
          status: 500,
        }),
    });

  const listChannels = (
    accessToken: string,
    teamId: string,
  ): Effect.Effect<TeamsChannelsResponse, HttpError> =>
    Effect.tryPromise({
      try: async () => {
        const res = await fetch(`${MICROSOFT_GRAPH_BASE}/teams/${teamId}/channels`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!res.ok) {
          const error = await res.text();
          throw new Error(`Microsoft Graph API error: ${res.status} - ${error}`);
        }

        return res.json() as Promise<TeamsChannelsResponse>;
      },
      catch: (error) =>
        new HttpError({
          message: `Failed to list channels: ${error instanceof Error ? error.message : "Unknown error"}`,
          status: 500,
        }),
    });

  const sendMessage = (
    accessToken: string,
    teamId: string,
    channelId: string,
    payload: TeamsMessagePayload,
  ): Effect.Effect<TeamsMessageResponse, HttpError> =>
    Effect.tryPromise({
      try: async () => {
        const res = await fetch(
          `${MICROSOFT_GRAPH_BASE}/teams/${teamId}/channels/${channelId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          },
        );

        if (!res.ok) {
          const error = await res.text();
          throw new Error(`Microsoft Graph API error: ${res.status} - ${error}`);
        }

        return res.json() as Promise<TeamsMessageResponse>;
      },
      catch: (error) =>
        new HttpError({
          message: `Failed to send message: ${error instanceof Error ? error.message : "Unknown error"}`,
          status: 500,
        }),
    });

  const sendVideoNotification = (
    accessToken: string,
    teamId: string,
    channelId: string,
    videoTitle: string,
    videoUrl: string,
    thumbnailUrl?: string,
    authorName?: string,
    description?: string,
  ): Effect.Effect<TeamsMessageResponse, HttpError> => {
    // Create an Adaptive Card for the video notification
    const adaptiveCard: TeamsAdaptiveCard = {
      type: "AdaptiveCard",
      "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
      version: "1.4",
      body: [
        {
          type: "TextBlock",
          text: "🎬 New Video",
          size: "Medium",
          weight: "Bolder",
        },
        {
          type: "TextBlock",
          text: videoTitle,
          size: "Large",
          weight: "Bolder",
          wrap: true,
        },
        ...(authorName
          ? [
              {
                type: "TextBlock",
                text: `By ${authorName}`,
                size: "Small",
                wrap: true,
              },
            ]
          : []),
        ...(description
          ? [
              {
                type: "TextBlock",
                text: description,
                wrap: true,
              },
            ]
          : []),
        ...(thumbnailUrl
          ? [
              {
                type: "Image",
                url: thumbnailUrl,
                altText: videoTitle,
                size: "Large",
              },
            ]
          : []),
      ],
      actions: [
        {
          type: "Action.OpenUrl",
          title: "Watch Video",
          url: videoUrl,
        },
      ],
    };

    const payload: TeamsMessagePayload = {
      body: {
        contentType: "html",
        content: `<attachment id="adaptiveCard"></attachment>`,
      },
      attachments: [
        {
          id: "adaptiveCard",
          contentType: "application/vnd.microsoft.card.adaptive",
          content: JSON.stringify(adaptiveCard),
        },
      ],
    };

    return sendMessage(accessToken, teamId, channelId, payload);
  };

  return {
    isConfigured,
    getAuthorizationUrl,
    exchangeCodeForToken,
    refreshAccessToken,
    getUserInfo,
    listTeams,
    listChannels,
    sendMessage,
    sendVideoNotification,
  } satisfies MicrosoftTeamsServiceInterface;
});

// =============================================================================
// Microsoft Teams Layer
// =============================================================================

export const MicrosoftTeamsLive = Layer.effect(MicrosoftTeams, makeMicrosoftTeamsService);

// =============================================================================
// Microsoft Teams Helper Functions
// =============================================================================

export const getMicrosoftTeamsAuthorizationUrl = (
  state: string,
): Effect.Effect<string, never, MicrosoftTeams> =>
  Effect.gen(function* () {
    const teams = yield* MicrosoftTeams;
    return yield* teams.getAuthorizationUrl(state);
  });

export const exchangeMicrosoftTeamsCodeForToken = (
  code: string,
): Effect.Effect<MicrosoftTokenResponse, HttpError, MicrosoftTeams> =>
  Effect.gen(function* () {
    const teams = yield* MicrosoftTeams;
    return yield* teams.exchangeCodeForToken(code);
  });

export const refreshMicrosoftTeamsToken = (
  refreshToken: string,
): Effect.Effect<MicrosoftTokenResponse, HttpError, MicrosoftTeams> =>
  Effect.gen(function* () {
    const teams = yield* MicrosoftTeams;
    return yield* teams.refreshAccessToken(refreshToken);
  });

export const getMicrosoftTeamsUserInfo = (
  accessToken: string,
): Effect.Effect<MicrosoftUserInfo, HttpError, MicrosoftTeams> =>
  Effect.gen(function* () {
    const teams = yield* MicrosoftTeams;
    return yield* teams.getUserInfo(accessToken);
  });

export const listMicrosoftTeams = (
  accessToken: string,
): Effect.Effect<TeamsTeamsResponse, HttpError, MicrosoftTeams> =>
  Effect.gen(function* () {
    const teams = yield* MicrosoftTeams;
    return yield* teams.listTeams(accessToken);
  });

export const listMicrosoftTeamsChannels = (
  accessToken: string,
  teamId: string,
): Effect.Effect<TeamsChannelsResponse, HttpError, MicrosoftTeams> =>
  Effect.gen(function* () {
    const teams = yield* MicrosoftTeams;
    return yield* teams.listChannels(accessToken, teamId);
  });

export const sendMicrosoftTeamsMessage = (
  accessToken: string,
  teamId: string,
  channelId: string,
  payload: TeamsMessagePayload,
): Effect.Effect<TeamsMessageResponse, HttpError, MicrosoftTeams> =>
  Effect.gen(function* () {
    const teams = yield* MicrosoftTeams;
    return yield* teams.sendMessage(accessToken, teamId, channelId, payload);
  });

export const sendMicrosoftTeamsVideoNotification = (
  accessToken: string,
  teamId: string,
  channelId: string,
  videoTitle: string,
  videoUrl: string,
  thumbnailUrl?: string,
  authorName?: string,
  description?: string,
): Effect.Effect<TeamsMessageResponse, HttpError, MicrosoftTeams> =>
  Effect.gen(function* () {
    const teams = yield* MicrosoftTeams;
    return yield* teams.sendVideoNotification(
      accessToken,
      teamId,
      channelId,
      videoTitle,
      videoUrl,
      thumbnailUrl,
      authorName,
      description,
    );
  });
