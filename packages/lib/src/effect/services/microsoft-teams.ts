/**
 * Microsoft Teams Integration Service using Effect-TS
 *
 * Provides type-safe Microsoft Graph API operations for OAuth and messaging.
 */

import type { Channel, ChatMessage, ChatMessageAttachment, Team, User } from '@microsoft/microsoft-graph-types';
import { Config, Context, Effect, Layer, Option } from 'effect';
import { HttpError } from '../errors';
import { type MicrosoftTeamsAuthConfig, MicrosoftTeamsClient } from './microsoft-teams-client';

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

export type MicrosoftUserInfo = User;
export type TeamsChannel = Channel;
export type TeamsTeam = Team;

export interface TeamsChannelsResponse {
  readonly value: TeamsChannel[];
  readonly '@odata.nextLink'?: string;
}

export interface TeamsTeamsResponse {
  readonly value: TeamsTeam[];
  readonly '@odata.nextLink'?: string;
}

export type TeamsMessagePayload = ChatMessage;

export type TeamsAttachment = ChatMessageAttachment;

export interface TeamsAdaptiveCard {
  readonly type: 'AdaptiveCard';
  readonly body: TeamsAdaptiveCardElement[];
  readonly actions?: TeamsAdaptiveCardAction[];
  readonly $schema: string;
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
  readonly type: 'Column';
  readonly width: string | number;
  readonly items: TeamsAdaptiveCardElement[];
}

export interface TeamsAdaptiveCardAction {
  readonly type: string;
  readonly title: string;
  readonly url?: string;
  readonly data?: Record<string, unknown>;
}

export type TeamsMessageResponse = ChatMessage;

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
  readonly listChannels: (accessToken: string, teamId: string) => Effect.Effect<TeamsChannelsResponse, HttpError>;

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

export class MicrosoftTeams extends Context.Tag('MicrosoftTeams')<MicrosoftTeams, MicrosoftTeamsServiceInterface>() {}

// =============================================================================
// Microsoft Teams Configuration
// =============================================================================

const MicrosoftTeamsConfigEffect = Config.all({
  clientId: Config.string('MICROSOFT_CLIENT_ID').pipe(Config.option),
  clientSecret: Config.string('MICROSOFT_CLIENT_SECRET').pipe(Config.option),
  tenantId: Config.string('MICROSOFT_TENANT_ID').pipe(Config.withDefault('common'), Config.option),
  baseUrl: Config.string('NEXT_PUBLIC_URL').pipe(Config.option),
});

// =============================================================================
// Microsoft Teams Service Implementation
// =============================================================================

