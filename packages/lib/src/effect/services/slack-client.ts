import { WebClient } from '@slack/web-api';
import { IncomingWebhook } from '@slack/webhook';
import { Context, Effect, Layer } from 'effect';

export interface SlackClientService {
  create: (accessToken?: string) => Effect.Effect<WebClient, never>;
}

export class SlackClient extends Context.Tag('SlackClient')<SlackClient, SlackClientService>() {}

const makeSlackClient = Effect.sync(
  (): SlackClientService => ({
    create: (accessToken) => Effect.sync(() => new WebClient(accessToken)),
  }),
);

export const SlackClientLive = Layer.effect(SlackClient, makeSlackClient);

export interface SlackWebhookClientService {
  create: (webhookUrl: string) => Effect.Effect<IncomingWebhook, never>;
}

export class SlackWebhookClient extends Context.Tag('SlackWebhookClient')<
  SlackWebhookClient,
  SlackWebhookClientService
>() {}

const makeSlackWebhookClient = Effect.sync(
  (): SlackWebhookClientService => ({
    create: (webhookUrl) => Effect.sync(() => new IncomingWebhook(webhookUrl)),
  }),
);

export const SlackWebhookClientLive = Layer.effect(SlackWebhookClient, makeSlackWebhookClient);
