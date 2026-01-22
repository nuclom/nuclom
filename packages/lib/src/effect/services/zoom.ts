/**
 * Zoom Integration Service using Effect-TS
 *
 * Provides Zoom API operations for OAuth and recordings via the official SDK.
 */

import type {
  CloudRecordingGetMeetingRecordingsResponse,
  CloudRecordingListAllRecordingsResponse,
  MeetingsListMeetingsQueryParams,
  MeetingsListMeetingsResponse,
  MeetingsOAuthClient,
  OAuthToken as MeetingsOAuthToken,
  TokenStore as MeetingsTokenStore,
} from '@zoom/rivet/meetings';
import type {
  UsersGetUserResponse,
  UsersOAuthClient,
  OAuthToken as UsersOAuthToken,
  TokenStore as UsersTokenStore,
} from '@zoom/rivet/users';
import { Context, Effect, Layer } from 'effect';
import { HttpError } from '../errors';
import { ZoomClient } from './zoom-client';

// =============================================================================
// Types
// =============================================================================

export interface ZoomRecording {
  readonly id: string;
  readonly meetingId: string;
  readonly topic: string;
  readonly startTime: Date;
  readonly duration: number;
  readonly fileSize: number;
  readonly downloadUrl: string;
  readonly fileType: string;
}

// =============================================================================
// Zoom Service Interface
// =============================================================================

export interface ZoomServiceInterface {
  /**
   * Check if the Zoom integration is configured
   */
  readonly isConfigured: boolean;

  /**
   * Get the OAuth authorization URL
   */
  readonly getAuthorizationUrl: (state: string) => Effect.Effect<string, never>;

  /**
   * Exchange authorization code for access token
   */
  readonly exchangeCodeForToken: (code: string) => Effect.Effect<MeetingsOAuthToken, HttpError>;

  /**
   * Refresh an access token
   */
  readonly refreshAccessToken: (refreshToken: string) => Effect.Effect<MeetingsOAuthToken, HttpError>;

  /**
   * Get the current user's info
   */
  readonly getUserInfo: (token: UsersOAuthToken) => Effect.Effect<UsersGetUserResponse, HttpError>;

  /**
   * List recordings for the authenticated user
   */
  readonly listRecordings: (
    token: MeetingsOAuthToken,
    from: string,
    to: string,
    pageSize?: number,
    nextPageToken?: string,
  ) => Effect.Effect<
    {
      response: CloudRecordingListAllRecordingsResponse;
      refreshedToken?: MeetingsOAuthToken;
    },
    HttpError
  >;

  /**
   * Get a specific meeting's recordings
   */
  readonly getMeetingRecordings: (
    token: MeetingsOAuthToken,
    meetingId: string,
  ) => Effect.Effect<
    {
      response: CloudRecordingGetMeetingRecordingsResponse;
      refreshedToken?: MeetingsOAuthToken;
    },
    HttpError
  >;

  /**
   * List meetings for the authenticated user
   */
  readonly listMeetings: (
    token: MeetingsOAuthToken,
    query: MeetingsListMeetingsQueryParams,
  ) => Effect.Effect<
    {
      response: MeetingsListMeetingsResponse;
      refreshedToken?: MeetingsOAuthToken;
    },
    HttpError
  >;

  /**
   * Get download URL with access token appended
   */
  readonly getDownloadUrl: (downloadUrl: string, accessToken: string) => string;

  /**
   * Parse recordings response into a simplified format
   */
  readonly parseRecordings: (response: CloudRecordingListAllRecordingsResponse) => ZoomRecording[];
}

// =============================================================================
// Zoom Service Tag
// =============================================================================

export class Zoom extends Context.Tag('Zoom')<Zoom, ZoomServiceInterface>() {}

// =============================================================================
// Zoom Helpers
// =============================================================================

const ZOOM_AUTH_BASE = 'https://zoom.us';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const getString = (record: Record<string, unknown>, key: string): string | undefined => {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
};

const getNumber = (record: Record<string, unknown>, key: string): number | undefined => {
  const value = record[key];
  return typeof value === 'number' ? value : undefined;
};

