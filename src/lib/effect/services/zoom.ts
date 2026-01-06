/**
 * Zoom Integration Service using Effect-TS
 *
 * Provides type-safe Zoom API operations for OAuth and recordings.
 */

import { Config, Context, Effect, Layer, Option } from 'effect';
import { HttpError } from '../errors';

// =============================================================================
// Types
// =============================================================================

export interface ZoomConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}

export interface ZoomTokenResponse {
  readonly access_token: string;
  readonly token_type: string;
  readonly refresh_token: string;
  readonly expires_in: number;
  readonly scope: string;
}

export interface ZoomUserInfo {
  readonly id: string;
  readonly email: string;
  readonly first_name: string;
  readonly last_name: string;
  readonly account_id: string;
}

export interface ZoomRecordingFile {
  readonly id: string;
  readonly meeting_id: string;
  readonly recording_start: string;
  readonly recording_end: string;
  readonly file_type: string;
  readonly file_extension: string;
  readonly file_size: number;
  readonly download_url: string;
  readonly status: string;
  readonly recording_type: string;
}

export interface ZoomMeeting {
  readonly id: number;
  readonly uuid: string;
  readonly host_id: string;
  readonly topic: string;
  readonly start_time: string;
  readonly duration: number;
  readonly total_size: number;
  readonly recording_count: number;
  readonly recording_files: ZoomRecordingFile[];
}

export interface ZoomRecordingsResponse {
  readonly from: string;
  readonly to: string;
  readonly page_count: number;
  readonly page_size: number;
  readonly total_records: number;
  readonly next_page_token?: string;
  readonly meetings: ZoomMeeting[];
}

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
  readonly exchangeCodeForToken: (code: string) => Effect.Effect<ZoomTokenResponse, HttpError>;

  /**
   * Refresh an access token
   */
  readonly refreshAccessToken: (refreshToken: string) => Effect.Effect<ZoomTokenResponse, HttpError>;

  /**
   * Get the current user's info
   */
  readonly getUserInfo: (accessToken: string) => Effect.Effect<ZoomUserInfo, HttpError>;

  /**
   * List recordings for the authenticated user
   */
  readonly listRecordings: (
    accessToken: string,
    from: string,
    to: string,
    pageSize?: number,
    nextPageToken?: string,
  ) => Effect.Effect<ZoomRecordingsResponse, HttpError>;

  /**
   * Get a specific meeting's recordings
   */
  readonly getMeetingRecordings: (accessToken: string, meetingId: string) => Effect.Effect<ZoomMeeting, HttpError>;

  /**
   * Get download URL with access token appended
   */
  readonly getDownloadUrl: (downloadUrl: string, accessToken: string) => string;

  /**
   * Parse recordings response into a simplified format
   */
  readonly parseRecordings: (response: ZoomRecordingsResponse) => ZoomRecording[];
}

// =============================================================================
// Zoom Service Tag
// =============================================================================

export class Zoom extends Context.Tag('Zoom')<Zoom, ZoomServiceInterface>() {}

// =============================================================================
// Zoom Configuration
// =============================================================================

const ZOOM_API_BASE = 'https://api.zoom.us/v2';
const ZOOM_AUTH_BASE = 'https://zoom.us';

const ZoomConfigEffect = Config.all({
  clientId: Config.string('ZOOM_CLIENT_ID').pipe(Config.option),
  clientSecret: Config.string('ZOOM_CLIENT_SECRET').pipe(Config.option),
  baseUrl: Config.string('NEXT_PUBLIC_URL').pipe(Config.option),
});

// =============================================================================
// Zoom Service Implementation
// =============================================================================

