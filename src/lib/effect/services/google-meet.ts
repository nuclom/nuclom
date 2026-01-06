/**
 * Google Meet Integration Service using Effect-TS
 *
 * Provides type-safe Google OAuth and Drive API operations for accessing Meet recordings.
 * Google Meet recordings are stored in Google Drive.
 */

import { Config, Context, Effect, Layer, Option } from 'effect';
import { HttpError } from '../errors';

// =============================================================================
// Types
// =============================================================================

export interface GoogleConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}

export interface GoogleTokenResponse {
  readonly access_token: string;
  readonly token_type: string;
  readonly refresh_token?: string;
  readonly expires_in: number;
  readonly scope: string;
  readonly id_token?: string;
}

export interface GoogleUserInfo {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly picture?: string;
}

export interface GoogleDriveFile {
  readonly id: string;
  readonly name: string;
  readonly mimeType: string;
  readonly createdTime: string;
  readonly modifiedTime: string;
  readonly size?: string;
  readonly webViewLink?: string;
  readonly webContentLink?: string;
  readonly thumbnailLink?: string;
  readonly parents?: string[];
}

export interface GoogleDriveFilesResponse {
  readonly kind: string;
  readonly nextPageToken?: string;
  readonly incompleteSearch?: boolean;
  readonly files: GoogleDriveFile[];
}

export interface GoogleCalendarEvent {
  readonly id: string;
  readonly summary: string;
  readonly description?: string;
  readonly start: { dateTime?: string; date?: string; timeZone?: string };
  readonly end: { dateTime?: string; date?: string; timeZone?: string };
  readonly attendees?: Array<{ email: string; displayName?: string; responseStatus?: string }>;
  readonly hangoutLink?: string;
  readonly conferenceData?: {
    conferenceId?: string;
    conferenceSolution?: { name: string; key: { type: string } };
  };
}

export interface GoogleCalendarEventsResponse {
  readonly kind: string;
  readonly nextPageToken?: string;
  readonly items: GoogleCalendarEvent[];
}

export interface GoogleMeetRecording {
  readonly id: string;
  readonly name: string;
  readonly meetingTitle: string;
  readonly createdTime: Date;
  readonly fileSize: number;
  readonly downloadUrl: string;
  readonly mimeType: string;
}

export interface GoogleDriveFolder {
  readonly id: string;
  readonly name: string;
  readonly parentId?: string;
  readonly modifiedTime: string;
}

export interface GoogleDriveFoldersResponse {
  readonly folders: GoogleDriveFolder[];
  readonly nextPageToken?: string;
}

export interface GoogleDriveVideoFile {
  readonly id: string;
  readonly name: string;
  readonly mimeType: string;
  readonly size: number;
  readonly createdTime: string;
  readonly modifiedTime: string;
  readonly thumbnailLink?: string;
  readonly webViewLink?: string;
  readonly parentId?: string;
}

export interface GoogleDriveVideosResponse {
  readonly files: GoogleDriveVideoFile[];
  readonly nextPageToken?: string;
  readonly totalCount?: number;
}

export interface GoogleDriveSearchOptions {
  readonly query?: string;
  readonly folderId?: string;
  readonly pageSize?: number;
  readonly pageToken?: string;
  readonly orderBy?: 'createdTime' | 'modifiedTime' | 'name';
  readonly orderDirection?: 'asc' | 'desc';
}

// =============================================================================
// Google Meet Service Interface
// =============================================================================

export interface GoogleMeetServiceInterface {
  /**
   * Check if the Google Meet integration is configured
   */
  readonly isConfigured: boolean;

  /**
   * Get the OAuth authorization URL
   */
  readonly getAuthorizationUrl: (state: string) => Effect.Effect<string, never>;

  /**
   * Exchange authorization code for access token
   */
  readonly exchangeCodeForToken: (code: string) => Effect.Effect<GoogleTokenResponse, HttpError>;

  /**
   * Refresh an access token
   */
  readonly refreshAccessToken: (refreshToken: string) => Effect.Effect<GoogleTokenResponse, HttpError>;

  /**
   * Get the current user's info
   */
  readonly getUserInfo: (accessToken: string) => Effect.Effect<GoogleUserInfo, HttpError>;