const mapOAuthTokenResponse = (raw: unknown, fallbackRefreshToken?: string): MeetingsOAuthToken => {
  if (!isRecord(raw)) {
    throw new Error('Invalid Zoom OAuth response');
  }

  const accessToken = getString(raw, 'access_token');
  const refreshToken = getString(raw, 'refresh_token') ?? fallbackRefreshToken;
  const expiresIn = getNumber(raw, 'expires_in');
  const scope = getString(raw, 'scope');

  if (!accessToken || !expiresIn || !refreshToken) {
    throw new Error('Zoom OAuth response missing required fields');
  }

  const scopes = scope ? scope.split(' ') : [];

  return {
    accessToken,
    refreshToken,
    expirationTimeIso: new Date(Date.now() + expiresIn * 1000).toISOString(),
    scopes,
  };
};

const createTokenStore = <
  Token extends { accessToken: string; expirationTimeIso: string; refreshToken: string; scopes: string[] },
>(
  token: Token,
  onStore?: (token: Token) => void,
) => {
  let current = token;

  return {
    getLatestToken: () => current,
    storeToken: (nextToken: Token) => {
      current = nextToken;
      onStore?.(nextToken);
    },
  };
};

const createMeetingsTokenStore = (
  token: MeetingsOAuthToken,
  onStore?: (token: MeetingsOAuthToken) => void,
): MeetingsTokenStore<MeetingsOAuthToken> => createTokenStore(token, onStore);

const createUsersTokenStore = (
  token: UsersOAuthToken,
  onStore?: (token: UsersOAuthToken) => void,
): UsersTokenStore<UsersOAuthToken> => createTokenStore(token, onStore);

export const buildZoomOAuthToken = (params: {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  scope?: string | null;
}): MeetingsOAuthToken => ({
  accessToken: params.accessToken,
  refreshToken: params.refreshToken ?? '',
  expirationTimeIso: (params.expiresAt ?? new Date(0)).toISOString(),
  scopes: params.scope ? params.scope.split(' ') : [],
});

