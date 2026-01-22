import { ConfidentialClientApplication } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import { Context, Effect, Layer } from 'effect';

export interface MicrosoftTeamsAuthConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly tenantId: string;
}

export interface MicrosoftTeamsClientService {
  createMsalClient: (config: MicrosoftTeamsAuthConfig) => Effect.Effect<ConfidentialClientApplication, never>;
  createGraphClient: (accessToken: string) => Effect.Effect<Client, never>;
}

export class MicrosoftTeamsClient extends Context.Tag('MicrosoftTeamsClient')<
  MicrosoftTeamsClient,
  MicrosoftTeamsClientService
>() {}

const makeMicrosoftTeamsClient = Effect.sync(
  (): MicrosoftTeamsClientService => ({
    createMsalClient: (config) =>
      Effect.sync(
        () =>
          new ConfidentialClientApplication({
            auth: {
              clientId: config.clientId,
              clientSecret: config.clientSecret,
              authority: `https://login.microsoftonline.com/${config.tenantId}`,
            },
          }),
      ),
    createGraphClient: (accessToken) =>
      Effect.sync(() =>
        Client.init({
          authProvider: (done) => {
            done(null, accessToken);
          },
        }),
      ),
  }),
);

export const MicrosoftTeamsClientLive = Layer.effect(MicrosoftTeamsClient, makeMicrosoftTeamsClient);
