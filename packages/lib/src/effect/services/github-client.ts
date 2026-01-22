import { graphql } from '@octokit/graphql';
import { Context, Effect, Layer } from 'effect';
import { Octokit } from 'octokit';

export interface GitHubClientService {
  request: <T>(
    accessToken: string,
    method: string,
    endpoint: string,
    body?: Record<string, unknown>,
  ) => Effect.Effect<T, Error>;
  graphql: <T>(accessToken: string, query: string, variables?: Record<string, unknown>) => Effect.Effect<T, Error>;
}

export class GitHubClient extends Context.Tag('GitHubClient')<GitHubClient, GitHubClientService>() {}

const makeGitHubClient = Effect.sync(
  (): GitHubClientService => ({
    request: <T>(accessToken: string, method: string, endpoint: string, body?: Record<string, unknown>) =>
      Effect.tryPromise({
        try: async () => {
          const client = new Octokit({ auth: accessToken });
          const response = await client.request<T>({ method, url: endpoint, ...(body ? body : {}) });
          return response.data;
        },
        catch: (error) => new Error(`GitHub API error: ${error instanceof Error ? error.message : 'Unknown error'}`),
      }),
    graphql: <T>(accessToken: string, query: string, variables?: Record<string, unknown>) =>
      Effect.tryPromise({
        try: () => {
          const client = graphql.defaults({
            headers: {
              authorization: `token ${accessToken}`,
            },
          });
          return client<T>(query, variables ?? {});
        },
        catch: (error) =>
          new Error(`GitHub GraphQL error: ${error instanceof Error ? error.message : 'Unknown error'}`),
      }),
  }),
);

export const GitHubClientLive = Layer.effect(GitHubClient, makeGitHubClient);
