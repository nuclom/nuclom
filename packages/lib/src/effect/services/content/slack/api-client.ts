/**
 * Slack API Client
 *
 * Low-level API helper for making Slack API requests.
 */

import { Effect } from 'effect';
import { SlackClient } from '../../slack-client';

/**
 * Make a GET request to the Slack API
 */
export const slackFetch = <T>(
  endpoint: string,
  accessToken: string,
  params?: Record<string, string | number | boolean>,
): Effect.Effect<T, Error, SlackClient> =>
  Effect.gen(function* () {
    const slackClient = yield* SlackClient;
    const client = yield* slackClient.create(accessToken);
    return yield* Effect.tryPromise({
      try: async () => {
        const data = (await client.apiCall(endpoint, params ?? {})) as T & { ok: boolean; error?: string };
        if (!data.ok) {
          throw new Error(`Slack API error: ${data.error || 'Unknown error'}`);
        }
        return data;
      },
      catch: (error) => {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return new Error(`Slack API error: ${message}`);
      },
    });
  });