const toHttpError = (message: string, error: unknown) =>
  new HttpError({
    message: `${message}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    status: 500,
  });

// =============================================================================
// Zoom Service Implementation
// =============================================================================

const makeZoomService = Effect.gen(function* () {
  const zoomClient = yield* ZoomClient;

  const getConfig = () => {
    if (!zoomClient.isConfigured || !zoomClient.config) {
      return null;
    }
    return zoomClient.config;
  };

  const getAuthorizationUrl = (state: string): Effect.Effect<string, never> =>
    Effect.sync(() => {
      const cfg = getConfig();
      if (!cfg) {
        throw new Error('Zoom is not configured');
      }

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: cfg.clientId,
        redirect_uri: cfg.redirectUri,
        state,
      });

      return `${ZOOM_AUTH_BASE}/oauth/authorize?${params.toString()}`;
    });

  const exchangeCodeForToken = (code: string): Effect.Effect<MeetingsOAuthToken, HttpError> =>
    Effect.gen(function* () {
      const cfg = getConfig();
      if (!cfg) {
        return yield* Effect.fail(
          new HttpError({
            message: 'Zoom is not configured',
            status: 503,
          }),
        );
      }

      const credentials = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');

      const token = yield* Effect.tryPromise({
        try: async () => {
          const res = await fetch(`${ZOOM_AUTH_BASE}/oauth/token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Authorization: `Basic ${credentials}`,
            },
            body: new URLSearchParams({
              grant_type: 'authorization_code',
              code,
              redirect_uri: cfg.redirectUri,
            }),
          });

          if (!res.ok) {
            const error = await res.text();
            throw new Error(`Zoom token exchange failed: ${res.status} - ${error}`);
          }

          const raw = (await res.json()) as unknown;
          return mapOAuthTokenResponse(raw);
        },
        catch: (error) => toHttpError('Failed to exchange code for token', error),
      });

      return token;
    });

  const refreshAccessToken = (refreshToken: string): Effect.Effect<MeetingsOAuthToken, HttpError> =>
    Effect.gen(function* () {
      const cfg = getConfig();
      if (!cfg) {
        return yield* Effect.fail(
          new HttpError({
            message: 'Zoom is not configured',
            status: 503,
          }),
        );
      }

      const credentials = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');

      const token = yield* Effect.tryPromise({
        try: async () => {
          const res = await fetch(`${ZOOM_AUTH_BASE}/oauth/token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Authorization: `Basic ${credentials}`,
            },
            body: new URLSearchParams({
              grant_type: 'refresh_token',
              refresh_token: refreshToken,
            }),
          });

          if (!res.ok) {
            const error = await res.text();
            throw new Error(`Zoom token refresh failed: ${res.status} - ${error}`);
          }

          const raw = (await res.json()) as unknown;
          return mapOAuthTokenResponse(raw, refreshToken);
        },
        catch: (error) => toHttpError('Failed to refresh access token', error),
      });

      return token;
    });

  const withMeetingsClient = <T>(
    token: MeetingsOAuthToken,
    request: (client: MeetingsOAuthClient) => Promise<{ data?: T }>,
  ): Effect.Effect<{ response: T; refreshedToken?: MeetingsOAuthToken }, HttpError> =>
    Effect.gen(function* () {
      let refreshedToken: MeetingsOAuthToken | undefined;
      const tokenStore = createMeetingsTokenStore(token, (next) => {
        refreshedToken = next;
      });

      const client = yield* zoomClient.createMeetingsClient(tokenStore);
      const response = yield* Effect.tryPromise({
        try: () => request(client),
        catch: (error) => toHttpError('Zoom API error', error),
      });

      if (!response.data) {
        return yield* Effect.fail(new HttpError({ message: 'Zoom API response missing data', status: 500 }));
      }

      return { response: response.data, refreshedToken };
    });

  const withUsersClient = <T>(
    token: UsersOAuthToken,
    request: (client: UsersOAuthClient) => Promise<{ data?: T }>,
  ): Effect.Effect<{ response: T; refreshedToken?: UsersOAuthToken }, HttpError> =>
    Effect.gen(function* () {
      let refreshedToken: UsersOAuthToken | undefined;
      const tokenStore = createUsersTokenStore(token, (next) => {
        refreshedToken = next;
      });

      const client = yield* zoomClient.createUsersClient(tokenStore);
      const response = yield* Effect.tryPromise({
        try: () => request(client),
        catch: (error) => toHttpError('Zoom API error', error),
      });

      if (!response.data) {
        return yield* Effect.fail(new HttpError({ message: 'Zoom API response missing data', status: 500 }));
      }

      return { response: response.data, refreshedToken };
    });

  const getUserInfo = (token: UsersOAuthToken): Effect.Effect<UsersGetUserResponse, HttpError> =>
    Effect.gen(function* () {
      const result = yield* withUsersClient(token, (client) =>
        client.endpoints.users.getUser({
          path: { userId: 'me' },
        }),
      );

      return result.response;
    });

  const listRecordings = (
    token: MeetingsOAuthToken,
    from: string,
    to: string,
    pageSize = 30,
    nextPageToken?: string,
  ): Effect.Effect<
    { response: CloudRecordingListAllRecordingsResponse; refreshedToken?: MeetingsOAuthToken },
    HttpError
  > =>
    Effect.gen(function* () {
      const result = yield* withMeetingsClient(token, (client) =>
        client.endpoints.cloudRecording.listAllRecordings({
          path: { userId: 'me' },
          query: {
            from,
            to,
            page_size: pageSize,
            next_page_token: nextPageToken,
          },
        }),
      );

      return { response: result.response, refreshedToken: result.refreshedToken };
    });

  const getMeetingRecordings = (
    token: MeetingsOAuthToken,
    meetingId: string,
  ): Effect.Effect<
    { response: CloudRecordingGetMeetingRecordingsResponse; refreshedToken?: MeetingsOAuthToken },
    HttpError
  > =>
    Effect.gen(function* () {
      const result = yield* withMeetingsClient(token, (client) =>
        client.endpoints.cloudRecording.getMeetingRecordings({
          path: { meetingId },
        }),
      );

      return { response: result.response, refreshedToken: result.refreshedToken };
    });

  const listMeetings = (
    token: MeetingsOAuthToken,
    query: MeetingsListMeetingsQueryParams,
  ): Effect.Effect<{ response: MeetingsListMeetingsResponse; refreshedToken?: MeetingsOAuthToken }, HttpError> =>
    Effect.gen(function* () {
      const result = yield* withMeetingsClient(token, (client) =>
        client.endpoints.meetings.listMeetings({
          path: { userId: 'me' },
          query,
        }),
      );

      return { response: result.response, refreshedToken: result.refreshedToken };
    });

  const getDownloadUrl = (downloadUrl: string, accessToken: string): string => {
    const url = new URL(downloadUrl);
    url.searchParams.set('access_token', accessToken);
    return url.toString();
  };

  const parseRecordings = (response: CloudRecordingListAllRecordingsResponse): ZoomRecording[] => {
    const recordings: ZoomRecording[] = [];

    for (const meeting of response.meetings ?? []) {
      const files = meeting.recording_files ?? [];
      const videoFile =
        files.find((file) => file.file_type === 'MP4' && file.recording_type === 'shared_screen_with_speaker_view') ??
        files.find((file) => file.file_type === 'MP4');

      if (!videoFile || !videoFile.id || !videoFile.download_url) {
        continue;
      }

      const meetingId = meeting.uuid ?? (meeting.id ? String(meeting.id) : undefined);
      if (
        !meetingId ||
        !meeting.topic ||
        !meeting.start_time ||
        !meeting.duration ||
        !videoFile.file_size ||
        !videoFile.file_type
      ) {
        continue;
      }

      recordings.push({
        id: videoFile.id,
        meetingId,
        topic: meeting.topic,
        startTime: new Date(meeting.start_time),
        duration: meeting.duration,
        fileSize: videoFile.file_size,
        downloadUrl: videoFile.download_url,
        fileType: videoFile.file_type,
      });
    }

    return recordings;
  };

  return {
    isConfigured: zoomClient.isConfigured,
    getAuthorizationUrl,
    exchangeCodeForToken,
    refreshAccessToken,
    getUserInfo,
    listRecordings,
    getMeetingRecordings,
    listMeetings,
    getDownloadUrl,
    parseRecordings,
  } satisfies ZoomServiceInterface;
});

// =============================================================================
// Zoom Layer
// =============================================================================

export const ZoomLive = Layer.effect(Zoom, makeZoomService);

// =============================================================================
// Zoom Helper Functions
// =============================================================================

export const getZoomAuthorizationUrl = (state: string): Effect.Effect<string, never, Zoom> =>
  Effect.gen(function* () {
    const zoom = yield* Zoom;
    return yield* zoom.getAuthorizationUrl(state);
  });

export const exchangeZoomCodeForToken = (code: string): Effect.Effect<MeetingsOAuthToken, HttpError, Zoom> =>
  Effect.gen(function* () {
    const zoom = yield* Zoom;
    return yield* zoom.exchangeCodeForToken(code);
  });

export const refreshZoomAccessToken = (refreshToken: string): Effect.Effect<MeetingsOAuthToken, HttpError, Zoom> =>
  Effect.gen(function* () {
    const zoom = yield* Zoom;
    return yield* zoom.refreshAccessToken(refreshToken);
  });

export const getZoomUserInfo = (token: UsersOAuthToken): Effect.Effect<UsersGetUserResponse, HttpError, Zoom> =>
  Effect.gen(function* () {
    const zoom = yield* Zoom;
    return yield* zoom.getUserInfo(token);
  });

export const listZoomRecordings = (
  token: MeetingsOAuthToken,
  from: string,
  to: string,
  pageSize?: number,
  nextPageToken?: string,
): Effect.Effect<
  {
    response: CloudRecordingListAllRecordingsResponse;
    refreshedToken?: MeetingsOAuthToken;
  },
  HttpError,
  Zoom
> =>
  Effect.gen(function* () {
    const zoom = yield* Zoom;
    return yield* zoom.listRecordings(token, from, to, pageSize, nextPageToken);
  });

export const getZoomMeetingRecordings = (
  token: MeetingsOAuthToken,
  meetingId: string,
): Effect.Effect<
  {
    response: CloudRecordingGetMeetingRecordingsResponse;
    refreshedToken?: MeetingsOAuthToken;
  },
  HttpError,
  Zoom
> =>
  Effect.gen(function* () {
    const zoom = yield* Zoom;
    return yield* zoom.getMeetingRecordings(token, meetingId);
  });