  /**
   * List Meet recordings from Google Drive
   */
  readonly listMeetRecordings: (
    accessToken: string,
    pageSize?: number,
    pageToken?: string,
  ) => Effect.Effect<GoogleDriveFilesResponse, HttpError>;

  /**
   * Get a specific file's metadata
   */
  readonly getFile: (accessToken: string, fileId: string) => Effect.Effect<GoogleDriveFile, HttpError>;

  /**
   * Get download URL for a file (generates a download link)
   */
  readonly getDownloadUrl: (accessToken: string, fileId: string) => Effect.Effect<string, HttpError>;

  /**
   * Download a file as a stream
   */
  readonly downloadFile: (accessToken: string, fileId: string) => Effect.Effect<ReadableStream<Uint8Array>, HttpError>;

  /**
   * List calendar events with Meet links
   */
  readonly listCalendarEvents: (
    accessToken: string,
    timeMin: string,
    timeMax: string,
    pageSize?: number,
    pageToken?: string,
  ) => Effect.Effect<GoogleCalendarEventsResponse, HttpError>;

  /**
   * Parse Drive files response into a simplified format
   */
  readonly parseRecordings: (response: GoogleDriveFilesResponse) => GoogleMeetRecording[];

  /**
   * List all video files from Google Drive (not just Meet recordings)
   */
  readonly listVideoFiles: (
    accessToken: string,
    options?: GoogleDriveSearchOptions,
  ) => Effect.Effect<GoogleDriveVideosResponse, HttpError>;

  /**
   * List folders in Google Drive
   */
  readonly listFolders: (
    accessToken: string,
    parentId?: string,
    pageSize?: number,
    pageToken?: string,
  ) => Effect.Effect<GoogleDriveFoldersResponse, HttpError>;

  /**
   * Search for video files by name
   */
  readonly searchVideos: (
    accessToken: string,
    query: string,
    pageSize?: number,
    pageToken?: string,
  ) => Effect.Effect<GoogleDriveVideosResponse, HttpError>;
}

// =============================================================================
// Google Meet Service Tag
// =============================================================================

export class GoogleMeet extends Context.Tag('GoogleMeet')<GoogleMeet, GoogleMeetServiceInterface>() {}

// =============================================================================
// Google Configuration
// =============================================================================

const GOOGLE_AUTH_BASE = 'https://accounts.google.com';
const GOOGLE_API_BASE = 'https://www.googleapis.com';

// Scopes needed for Google Meet recordings
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ');

const GoogleConfigEffect = Config.all({
  clientId: Config.string('GOOGLE_CLIENT_ID').pipe(Config.option),
  clientSecret: Config.string('GOOGLE_CLIENT_SECRET').pipe(Config.option),
  baseUrl: Config.string('NEXT_PUBLIC_URL').pipe(Config.option),
});

// =============================================================================
// Google Meet Service Implementation
// =============================================================================

