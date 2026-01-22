import {
  MeetingsOAuthClient,
  type OAuthToken as MeetingsOAuthToken,
  type TokenStore as MeetingsTokenStore,
} from '@zoom/rivet/meetings';
import {
  UsersOAuthClient,
  type OAuthToken as UsersOAuthToken,
  type TokenStore as UsersTokenStore,
} from '@zoom/rivet/users';
import { Config, Context, Effect, Layer, Option } from 'effect';

export interface ZoomClientConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}

export interface ZoomClientService {
  readonly isConfigured: boolean;
  readonly config: ZoomClientConfig | null;
  readonly createMeetingsClient: (
    tokenStore: MeetingsTokenStore<MeetingsOAuthToken>,
  ) => Effect.Effect<MeetingsOAuthClient, never>;
  readonly createUsersClient: (tokenStore: UsersTokenStore<UsersOAuthToken>) => Effect.Effect<UsersOAuthClient, never>;
}

export class ZoomClient extends Context.Tag('ZoomClient')<ZoomClient, ZoomClientService>() {}

const ZoomClientConfigEffect = Config.all({
  clientId: Config.string('ZOOM_CLIENT_ID').pipe(Config.option),
  clientSecret: Config.string('ZOOM_CLIENT_SECRET').pipe(Config.option),
  baseUrl: Config.string('NEXT_PUBLIC_URL').pipe(Config.option),
});

const makeZoomClient = Effect.gen(function* () {
  const config = yield* ZoomClientConfigEffect;

  const isConfigured =
    Option.isSome(config.clientId) && Option.isSome(config.clientSecret) && Option.isSome(config.baseUrl);

  const resolvedConfig = isConfigured
    ? {
        clientId: Option.getOrThrow(config.clientId),
        clientSecret: Option.getOrThrow(config.clientSecret),
        redirectUri: `${Option.getOrThrow(config.baseUrl)}/api/integrations/zoom/callback`,
      }
    : null;

  const createInstallerOptions = (cfg: ZoomClientConfig) => ({
    redirectUri: cfg.redirectUri,
    stateStore: cfg.clientSecret,
  });

  const createMeetingsClient = (tokenStore: MeetingsTokenStore<MeetingsOAuthToken>) =>
    Effect.sync(() => {
      if (!resolvedConfig) {
        throw new Error('Zoom is not configured');
      }
      return new MeetingsOAuthClient({
        clientId: resolvedConfig.clientId,
        clientSecret: resolvedConfig.clientSecret,
        tokenStore,
        installerOptions: createInstallerOptions(resolvedConfig),
        disableReceiver: true,
      });
    });

  const createUsersClient = (tokenStore: UsersTokenStore<UsersOAuthToken>) =>
    Effect.sync(() => {
      if (!resolvedConfig) {
        throw new Error('Zoom is not configured');
      }
      return new UsersOAuthClient({
        clientId: resolvedConfig.clientId,
        clientSecret: resolvedConfig.clientSecret,
        tokenStore,
        installerOptions: createInstallerOptions(resolvedConfig),
        disableReceiver: true,
      });
    });

  return {
    isConfigured,
    config: resolvedConfig,
    createMeetingsClient,
    createUsersClient,
  } satisfies ZoomClientService;
});

export const ZoomClientLive = Layer.effect(ZoomClient, makeZoomClient);
