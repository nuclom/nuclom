import { Client } from '@notionhq/client';
import { Context, Effect, Layer } from 'effect';

export interface NotionClientService {
  create: (accessToken: string | undefined, notionVersion: string) => Effect.Effect<Client, never>;
}

export class NotionClient extends Context.Tag('NotionClient')<NotionClient, NotionClientService>() {}

const makeNotionClient = Effect.sync(
  (): NotionClientService => ({
    create: (accessToken, notionVersion) =>
      Effect.sync(
        () =>
          new Client({
            auth: accessToken,
            notionVersion,
          }),
      ),
  }),
);

export const NotionClientLive = Layer.effect(NotionClient, makeNotionClient);
