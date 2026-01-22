/**
 * GitHub API Client
 *
 * Low-level API helpers for making GitHub REST and GraphQL API requests.
 */

import { Effect } from 'effect';
import { GitHubClient } from '../../github-client';

/**
 * Make a REST API request to GitHub
 */
export const githubFetch = <T>(
  endpoint: string,
  accessToken: string,
  options?: { method?: string; body?: unknown },
): Effect.Effect<T, Error, GitHubClient> =>
  Effect.gen(function* () {
    const client = yield* GitHubClient;
    const method = options?.method ?? 'GET';
    const body =
      options?.body && typeof options.body === 'object' ? (options.body as Record<string, unknown>) : undefined;
    return yield* client.request<T>(accessToken, method, endpoint, body);
  });

/**
 * Make a GraphQL request to GitHub
 */
export const githubGraphQL = <T>(
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>,
): Effect.Effect<T, Error, GitHubClient> =>
  Effect.gen(function* () {
    const client = yield* GitHubClient;
    return yield* client.graphql<T>(accessToken, query, variables);
  });
