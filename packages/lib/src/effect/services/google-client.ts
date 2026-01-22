import { Context, Effect, Layer } from 'effect';
import type { calendar_v3, drive_v3, oauth2_v2 } from 'googleapis';
import { google } from 'googleapis';

export interface GoogleClientConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}

type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

export interface GoogleClientService {
  createOAuthClient: (config: GoogleClientConfig) => Effect.Effect<OAuth2Client, never>;
  createAuthedClient: (config: GoogleClientConfig, accessToken: string) => Effect.Effect<OAuth2Client, never>;
  createOauth2Api: (authClient: OAuth2Client) => Effect.Effect<oauth2_v2.Oauth2, never>;
  createDriveApi: (authClient: OAuth2Client) => Effect.Effect<drive_v3.Drive, never>;
  createCalendarApi: (authClient: OAuth2Client) => Effect.Effect<calendar_v3.Calendar, never>;
}

export class GoogleClient extends Context.Tag('GoogleClient')<GoogleClient, GoogleClientService>() {}

const makeGoogleClient = Effect.sync(
  (): GoogleClientService => ({
    createOAuthClient: (config) =>
      Effect.sync(() => new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri)),
    createAuthedClient: (config, accessToken) =>
      Effect.sync(() => {
        const client = new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
        client.setCredentials({ access_token: accessToken });
        return client;
      }),
    createOauth2Api: (authClient) => Effect.sync(() => google.oauth2({ version: 'v2', auth: authClient })),
    createDriveApi: (authClient) => Effect.sync(() => google.drive({ version: 'v3', auth: authClient })),
    createCalendarApi: (authClient) => Effect.sync(() => google.calendar({ version: 'v3', auth: authClient })),
  }),
);

export const GoogleClientLive = Layer.effect(GoogleClient, makeGoogleClient);