const makeMicrosoftTeamsService = Effect.gen(function* () {
  const config = yield* MicrosoftTeamsConfigEffect;
  const teamsClient = yield* MicrosoftTeamsClient;

  const isConfigured =
    Option.isSome(config.clientId) && Option.isSome(config.clientSecret) && Option.isSome(config.baseUrl);

  const getConfig = (): MicrosoftTeamsConfig | null => {
    if (!isConfigured) return null;
    return {
      clientId: Option.getOrThrow(config.clientId),
      clientSecret: Option.getOrThrow(config.clientSecret),
      tenantId: Option.isSome(config.tenantId) ? Option.getOrThrow(config.tenantId) : 'common',
      redirectUri: `${Option.getOrThrow(config.baseUrl)}/api/integrations/teams/callback`,
    };
  };

  const getScopes = () => [
    'User.Read',
    'Team.ReadBasic.All',
    'Channel.ReadBasic.All',
    'ChannelMessage.Send',
    'offline_access',
  ];

  const toAuthConfig = (cfg: MicrosoftTeamsConfig): MicrosoftTeamsAuthConfig => ({
    clientId: cfg.clientId,
    clientSecret: cfg.clientSecret,
    tenantId: cfg.tenantId,
  });

  const getAuthorizationUrl = (state: string): Effect.Effect<string, never> =>
    Effect.gen(function* () {
      const cfg = getConfig();
      if (!cfg) {
        throw new Error('Microsoft Teams is not configured');
      }

      const msal = yield* teamsClient.createMsalClient(toAuthConfig(cfg));
      return yield* Effect.tryPromise({
        try: () =>
          msal.getAuthCodeUrl({
            scopes: getScopes(),
            redirectUri: cfg.redirectUri,
            state,
          }),
        catch: (error) => error,
      });
    }).pipe(Effect.orDie);

  const exchangeCodeForToken = (code: string): Effect.Effect<MicrosoftTokenResponse, HttpError> =>
    Effect.gen(function* () {
      const cfg = getConfig();
      if (!cfg) {
        return yield* Effect.fail(
          new HttpError({
            message: 'Microsoft Teams is not configured',
            status: 503,
          }),
        );
      }

      const response = yield* Effect.gen(function* () {
        const msal = yield* teamsClient.createMsalClient(toAuthConfig(cfg));
        return yield* Effect.tryPromise({
          try: async () => {
            const result = await msal.acquireTokenByCode({
              code,
              scopes: getScopes(),
              redirectUri: cfg.redirectUri,
            });

            if (!result?.accessToken || !result.expiresOn || !result.tokenType) {
              throw new Error('Microsoft token exchange returned incomplete result');
            }

            return {
              access_token: result.accessToken,
              token_type: result.tokenType,
              expires_in: Math.max(0, Math.floor((result.expiresOn.getTime() - Date.now()) / 1000)),
              scope: (result.scopes ?? []).join(' '),
            } satisfies MicrosoftTokenResponse;
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

  const refreshAccessToken = (refreshToken: string): Effect.Effect<MicrosoftTokenResponse, HttpError> =>
    Effect.gen(function* () {
      const cfg = getConfig();
      if (!cfg) {
        return yield* Effect.fail(
          new HttpError({
            message: 'Microsoft Teams is not configured',
            status: 503,
          }),
        );
      }

      const response = yield* Effect.gen(function* () {
        const msal = yield* teamsClient.createMsalClient(toAuthConfig(cfg));
        return yield* Effect.tryPromise({
          try: async () => {
            const result = await msal.acquireTokenByRefreshToken({
              refreshToken,
              scopes: getScopes(),
            });

            if (!result?.accessToken || !result.expiresOn || !result.tokenType) {
              throw new Error('Microsoft token refresh returned incomplete result');
            }

            return {
              access_token: result.accessToken,
              token_type: result.tokenType,
              expires_in: Math.max(0, Math.floor((result.expiresOn.getTime() - Date.now()) / 1000)),
              scope: (result.scopes ?? []).join(' '),
              refresh_token: refreshToken,
            } satisfies MicrosoftTokenResponse;
          },
          catch: (error) =>
            new HttpError({
              message: `Failed to refresh access token: ${error instanceof Error ? error.message : 'Unknown error'}`,
              status: 500,
            }),
        });
      });

      return response;
    });

  const getUserInfo = (accessToken: string): Effect.Effect<MicrosoftUserInfo, HttpError> =>
    Effect.gen(function* () {
      const client = yield* teamsClient.createGraphClient(accessToken);
      return yield* Effect.tryPromise({
        try: async () => (await client.api('/me').get()) as MicrosoftUserInfo,
        catch: (error) =>
          new HttpError({
            message: `Failed to get user info: ${error instanceof Error ? error.message : 'Unknown error'}`,
            status: 500,
          }),
      });
    });

  const listTeams = (accessToken: string): Effect.Effect<TeamsTeamsResponse, HttpError> =>
    Effect.gen(function* () {
      const client = yield* teamsClient.createGraphClient(accessToken);
      return yield* Effect.tryPromise({
        try: async () => (await client.api('/me/joinedTeams').get()) as TeamsTeamsResponse,
        catch: (error) =>
          new HttpError({
            message: `Failed to list teams: ${error instanceof Error ? error.message : 'Unknown error'}`,
            status: 500,
          }),
      });
    });

  const listChannels = (accessToken: string, teamId: string): Effect.Effect<TeamsChannelsResponse, HttpError> =>
    Effect.gen(function* () {
      const client = yield* teamsClient.createGraphClient(accessToken);
      return yield* Effect.tryPromise({
        try: async () => (await client.api(`/teams/${teamId}/channels`).get()) as TeamsChannelsResponse,
        catch: (error) =>
          new HttpError({
            message: `Failed to list channels: ${error instanceof Error ? error.message : 'Unknown error'}`,
            status: 500,
          }),
      });
    });

  const sendMessage = (
    accessToken: string,
    teamId: string,
    channelId: string,
    payload: TeamsMessagePayload,
  ): Effect.Effect<TeamsMessageResponse, HttpError> =>
    Effect.gen(function* () {
      const client = yield* teamsClient.createGraphClient(accessToken);
      return yield* Effect.tryPromise({
        try: async () =>
          (await client.api(`/teams/${teamId}/channels/${channelId}/messages`).post(payload)) as TeamsMessageResponse,
        catch: (error) =>
          new HttpError({
            message: `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`,
            status: 500,
          }),
      });
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
      type: 'AdaptiveCard',
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: '🎬 New Video',
          size: 'Medium',
          weight: 'Bolder',
        },
        {
          type: 'TextBlock',
          text: videoTitle,
          size: 'Large',
          weight: 'Bolder',
          wrap: true,
        },
        ...(authorName
          ? [
              {
                type: 'TextBlock',
                text: `By ${authorName}`,
                size: 'Small',
                wrap: true,
              },
            ]
          : []),
        ...(description
          ? [
              {
                type: 'TextBlock',
                text: description,
                wrap: true,
              },
            ]
          : []),
        ...(thumbnailUrl
          ? [
              {
                type: 'Image',
                url: thumbnailUrl,
                altText: videoTitle,
                size: 'Large',
              },
            ]
          : []),
      ],
      actions: [
        {
          type: 'Action.OpenUrl',
          title: 'Watch Video',
          url: videoUrl,
        },
      ],
    };

    const payload: TeamsMessagePayload = {
      body: {
        contentType: 'html',
        content: `<attachment id="adaptiveCard"></attachment>`,
      },
      attachments: [
        {
          id: 'adaptiveCard',
          contentType: 'application/vnd.microsoft.card.adaptive',
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

export const getMicrosoftTeamsAuthorizationUrl = (state: string): Effect.Effect<string, never, MicrosoftTeams> =>
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

export const listMicrosoftTeams = (accessToken: string): Effect.Effect<TeamsTeamsResponse, HttpError, MicrosoftTeams> =>
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