const makeZoomService = Effect.gen(function* () {
  const config = yield* ZoomConfigEffect;

  const isConfigured =
    Option.isSome(config.clientId) && Option.isSome(config.clientSecret) && Option.isSome(config.baseUrl);

  const getConfig = (): ZoomConfig | null => {
    if (!isConfigured) return null;
    return {
      clientId: Option.getOrThrow(config.clientId),
      clientSecret: Option.getOrThrow(config.clientSecret),
      redirectUri: `${Option.getOrThrow(config.baseUrl)}/api/integrations/zoom/callback`,
    };
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

  const exchangeCodeForToken = (code: string): Effect.Effect<ZoomTokenResponse, HttpError> =>
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

      const response = yield* Effect.tryPromise({
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

          return res.json() as Promise<ZoomTokenResponse>;
        },
        catch: (error) =>
          new HttpError({
            message: `Failed to exchange code for token: ${error instanceof Error ? error.message : 'Unknown error'}`,
            status: 500,
          }),
      });

      return response;
    });

  const refreshAccessToken = (refreshToken: string): Effect.Effect<ZoomTokenResponse, HttpError> =>
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

      const response = yield* Effect.tryPromise({
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

          return res.json() as Promise<ZoomTokenResponse>;
        },
        catch: (error) =>
          new HttpError({
            message: `Failed to refresh access token: ${error instanceof Error ? error.message : 'Unknown error'}`,
            status: 500,
          }),
      });

      return response;
    });

  const getUserInfo = (accessToken: string): Effect.Effect<ZoomUserInfo, HttpError> =>
    Effect.tryPromise({
      try: async () => {
        const res = await fetch(`${ZOOM_API_BASE}/users/me`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!res.ok) {
          const error = await res.text();
          throw new Error(`Zoom API error: ${res.status} - ${error}`);
        }

        return res.json() as Promise<ZoomUserInfo>;
      },
      catch: (error) =>
        new HttpError({
          message: `Failed to get user info: ${error instanceof Error ? error.message : 'Unknown error'}`,
          status: 500,
        }),
    });

  const listRecordings = (
    accessToken: string,
    from: string,
    to: string,
    pageSize = 30,
    nextPageToken?: string,
  ): Effect.Effect<ZoomRecordingsResponse, HttpError> =>
    Effect.tryPromise({
      try: async () => {
        const params = new URLSearchParams({
          from,
          to,
          page_size: pageSize.toString(),
        });

        if (nextPageToken) {
          params.set('next_page_token', nextPageToken);
        }

        const res = await fetch(`${ZOOM_API_BASE}/users/me/recordings?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!res.ok) {
          const error = await res.text();
          throw new Error(`Zoom API error: ${res.status} - ${error}`);
        }

        return res.json() as Promise<ZoomRecordingsResponse>;
      },
      catch: (error) =>
        new HttpError({
          message: `Failed to list recordings: ${error instanceof Error ? error.message : 'Unknown error'}`,
          status: 500,
        }),
    });

  const getMeetingRecordings = (accessToken: string, meetingId: string): Effect.Effect<ZoomMeeting, HttpError> =>
    Effect.tryPromise({
      try: async () => {
        const res = await fetch(`${ZOOM_API_BASE}/meetings/${meetingId}/recordings`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!res.ok) {
          const error = await res.text();
          throw new Error(`Zoom API error: ${res.status} - ${error}`);
        }

        return res.json() as Promise<ZoomMeeting>;
      },
      catch: (error) =>
        new HttpError({
          message: `Failed to get meeting recordings: ${error instanceof Error ? error.message : 'Unknown error'}`,
          status: 500,
        }),
    });

  const getDownloadUrl = (downloadUrl: string, accessToken: string): string => {
    if (!downloadUrl) {
      throw new Error('Download URL is required');
    }
    try {
      const url = new URL(downloadUrl);
      url.searchParams.set('access_token', accessToken);
      return url.toString();
    } catch {
      throw new Error(`Invalid download URL: ${downloadUrl}`);
    }
  };

  const parseRecordings = (response: ZoomRecordingsResponse): ZoomRecording[] => {
    const recordings: ZoomRecording[] = [];

    for (const meeting of response.meetings) {
      // Find the MP4 file (main video recording)
      const videoFile =
        meeting.recording_files.find(
          (f) => f.file_type === 'MP4' && f.recording_type === 'shared_screen_with_speaker_view',
        ) || meeting.recording_files.find((f) => f.file_type === 'MP4');

      if (videoFile) {
        recordings.push({
          id: videoFile.id,
          meetingId: meeting.uuid,
          topic: meeting.topic,
          startTime: new Date(meeting.start_time),
          duration: meeting.duration,
          fileSize: videoFile.file_size,
          downloadUrl: videoFile.download_url,
          fileType: videoFile.file_type,
        });
      }
    }

    return recordings;
  };

  return {
    isConfigured,
    getAuthorizationUrl,
    exchangeCodeForToken,
    refreshAccessToken,
    getUserInfo,
    listRecordings,
    getMeetingRecordings,
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

export const exchangeZoomCodeForToken = (code: string): Effect.Effect<ZoomTokenResponse, HttpError, Zoom> =>
  Effect.gen(function* () {
    const zoom = yield* Zoom;
    return yield* zoom.exchangeCodeForToken(code);
  });

export const refreshZoomAccessToken = (refreshToken: string): Effect.Effect<ZoomTokenResponse, HttpError, Zoom> =>
  Effect.gen(function* () {
    const zoom = yield* Zoom;
    return yield* zoom.refreshAccessToken(refreshToken);
  });

export const getZoomUserInfo = (accessToken: string): Effect.Effect<ZoomUserInfo, HttpError, Zoom> =>
  Effect.gen(function* () {
    const zoom = yield* Zoom;
    return yield* zoom.getUserInfo(accessToken);
  });

export const listZoomRecordings = (
  accessToken: string,
  from: string,
  to: string,
  pageSize?: number,
  nextPageToken?: string,
): Effect.Effect<ZoomRecordingsResponse, HttpError, Zoom> =>
  Effect.gen(function* () {
    const zoom = yield* Zoom;
    return yield* zoom.listRecordings(accessToken, from, to, pageSize, nextPageToken);
  });

export const getZoomMeetingRecordings = (
  accessToken: string,
  meetingId: string,
): Effect.Effect<ZoomMeeting, HttpError, Zoom> =>
  Effect.gen(function* () {
    const zoom = yield* Zoom;
    return yield* zoom.getMeetingRecordings(accessToken, meetingId);
  });