const makeGoogleMeetService = Effect.gen(function* () {
  const config = yield* GoogleConfigEffect;

  const isConfigured =
    Option.isSome(config.clientId) && Option.isSome(config.clientSecret) && Option.isSome(config.baseUrl);

  const getConfig = (): GoogleConfig | null => {
    if (!isConfigured) return null;
    return {
      clientId: Option.getOrThrow(config.clientId),
      clientSecret: Option.getOrThrow(config.clientSecret),
      redirectUri: `${Option.getOrThrow(config.baseUrl)}/api/integrations/google/callback`,
    };
  };

  const getAuthorizationUrl = (state: string): Effect.Effect<string, never> =>
    Effect.sync(() => {
      const cfg = getConfig();
      if (!cfg) {
        throw new Error('Google is not configured');
      }

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: cfg.clientId,
        redirect_uri: cfg.redirectUri,
        scope: GOOGLE_SCOPES,
        access_type: 'offline',
        prompt: 'consent',
        state,
      });

      return `${GOOGLE_AUTH_BASE}/o/oauth2/v2/auth?${params.toString()}`;
    });

  const exchangeCodeForToken = (code: string): Effect.Effect<GoogleTokenResponse, HttpError> =>
    Effect.gen(function* () {
      const cfg = getConfig();
      if (!cfg) {
        return yield* Effect.fail(
          new HttpError({
            message: 'Google is not configured',
            status: 503,
          }),
        );
      }

      const response = yield* Effect.tryPromise({
        try: async () => {
          const res = await fetch(`${GOOGLE_AUTH_BASE}/o/oauth2/token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              grant_type: 'authorization_code',
              code,
              redirect_uri: cfg.redirectUri,
              client_id: cfg.clientId,
              client_secret: cfg.clientSecret,
            }),
          });

          if (!res.ok) {
            const error = await res.text();
            throw new Error(`Google token exchange failed: ${res.status} - ${error}`);
          }

          return res.json() as Promise<GoogleTokenResponse>;
        },
        catch: (error) =>
          new HttpError({
            message: `Failed to exchange code for token: ${error instanceof Error ? error.message : 'Unknown error'}`,
            status: 500,
          }),
      });

      return response;
    });

  const refreshAccessToken = (refreshToken: string): Effect.Effect<GoogleTokenResponse, HttpError> =>
    Effect.gen(function* () {
      const cfg = getConfig();
      if (!cfg) {
        return yield* Effect.fail(
          new HttpError({
            message: 'Google is not configured',
            status: 503,
          }),
        );
      }

      const response = yield* Effect.tryPromise({
        try: async () => {
          const res = await fetch(`${GOOGLE_AUTH_BASE}/o/oauth2/token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              grant_type: 'refresh_token',
              refresh_token: refreshToken,
              client_id: cfg.clientId,
              client_secret: cfg.clientSecret,
            }),
          });

          if (!res.ok) {
            const error = await res.text();
            throw new Error(`Google token refresh failed: ${res.status} - ${error}`);
          }

          return res.json() as Promise<GoogleTokenResponse>;
        },
        catch: (error) =>
          new HttpError({
            message: `Failed to refresh access token: ${error instanceof Error ? error.message : 'Unknown error'}`,
            status: 500,
          }),
      });

      return response;
    });

  const getUserInfo = (accessToken: string): Effect.Effect<GoogleUserInfo, HttpError> =>
    Effect.tryPromise({
      try: async () => {
        const res = await fetch(`${GOOGLE_API_BASE}/oauth2/v2/userinfo`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!res.ok) {
          const error = await res.text();
          throw new Error(`Google API error: ${res.status} - ${error}`);
        }

        return res.json() as Promise<GoogleUserInfo>;
      },
      catch: (error) =>
        new HttpError({
          message: `Failed to get user info: ${error instanceof Error ? error.message : 'Unknown error'}`,
          status: 500,
        }),
    });

  const listMeetRecordings = (
    accessToken: string,
    pageSize = 50,
    pageToken?: string,
  ): Effect.Effect<GoogleDriveFilesResponse, HttpError> =>
    Effect.tryPromise({
      try: async () => {
        // Search for Meet recording files in Google Drive
        // Meet recordings have specific naming patterns and are stored as MP4
        const query = "mimeType='video/mp4' and name contains 'Meet Recording'";

        const params = new URLSearchParams({
          q: query,
          fields:
            'kind,nextPageToken,incompleteSearch,files(id,name,mimeType,createdTime,modifiedTime,size,webViewLink,webContentLink,parents)',
          orderBy: 'createdTime desc',
          pageSize: pageSize.toString(),
        });

        if (pageToken) {
          params.set('pageToken', pageToken);
        }

        const res = await fetch(`${GOOGLE_API_BASE}/drive/v3/files?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!res.ok) {
          const error = await res.text();
          throw new Error(`Google Drive API error: ${res.status} - ${error}`);
        }

        return res.json() as Promise<GoogleDriveFilesResponse>;
      },
      catch: (error) =>
        new HttpError({
          message: `Failed to list recordings: ${error instanceof Error ? error.message : 'Unknown error'}`,
          status: 500,
        }),
    });

  const getFile = (accessToken: string, fileId: string): Effect.Effect<GoogleDriveFile, HttpError> =>
    Effect.tryPromise({
      try: async () => {
        const params = new URLSearchParams({
          fields: 'id,name,mimeType,createdTime,modifiedTime,size,webViewLink,webContentLink,parents',
        });

        const res = await fetch(`${GOOGLE_API_BASE}/drive/v3/files/${fileId}?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!res.ok) {
          const error = await res.text();
          throw new Error(`Google Drive API error: ${res.status} - ${error}`);
        }

        return res.json() as Promise<GoogleDriveFile>;
      },
      catch: (error) =>
        new HttpError({
          message: `Failed to get file: ${error instanceof Error ? error.message : 'Unknown error'}`,
          status: 500,
        }),
    });

  const getDownloadUrl = (accessToken: string, fileId: string): Effect.Effect<string, HttpError> =>
    Effect.succeed(`${GOOGLE_API_BASE}/drive/v3/files/${fileId}?alt=media&access_token=${accessToken}`);

  const downloadFile = (accessToken: string, fileId: string): Effect.Effect<ReadableStream<Uint8Array>, HttpError> =>
    Effect.tryPromise({
      try: async () => {
        const res = await fetch(`${GOOGLE_API_BASE}/drive/v3/files/${fileId}?alt=media`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!res.ok) {
          const error = await res.text();
          throw new Error(`Google Drive API error: ${res.status} - ${error}`);
        }

        if (!res.body) {
          throw new Error('No response body');
        }

        return res.body;
      },
      catch: (error) =>
        new HttpError({
          message: `Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`,
          status: 500,
        }),
    });

  const listCalendarEvents = (
    accessToken: string,
    timeMin: string,
    timeMax: string,
    pageSize = 50,
    pageToken?: string,
  ): Effect.Effect<GoogleCalendarEventsResponse, HttpError> =>
    Effect.tryPromise({
      try: async () => {
        const params = new URLSearchParams({
          timeMin,
          timeMax,
          singleEvents: 'true',
          orderBy: 'startTime',
          maxResults: pageSize.toString(),
        });

        if (pageToken) {
          params.set('pageToken', pageToken);
        }

        const res = await fetch(`${GOOGLE_API_BASE}/calendar/v3/calendars/primary/events?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!res.ok) {
          const error = await res.text();
          throw new Error(`Google Calendar API error: ${res.status} - ${error}`);
        }

        return res.json() as Promise<GoogleCalendarEventsResponse>;
      },
      catch: (error) =>
        new HttpError({
          message: `Failed to list calendar events: ${error instanceof Error ? error.message : 'Unknown error'}`,
          status: 500,
        }),
    });

  const parseRecordings = (response: GoogleDriveFilesResponse): GoogleMeetRecording[] => {
    return response.files.map((file) => {
      // Extract meeting title from filename
      // Format is typically: "Meeting Recording - Topic (YYYY-MM-DD at HH_MM_SS GMT-X).mp4"
      let meetingTitle = file.name;
      const meetingMatch = file.name.match(/^(.+?)\s*\(/);
      if (meetingMatch) {
        meetingTitle = meetingMatch[1].replace('Meeting Recording - ', '').trim();
      }

      return {
        id: file.id,
        name: file.name,
        meetingTitle,
        createdTime: new Date(file.createdTime),
        fileSize: file.size ? Number.parseInt(file.size, 10) : 0,
        downloadUrl: file.webContentLink || '',
        mimeType: file.mimeType,
      };
    });
  };

  // Video MIME types supported
  const VIDEO_MIME_TYPES = [
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-matroska',
    'video/webm',
    'video/x-flv',
    'video/x-ms-wmv',
    'video/3gpp',
    'video/mpeg',
    'video/ogg',
  ];

  const listVideoFiles = (
    accessToken: string,
    options: GoogleDriveSearchOptions = {},
  ): Effect.Effect<GoogleDriveVideosResponse, HttpError> =>
    Effect.tryPromise({
      try: async () => {
        const { folderId, pageSize = 50, pageToken, orderBy = 'modifiedTime', orderDirection = 'desc' } = options;

        // Build query for all video files
        const mimeTypeQuery = VIDEO_MIME_TYPES.map((m) => `mimeType='${m}'`).join(' or ');
        let query = `(${mimeTypeQuery}) and trashed=false`;

        // Add folder filter if specified
        if (folderId) {
          query += ` and '${folderId}' in parents`;
        }

        const params = new URLSearchParams({
          q: query,
          fields:
            'kind,nextPageToken,files(id,name,mimeType,createdTime,modifiedTime,size,thumbnailLink,webViewLink,parents)',
          orderBy: `${orderBy} ${orderDirection}`,
          pageSize: pageSize.toString(),
          supportsAllDrives: 'true',
          includeItemsFromAllDrives: 'true',
        });

        if (pageToken) {
          params.set('pageToken', pageToken);
        }

        const res = await fetch(`${GOOGLE_API_BASE}/drive/v3/files?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!res.ok) {
          const error = await res.text();
          throw new Error(`Google Drive API error: ${res.status} - ${error}`);
        }

        const response = (await res.json()) as GoogleDriveFilesResponse & {
          files: Array<GoogleDriveFile & { thumbnailLink?: string }>;
        };

        return {
          files: response.files.map((file) => ({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
            size: file.size ? Number.parseInt(file.size, 10) : 0,
            createdTime: file.createdTime,
            modifiedTime: file.modifiedTime,
            thumbnailLink: file.thumbnailLink,
            webViewLink: file.webViewLink,
            parentId: file.parents?.[0],
          })),
          nextPageToken: response.nextPageToken,
        };
      },
      catch: (error) =>
        new HttpError({
          message: `Failed to list video files: ${error instanceof Error ? error.message : 'Unknown error'}`,
          status: 500,
        }),
    });

  const listFolders = (
    accessToken: string,
    parentId?: string,
    pageSize = 100,
    pageToken?: string,
  ): Effect.Effect<GoogleDriveFoldersResponse, HttpError> =>
    Effect.tryPromise({
      try: async () => {
        let query = "mimeType='application/vnd.google-apps.folder' and trashed=false";
        if (parentId) {
          query += ` and '${parentId}' in parents`;
        } else {
          // Root level folders
          query += " and 'root' in parents";
        }

        const params = new URLSearchParams({
          q: query,
          fields: 'nextPageToken,files(id,name,modifiedTime,parents)',
          orderBy: 'name',
          pageSize: pageSize.toString(),
          supportsAllDrives: 'true',
          includeItemsFromAllDrives: 'true',
        });

        if (pageToken) {
          params.set('pageToken', pageToken);
        }

        const res = await fetch(`${GOOGLE_API_BASE}/drive/v3/files?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!res.ok) {
          const error = await res.text();
          throw new Error(`Google Drive API error: ${res.status} - ${error}`);
        }

        const response = (await res.json()) as { files: GoogleDriveFile[]; nextPageToken?: string };

        return {
          folders: response.files.map((file) => ({
            id: file.id,
            name: file.name,
            parentId: file.parents?.[0],
            modifiedTime: file.modifiedTime,
          })),
          nextPageToken: response.nextPageToken,
        };
      },
      catch: (error) =>
        new HttpError({
          message: `Failed to list folders: ${error instanceof Error ? error.message : 'Unknown error'}`,
          status: 500,
        }),
    });

  const searchVideos = (
    accessToken: string,
    searchQuery: string,
    pageSize = 50,
    pageToken?: string,
  ): Effect.Effect<GoogleDriveVideosResponse, HttpError> =>
    Effect.tryPromise({
      try: async () => {
        // Build query for video files matching search term
        const mimeTypeQuery = VIDEO_MIME_TYPES.map((m) => `mimeType='${m}'`).join(' or ');
        const escapedQuery = searchQuery.replace(/'/g, "\\'");
        const query = `(${mimeTypeQuery}) and trashed=false and name contains '${escapedQuery}'`;

        const params = new URLSearchParams({
          q: query,
          fields:
            'nextPageToken,files(id,name,mimeType,createdTime,modifiedTime,size,thumbnailLink,webViewLink,parents)',
          orderBy: 'modifiedTime desc',
          pageSize: pageSize.toString(),
          supportsAllDrives: 'true',
          includeItemsFromAllDrives: 'true',
        });

        if (pageToken) {
          params.set('pageToken', pageToken);
        }

        const res = await fetch(`${GOOGLE_API_BASE}/drive/v3/files?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!res.ok) {
          const error = await res.text();
          throw new Error(`Google Drive API error: ${res.status} - ${error}`);
        }

        const response = (await res.json()) as GoogleDriveFilesResponse & {
          files: Array<GoogleDriveFile & { thumbnailLink?: string }>;
        };

        return {
          files: response.files.map((file) => ({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
            size: file.size ? Number.parseInt(file.size, 10) : 0,
            createdTime: file.createdTime,
            modifiedTime: file.modifiedTime,
            thumbnailLink: file.thumbnailLink,
            webViewLink: file.webViewLink,
            parentId: file.parents?.[0],
          })),
          nextPageToken: response.nextPageToken,
        };
      },
      catch: (error) =>
        new HttpError({
          message: `Failed to search videos: ${error instanceof Error ? error.message : 'Unknown error'}`,
          status: 500,
        }),
    });

  return {
    isConfigured,
    getAuthorizationUrl,
    exchangeCodeForToken,
    refreshAccessToken,
    getUserInfo,
    listMeetRecordings,
    getFile,
    getDownloadUrl,
    downloadFile,
    listCalendarEvents,
    parseRecordings,
    listVideoFiles,
    listFolders,
    searchVideos,
  } satisfies GoogleMeetServiceInterface;
});

