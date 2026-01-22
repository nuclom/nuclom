/**
 * Google Meet Integration Service using Effect-TS
 *
 * Provides type-safe Google OAuth and Drive API operations for accessing Meet recordings.
 * Google Meet recordings are stored in Google Drive.
 */

import { Readable } from 'node:stream';
import { Config, Context, Effect, Layer, Option } from 'effect';
import type { calendar_v3, drive_v3, oauth2_v2 } from 'googleapis';
import { HttpError } from '../errors';
import { GoogleClient, type GoogleClientConfig } from './google-client';

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

export type GoogleUserInfo = oauth2_v2.Schema$Userinfo;
export type GoogleDriveFile = drive_v3.Schema$File;
export type GoogleDriveFilesResponse = drive_v3.Schema$FileList;
export type GoogleCalendarEvent = calendar_v3.Schema$Event;
export type GoogleCalendarEventsResponse = calendar_v3.Schema$Events;

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
  const googleClient = yield* GoogleClient;

  const isConfigured =
    Option.isSome(config.clientId) && Option.isSome(config.clientSecret) && Option.isSome(config.baseUrl);

  const getConfig = (): GoogleClientConfig | null => {
    if (!isConfigured) return null;
    return {
      clientId: Option.getOrThrow(config.clientId),
      clientSecret: Option.getOrThrow(config.clientSecret),
      redirectUri: `${Option.getOrThrow(config.baseUrl)}/api/integrations/google/callback`,
    };
  };

  const getAuthorizationUrl = (state: string): Effect.Effect<string, never> =>
    Effect.gen(function* () {
      const cfg = getConfig();
      if (!cfg) {
        throw new Error('Google is not configured');
      }

      const client = yield* googleClient.createOAuthClient(cfg);
      return client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: GOOGLE_SCOPES,
        state,
      });
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

      const response = yield* Effect.gen(function* () {
        const client = yield* googleClient.createOAuthClient(cfg);
        return yield* Effect.tryPromise({
          try: async () => {
            const { tokens } = await client.getToken(code);

            if (!tokens.access_token || !tokens.token_type || !tokens.scope || !tokens.expiry_date) {
              throw new Error('Missing token fields in Google OAuth response');
            }

            return {
              access_token: tokens.access_token,
              token_type: tokens.token_type,
              refresh_token: tokens.refresh_token ?? undefined,
              expires_in: Math.max(0, Math.floor((tokens.expiry_date - Date.now()) / 1000)),
              scope: Array.isArray(tokens.scope) ? tokens.scope.join(' ') : tokens.scope,
              id_token: tokens.id_token ?? undefined,
            } satisfies GoogleTokenResponse;
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

      const response = yield* Effect.gen(function* () {
        const client = yield* googleClient.createOAuthClient(cfg);
        return yield* Effect.tryPromise({
          try: async () => {
            client.setCredentials({ refresh_token: refreshToken });
            const { credentials } = await client.refreshAccessToken();
            const tokens = credentials;

            if (!tokens.access_token || !tokens.token_type || !tokens.scope || !tokens.expiry_date) {
              throw new Error('Missing token fields in Google OAuth response');
            }

            return {
              access_token: tokens.access_token,
              token_type: tokens.token_type,
              refresh_token: tokens.refresh_token ?? refreshToken,
              expires_in: Math.max(0, Math.floor((tokens.expiry_date - Date.now()) / 1000)),
              scope: Array.isArray(tokens.scope) ? tokens.scope.join(' ') : tokens.scope,
              id_token: tokens.id_token ?? undefined,
            } satisfies GoogleTokenResponse;
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

  const getUserInfo = (accessToken: string): Effect.Effect<GoogleUserInfo, HttpError> =>
    Effect.gen(function* () {
      const cfg = getConfig();
      if (!cfg) {
        throw new Error('Google is not configured');
      }

      const authClient = yield* googleClient.createAuthedClient(cfg, accessToken);
      const oauth2 = yield* googleClient.createOauth2Api(authClient);
      return yield* Effect.tryPromise({
        try: async () => {
          const res = await oauth2.userinfo.get();

          if (!res.data) {
            throw new Error('Google userinfo response missing data');
          }

          return res.data;
        },
        catch: (error) =>
          new HttpError({
            message: `Failed to get user info: ${error instanceof Error ? error.message : 'Unknown error'}`,
            status: 500,
          }),
      });
    });

  const listMeetRecordings = (
    accessToken: string,
    pageSize = 50,
    pageToken?: string,
  ): Effect.Effect<GoogleDriveFilesResponse, HttpError> =>
    Effect.gen(function* () {
      const cfg = getConfig();
      if (!cfg) {
        throw new Error('Google is not configured');
      }

      const authClient = yield* googleClient.createAuthedClient(cfg, accessToken);
      const drive = yield* googleClient.createDriveApi(authClient);

      return yield* Effect.tryPromise({
        try: async () => {
          const res = await drive.files.list({
            q: "mimeType='video/mp4' and name contains 'Meet Recording'",
            orderBy: 'createdTime desc',
            pageSize,
            pageToken,
            fields:
              'kind,nextPageToken,incompleteSearch,files(id,name,mimeType,createdTime,modifiedTime,size,webViewLink,webContentLink,parents)',
          });

          if (!res.data) {
            const empty: GoogleDriveFilesResponse = { files: [] };
            return empty;
          }
          return res.data;
        },
        catch: (error) =>
          new HttpError({
            message: `Failed to list recordings: ${error instanceof Error ? error.message : 'Unknown error'}`,
            status: 500,
          }),
      });
    });

  const getFile = (accessToken: string, fileId: string): Effect.Effect<GoogleDriveFile, HttpError> =>
    Effect.gen(function* () {
      const cfg = getConfig();
      if (!cfg) {
        throw new Error('Google is not configured');
      }

      const authClient = yield* googleClient.createAuthedClient(cfg, accessToken);
      const drive = yield* googleClient.createDriveApi(authClient);
      return yield* Effect.tryPromise({
        try: async () => {
          const res = await drive.files.get({
            fileId,
            fields: 'id,name,mimeType,createdTime,modifiedTime,size,webViewLink,webContentLink,parents',
          });

          if (!res.data) {
            throw new Error('Google Drive file response missing data');
          }
          return res.data;
        },
        catch: (error) =>
          new HttpError({
            message: `Failed to get file: ${error instanceof Error ? error.message : 'Unknown error'}`,
            status: 500,
          }),
      });
    });

  const getDownloadUrl = (accessToken: string, fileId: string): Effect.Effect<string, HttpError> =>
    Effect.gen(function* () {
      const cfg = getConfig();
      if (!cfg) {
        throw new Error('Google is not configured');
      }

      const authClient = yield* googleClient.createAuthedClient(cfg, accessToken);
      const drive = yield* googleClient.createDriveApi(authClient);
      return yield* Effect.tryPromise({
        try: async () => {
          const res = await drive.files.get({
            fileId,
            fields: 'webContentLink',
          });

          if (res.data.webContentLink) {
            return res.data.webContentLink;
          }

          return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&access_token=${accessToken}`;
        },
        catch: (error) =>
          new HttpError({
            message: `Failed to get download URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
            status: 500,
          }),
      });
    });

  const downloadFile = (accessToken: string, fileId: string): Effect.Effect<ReadableStream<Uint8Array>, HttpError> =>
    Effect.gen(function* () {
      const cfg = getConfig();
      if (!cfg) {
        throw new Error('Google is not configured');
      }

      const authClient = yield* googleClient.createAuthedClient(cfg, accessToken);
      const drive = yield* googleClient.createDriveApi(authClient);
      return yield* Effect.tryPromise({
        try: async () => {
          const res = await drive.files.get(
            {
              fileId,
              alt: 'media',
            },
            { responseType: 'stream' },
          );

          const stream = res.data;
          if (!(stream instanceof Readable)) {
            throw new Error('Unexpected stream response');
          }
          return new ReadableStream<Uint8Array>({
            start(controller) {
              stream.on('data', (chunk) => {
                controller.enqueue(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
              });
              stream.on('end', () => controller.close());
              stream.on('error', (err) => controller.error(err));
            },
            cancel() {
              stream.destroy();
            },
          });
        },
        catch: (error) =>
          new HttpError({
            message: `Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`,
            status: 500,
          }),
      });
    });

  const listCalendarEvents = (
    accessToken: string,
    timeMin: string,
    timeMax: string,
    pageSize = 50,
    pageToken?: string,
  ): Effect.Effect<GoogleCalendarEventsResponse, HttpError> =>
    Effect.gen(function* () {
      const cfg = getConfig();
      if (!cfg) {
        throw new Error('Google is not configured');
      }

      const authClient = yield* googleClient.createAuthedClient(cfg, accessToken);
      const calendar = yield* googleClient.createCalendarApi(authClient);
      return yield* Effect.tryPromise({
        try: async () => {
          const res = await calendar.events.list({
            calendarId: 'primary',
            timeMin,
            timeMax,
            singleEvents: true,
            orderBy: 'startTime',
            maxResults: pageSize,
            pageToken,
          });

          if (!res.data) {
            const empty: GoogleCalendarEventsResponse = { items: [] };
            return empty;
          }
          return res.data;
        },
        catch: (error) =>
          new HttpError({
            message: `Failed to list calendar events: ${error instanceof Error ? error.message : 'Unknown error'}`,
            status: 500,
          }),
      });
    });

  const parseRecordings = (response: GoogleDriveFilesResponse): GoogleMeetRecording[] => {
    const files = response.files ?? [];
    return files.map((file) => {
      // Extract meeting title from filename
      // Format is typically: "Meeting Recording - Topic (YYYY-MM-DD at HH_MM_SS GMT-X).mp4"
      const fileName = file.name ?? 'Meeting Recording';
      let meetingTitle = fileName;
      const meetingMatch = fileName.match(/^(.+?)\s*\(/);
      if (meetingMatch) {
        meetingTitle = meetingMatch[1].replace('Meeting Recording - ', '').trim();
      }

      return {
        id: file.id ?? '',
        name: fileName,
        meetingTitle,
        createdTime: new Date(file.createdTime ?? new Date().toISOString()),
        fileSize: file.size ? Number.parseInt(file.size, 10) : 0,
        downloadUrl: file.webContentLink || '',
        mimeType: file.mimeType ?? 'video/mp4',
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
    Effect.gen(function* () {
      const cfg = getConfig();
      if (!cfg) {
        throw new Error('Google is not configured');
      }

      const { folderId, pageSize = 50, pageToken, orderBy = 'modifiedTime', orderDirection = 'desc' } = options;
      const authClient = yield* googleClient.createAuthedClient(cfg, accessToken);
      const drive = yield* googleClient.createDriveApi(authClient);

      return yield* Effect.tryPromise({
        try: async () => {
          const mimeTypeQuery = VIDEO_MIME_TYPES.map((m) => `mimeType='${m}'`).join(' or ');
          let query = `(${mimeTypeQuery}) and trashed=false`;

          if (folderId) {
            query += ` and '${folderId}' in parents`;
          }

          const res = await drive.files.list({
            q: query,
            orderBy: `${orderBy} ${orderDirection}`,
            pageSize,
            pageToken,
            fields:
              'kind,nextPageToken,files(id,name,mimeType,createdTime,modifiedTime,size,thumbnailLink,webViewLink,parents)',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
          });

          const response = (res.data ?? { files: [] }) satisfies GoogleDriveFilesResponse;
          const files = response.files ?? [];
          return {
            files: files.map((file) => ({
              id: file.id ?? '',
              name: file.name ?? 'Untitled',
              mimeType: file.mimeType ?? 'application/octet-stream',
              size: file.size ? Number.parseInt(file.size, 10) : 0,
              createdTime: file.createdTime ?? new Date().toISOString(),
              modifiedTime: file.modifiedTime ?? new Date().toISOString(),
              thumbnailLink: file.thumbnailLink ?? undefined,
              webViewLink: file.webViewLink ?? undefined,
              parentId: file.parents?.[0],
            })),
            nextPageToken: response.nextPageToken ?? undefined,
          };
        },
        catch: (error) =>
          new HttpError({
            message: `Failed to list video files: ${error instanceof Error ? error.message : 'Unknown error'}`,
            status: 500,
          }),
      });
    });

  const listFolders = (
    accessToken: string,
    parentId?: string,
    pageSize = 100,
    pageToken?: string,
  ): Effect.Effect<GoogleDriveFoldersResponse, HttpError> =>
    Effect.gen(function* () {
      const cfg = getConfig();
      if (!cfg) {
        throw new Error('Google is not configured');
      }

      let query = "mimeType='application/vnd.google-apps.folder' and trashed=false";
      if (parentId) {
        query += ` and '${parentId}' in parents`;
      } else {
        query += " and 'root' in parents";
      }

      const authClient = yield* googleClient.createAuthedClient(cfg, accessToken);
      const drive = yield* googleClient.createDriveApi(authClient);
      return yield* Effect.tryPromise({
        try: async () => {
          const res = await drive.files.list({
            q: query,
            orderBy: 'name',
            pageSize,
            pageToken,
            fields: 'nextPageToken,files(id,name,modifiedTime,parents)',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
          });

          const response = res.data ?? { files: [] };
          const files = response.files ?? [];
          return {
            folders: files.map((file) => ({
              id: file.id ?? '',
              name: file.name ?? 'Untitled',
              parentId: file.parents?.[0],
              modifiedTime: file.modifiedTime ?? new Date().toISOString(),
            })),
            nextPageToken: response.nextPageToken ?? undefined,
          };
        },
        catch: (error) =>
          new HttpError({
            message: `Failed to list folders: ${error instanceof Error ? error.message : 'Unknown error'}`,
            status: 500,
          }),
      });
    });

  const searchVideos = (
    accessToken: string,
    searchQuery: string,
    pageSize = 50,
    pageToken?: string,
  ): Effect.Effect<GoogleDriveVideosResponse, HttpError> =>
    Effect.gen(function* () {
      const cfg = getConfig();
      if (!cfg) {
        throw new Error('Google is not configured');
      }

      const mimeTypeQuery = VIDEO_MIME_TYPES.map((m) => `mimeType='${m}'`).join(' or ');
      const escapedQuery = searchQuery.replace(/'/g, "\\'");
      const query = `(${mimeTypeQuery}) and trashed=false and name contains '${escapedQuery}'`;

      const authClient = yield* googleClient.createAuthedClient(cfg, accessToken);
      const drive = yield* googleClient.createDriveApi(authClient);
      return yield* Effect.tryPromise({
        try: async () => {
          const res = await drive.files.list({
            q: query,
            orderBy: 'modifiedTime desc',
            pageSize,
            pageToken,
            fields:
              'nextPageToken,files(id,name,mimeType,createdTime,modifiedTime,size,thumbnailLink,webViewLink,parents)',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
          });

          const response = (res.data ?? { files: [] }) satisfies GoogleDriveFilesResponse;
          const files = response.files ?? [];
          return {
            files: files.map((file) => ({
              id: file.id ?? '',
              name: file.name ?? 'Untitled',
              mimeType: file.mimeType ?? 'application/octet-stream',
              size: file.size ? Number.parseInt(file.size, 10) : 0,
              createdTime: file.createdTime ?? new Date().toISOString(),
              modifiedTime: file.modifiedTime ?? new Date().toISOString(),
              thumbnailLink: file.thumbnailLink ?? undefined,
              webViewLink: file.webViewLink ?? undefined,
              parentId: file.parents?.[0],
            })),
            nextPageToken: response.nextPageToken ?? undefined,
          };
        },
        catch: (error) =>
          new HttpError({
            message: `Failed to search videos: ${error instanceof Error ? error.message : 'Unknown error'}`,
            status: 500,
          }),
      });
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