// =============================================================================
// Google Meet Layer
// =============================================================================

export const GoogleMeetLive = Layer.effect(GoogleMeet, makeGoogleMeetService);

// =============================================================================
// Google Meet Helper Functions
// =============================================================================

export const getGoogleAuthorizationUrl = (state: string): Effect.Effect<string, never, GoogleMeet> =>
  Effect.gen(function* () {
    const google = yield* GoogleMeet;
    return yield* google.getAuthorizationUrl(state);
  });

export const exchangeGoogleCodeForToken = (code: string): Effect.Effect<GoogleTokenResponse, HttpError, GoogleMeet> =>
  Effect.gen(function* () {
    const google = yield* GoogleMeet;
    return yield* google.exchangeCodeForToken(code);
  });

export const refreshGoogleAccessToken = (
  refreshToken: string,
): Effect.Effect<GoogleTokenResponse, HttpError, GoogleMeet> =>
  Effect.gen(function* () {
    const google = yield* GoogleMeet;
    return yield* google.refreshAccessToken(refreshToken);
  });

export const getGoogleUserInfo = (accessToken: string): Effect.Effect<GoogleUserInfo, HttpError, GoogleMeet> =>
  Effect.gen(function* () {
    const google = yield* GoogleMeet;
    return yield* google.getUserInfo(accessToken);
  });

export const listGoogleMeetRecordings = (
  accessToken: string,
  pageSize?: number,
  pageToken?: string,
): Effect.Effect<GoogleDriveFilesResponse, HttpError, GoogleMeet> =>
  Effect.gen(function* () {
    const google = yield* GoogleMeet;
    return yield* google.listMeetRecordings(accessToken, pageSize, pageToken);
  });

export const downloadGoogleFile = (
  accessToken: string,
  fileId: string,
): Effect.Effect<ReadableStream<Uint8Array>, HttpError, GoogleMeet> =>
  Effect.gen(function* () {
    const google = yield* GoogleMeet;
    return yield* google.downloadFile(accessToken, fileId);
  });

export const listGoogleDriveVideos = (
  accessToken: string,
  options?: GoogleDriveSearchOptions,
): Effect.Effect<GoogleDriveVideosResponse, HttpError, GoogleMeet> =>
  Effect.gen(function* () {
    const google = yield* GoogleMeet;
    return yield* google.listVideoFiles(accessToken, options);
  });

export const listGoogleDriveFolders = (
  accessToken: string,
  parentId?: string,
  pageSize?: number,
  pageToken?: string,
): Effect.Effect<GoogleDriveFoldersResponse, HttpError, GoogleMeet> =>
  Effect.gen(function* () {
    const google = yield* GoogleMeet;
    return yield* google.listFolders(accessToken, parentId, pageSize, pageToken);
  });

export const searchGoogleDriveVideos = (
  accessToken: string,
  query: string,
  pageSize?: number,
  pageToken?: string,
): Effect.Effect<GoogleDriveVideosResponse, HttpError, GoogleMeet> =>
  Effect.gen(function* () {
    const google = yield* GoogleMeet;
    return yield* google.searchVideos(accessToken, query, pageSize, pageToken);
  });
