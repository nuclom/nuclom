/**
 * GitHub Integration Service using Effect-TS
 *
 * Provides type-safe GitHub OAuth and API operations for accessing repositories,
 * pull requests, issues, commits, and files.
 */

import { Config, Context, Effect, Layer, Option } from 'effect';
import { HttpError } from '../errors';

// =============================================================================
// Types
// =============================================================================

export interface GitHubConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}

export interface GitHubTokenResponse {
  readonly access_token: string;
  readonly token_type: string;
  readonly scope: string;
  readonly refresh_token?: string;
  readonly expires_in?: number;
  readonly refresh_token_expires_in?: number;
}

export interface GitHubUserInfo {
  readonly id: number;
  readonly login: string;
  readonly name: string | null;
  readonly email: string | null;
  readonly avatar_url: string;
  readonly html_url: string;
}

export interface GitHubRepository {
  readonly id: number;
  readonly name: string;
  readonly full_name: string;
  readonly private: boolean;
  readonly html_url: string;
  readonly description: string | null;
  readonly default_branch: string;
  readonly owner: {
    readonly login: string;
    readonly avatar_url: string;
  };
}

export interface GitHubPullRequest {
  readonly id: number;
  readonly number: number;
  readonly title: string;
  readonly body: string | null;
  readonly state: 'open' | 'closed';
  readonly html_url: string;
  readonly user: {
    readonly login: string;
    readonly avatar_url: string;
  };
  readonly created_at: string;
  readonly updated_at: string;
  readonly merged_at: string | null;
  readonly head: {
    readonly ref: string;
    readonly sha: string;
  };
  readonly base: {
    readonly ref: string;
    readonly sha: string;
  };
}

export interface GitHubIssue {
  readonly id: number;
  readonly number: number;
  readonly title: string;
  readonly body: string | null;
  readonly state: 'open' | 'closed';
  readonly html_url: string;
  readonly user: {
    readonly login: string;
    readonly avatar_url: string;
  };
  readonly labels: Array<{
    readonly name: string;
    readonly color: string;
  }>;
  readonly created_at: string;
  readonly updated_at: string;
  readonly closed_at: string | null;
}

export interface GitHubCommit {
  readonly sha: string;
  readonly html_url: string;
  readonly commit: {
    readonly message: string;
    readonly author: {
      readonly name: string;
      readonly email: string;
      readonly date: string;
    };
  };
  readonly author: {
    readonly login: string;
    readonly avatar_url: string;
  } | null;
}

export interface GitHubFile {
  readonly name: string;
  readonly path: string;
  readonly sha: string;
  readonly size: number;
  readonly type: 'file' | 'dir';
  readonly html_url: string;
  readonly download_url: string | null;
}

export interface GitHubRepositoriesResponse {
  readonly repositories: GitHubRepository[];
  readonly nextPage?: number;
  readonly totalCount?: number;
}

// =============================================================================
// GitHub Service Interface
// =============================================================================

export interface GitHubServiceInterface {
  /**
   * Check if the GitHub integration is configured
   */
  readonly isConfigured: boolean;

  /**
   * Get the OAuth authorization URL
   */
  readonly getAuthorizationUrl: (state: string) => Effect.Effect<string, never>;

  /**
   * Exchange authorization code for access token
   */
  readonly exchangeCodeForToken: (code: string) => Effect.Effect<GitHubTokenResponse, HttpError>;

  /**
   * Refresh an access token (if using GitHub App)
   */
  readonly refreshAccessToken: (refreshToken: string) => Effect.Effect<GitHubTokenResponse, HttpError>;

  /**
   * Get the current user's info
   */
  readonly getUserInfo: (accessToken: string) => Effect.Effect<GitHubUserInfo, HttpError>;

  /**
   * List repositories the user has access to
   */
  readonly listRepositories: (
    accessToken: string,
    page?: number,
    perPage?: number,
  ) => Effect.Effect<GitHubRepositoriesResponse, HttpError>;

  /**
   * Get a specific repository
   */
  readonly getRepository: (
    accessToken: string,
    owner: string,
    repo: string,
  ) => Effect.Effect<GitHubRepository, HttpError>;

  /**
   * Get a pull request
   */
  readonly getPullRequest: (
    accessToken: string,
    owner: string,
    repo: string,
    prNumber: number,
  ) => Effect.Effect<GitHubPullRequest, HttpError>;

  /**
   * List pull requests for a repository
   */
  readonly listPullRequests: (
    accessToken: string,
    owner: string,
    repo: string,
    state?: 'open' | 'closed' | 'all',
    page?: number,
  ) => Effect.Effect<GitHubPullRequest[], HttpError>;

  /**
   * Get an issue
   */
  readonly getIssue: (
    accessToken: string,
    owner: string,
    repo: string,
    issueNumber: number,
  ) => Effect.Effect<GitHubIssue, HttpError>;

  /**
   * List issues for a repository
   */
  readonly listIssues: (
    accessToken: string,
    owner: string,
    repo: string,
    state?: 'open' | 'closed' | 'all',
    page?: number,
  ) => Effect.Effect<GitHubIssue[], HttpError>;

  /**
   * Get a commit
   */
  readonly getCommit: (
    accessToken: string,
    owner: string,
    repo: string,
    sha: string,
  ) => Effect.Effect<GitHubCommit, HttpError>;

  /**
   * List commits for a repository
   */
  readonly listCommits: (
    accessToken: string,
    owner: string,
    repo: string,
    page?: number,
    sha?: string,
  ) => Effect.Effect<GitHubCommit[], HttpError>;

  /**
   * Get repository contents (file or directory)
   */
  readonly getContents: (
    accessToken: string,
    owner: string,
    repo: string,
    path: string,
    ref?: string,
  ) => Effect.Effect<GitHubFile | GitHubFile[], HttpError>;

  /**
   * Search for code in repositories
   */
  readonly searchCode: (
    accessToken: string,
    query: string,
    page?: number,
  ) => Effect.Effect<
    {
      items: Array<{
        name: string;
        path: string;
        sha: string;
        html_url: string;
        repository: {
          full_name: string;
        };
      }>;
      total_count: number;
    },
    HttpError
  >;
}

// =============================================================================
// GitHub Service Tag
// =============================================================================

export class GitHub extends Context.Tag('GitHub')<GitHub, GitHubServiceInterface>() {}

// =============================================================================
// GitHub Configuration
// =============================================================================

const GITHUB_AUTH_BASE = 'https://github.com';
const GITHUB_API_BASE = 'https://api.github.com';

// Scopes needed for GitHub repository access
const GITHUB_SCOPES = ['read:user', 'user:email', 'repo', 'read:org'].join(' ');

const GitHubConfigEffect = Config.all({
  clientId: Config.string('GITHUB_CLIENT_ID').pipe(Config.option),
  clientSecret: Config.string('GITHUB_CLIENT_SECRET').pipe(Config.option),
  baseUrl: Config.string('NEXT_PUBLIC_URL').pipe(Config.option),
});

// =============================================================================
// GitHub Service Implementation
// =============================================================================

const makeGitHubService = Effect.gen(function* () {
  const config = yield* GitHubConfigEffect;

  const isConfigured =
    Option.isSome(config.clientId) && Option.isSome(config.clientSecret) && Option.isSome(config.baseUrl);

  const getConfig = (): GitHubConfig | null => {
    if (!isConfigured) return null;
    return {
      clientId: Option.getOrThrow(config.clientId),
      clientSecret: Option.getOrThrow(config.clientSecret),
      redirectUri: `${Option.getOrThrow(config.baseUrl)}/api/integrations/github/callback`,
    };
  };

  const getAuthorizationUrl = (state: string): Effect.Effect<string, never> =>
    Effect.sync(() => {
      const cfg = getConfig();
      if (!cfg) {
        throw new Error('GitHub is not configured');
      }

      const params = new URLSearchParams({
        client_id: cfg.clientId,
        redirect_uri: cfg.redirectUri,
        scope: GITHUB_SCOPES,
        state,
        allow_signup: 'false',
      });

      return `${GITHUB_AUTH_BASE}/login/oauth/authorize?${params.toString()}`;
    });

  const exchangeCodeForToken = (code: string): Effect.Effect<GitHubTokenResponse, HttpError> =>
    Effect.gen(function* () {
      const cfg = getConfig();
      if (!cfg) {
        return yield* Effect.fail(
          new HttpError({
            message: 'GitHub is not configured',
            status: 503,
          }),
        );
      }

      const response = yield* Effect.tryPromise({
        try: async () => {
          const res = await fetch(`${GITHUB_AUTH_BASE}/login/oauth/access_token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              client_id: cfg.clientId,
              client_secret: cfg.clientSecret,
              code,
              redirect_uri: cfg.redirectUri,
            }),
          });

          if (!res.ok) {
            const error = await res.text();
            throw new Error(`GitHub token exchange failed: ${res.status} - ${error}`);
          }

          const data = await res.json();
          if (data.error) {
            throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`);
          }

          return data as GitHubTokenResponse;
        },
        catch: (error) =>
          new HttpError({
            message: `Failed to exchange code for token: ${error instanceof Error ? error.message : 'Unknown error'}`,
            status: 500,
          }),
      });

      return response;
    });

  const refreshAccessToken = (refreshToken: string): Effect.Effect<GitHubTokenResponse, HttpError> =>
    Effect.gen(function* () {
      const cfg = getConfig();
      if (!cfg) {
        return yield* Effect.fail(
          new HttpError({
            message: 'GitHub is not configured',
            status: 503,
          }),
        );
      }

      const response = yield* Effect.tryPromise({
        try: async () => {
          const res = await fetch(`${GITHUB_AUTH_BASE}/login/oauth/access_token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              client_id: cfg.clientId,
              client_secret: cfg.clientSecret,
              grant_type: 'refresh_token',
              refresh_token: refreshToken,
            }),
          });

          if (!res.ok) {
            const error = await res.text();
            throw new Error(`GitHub token refresh failed: ${res.status} - ${error}`);
          }

          const data = await res.json();
          if (data.error) {
            throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`);
          }

          return data as GitHubTokenResponse;
        },
        catch: (error) =>
          new HttpError({
            message: `Failed to refresh access token: ${error instanceof Error ? error.message : 'Unknown error'}`,
            status: 500,
          }),
      });

      return response;
    });

  const getUserInfo = (accessToken: string): Effect.Effect<GitHubUserInfo, HttpError> =>
    Effect.tryPromise({
      try: async () => {
        const res = await fetch(`${GITHUB_API_BASE}/user`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        });

        if (!res.ok) {
          const error = await res.text();
          throw new Error(`GitHub API error: ${res.status} - ${error}`);
        }

        return res.json() as Promise<GitHubUserInfo>;
      },
      catch: (error) =>
        new HttpError({
          message: `Failed to get user info: ${error instanceof Error ? error.message : 'Unknown error'}`,
          status: 500,
        }),
    });

  const listRepositories = (
    accessToken: string,
    page = 1,
    perPage = 30,
  ): Effect.Effect<GitHubRepositoriesResponse, HttpError> =>
    Effect.tryPromise({
      try: async () => {
        const params = new URLSearchParams({
          type: 'all',
          sort: 'updated',
          direction: 'desc',
          per_page: perPage.toString(),
          page: page.toString(),
        });

        const res = await fetch(`${GITHUB_API_BASE}/user/repos?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        });

        if (!res.ok) {
          const error = await res.text();
          throw new Error(`GitHub API error: ${res.status} - ${error}`);
        }

        const repositories = (await res.json()) as GitHubRepository[];

        // Check for pagination
        const linkHeader = res.headers.get('Link');
        let nextPage: number | undefined;
        if (linkHeader?.includes('rel="next"')) {
          const match = linkHeader.match(/page=(\d+)>; rel="next"/);
          if (match) {
            nextPage = parseInt(match[1], 10);
          }
        }

        return {
          repositories,
          nextPage,
        };
      },
      catch: (error) =>
        new HttpError({
          message: `Failed to list repositories: ${error instanceof Error ? error.message : 'Unknown error'}`,
          status: 500,
        }),
    });

  const getRepository = (
    accessToken: string,
    owner: string,
    repo: string,
  ): Effect.Effect<GitHubRepository, HttpError> =>
    Effect.tryPromise({
      try: async () => {
        const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        });

        if (!res.ok) {
          const error = await res.text();
          throw new Error(`GitHub API error: ${res.status} - ${error}`);
        }

        return res.json() as Promise<GitHubRepository>;
      },
      catch: (error) =>
        new HttpError({
          message: `Failed to get repository: ${error instanceof Error ? error.message : 'Unknown error'}`,
          status: 500,
        }),
    });

  const getPullRequest = (
    accessToken: string,
    owner: string,
    repo: string,
    prNumber: number,
  ): Effect.Effect<GitHubPullRequest, HttpError> =>
    Effect.tryPromise({
      try: async () => {
        const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        });

        if (!res.ok) {
          const error = await res.text();
          throw new Error(`GitHub API error: ${res.status} - ${error}`);
        }

        return res.json() as Promise<GitHubPullRequest>;
      },
      catch: (error) =>
        new HttpError({
          message: `Failed to get pull request: ${error instanceof Error ? error.message : 'Unknown error'}`,
          status: 500,
        }),
    });

  const listPullRequests = (
    accessToken: string,
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'open',
    page = 1,
  ): Effect.Effect<GitHubPullRequest[], HttpError> =>
    Effect.tryPromise({
      try: async () => {
        const params = new URLSearchParams({
          state,
          sort: 'updated',
          direction: 'desc',
          per_page: '30',
          page: page.toString(),
        });

        const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        });

        if (!res.ok) {
          const error = await res.text();
          throw new Error(`GitHub API error: ${res.status} - ${error}`);
        }

        return res.json() as Promise<GitHubPullRequest[]>;
      },
      catch: (error) =>
        new HttpError({
          message: `Failed to list pull requests: ${error instanceof Error ? error.message : 'Unknown error'}`,
          status: 500,
        }),
    });

  const getIssue = (
    accessToken: string,
    owner: string,
    repo: string,
    issueNumber: number,
  ): Effect.Effect<GitHubIssue, HttpError> =>
    Effect.tryPromise({
      try: async () => {
        const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${issueNumber}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        });

        if (!res.ok) {
          const error = await res.text();
          throw new Error(`GitHub API error: ${res.status} - ${error}`);
        }

        return res.json() as Promise<GitHubIssue>;
      },
      catch: (error) =>
        new HttpError({
          message: `Failed to get issue: ${error instanceof Error ? error.message : 'Unknown error'}`,
          status: 500,
        }),
    });

  const listIssues = (
    accessToken: string,
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'open',
    page = 1,
  ): Effect.Effect<GitHubIssue[], HttpError> =>
    Effect.tryPromise({
      try: async () => {
        const params = new URLSearchParams({
          state,
          sort: 'updated',
          direction: 'desc',
          per_page: '30',
          page: page.toString(),
        });

        const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/issues?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        });

        if (!res.ok) {
          const error = await res.text();
          throw new Error(`GitHub API error: ${res.status} - ${error}`);
        }

        return res.json() as Promise<GitHubIssue[]>;
      },
      catch: (error) =>
        new HttpError({
          message: `Failed to list issues: ${error instanceof Error ? error.message : 'Unknown error'}`,
          status: 500,
        }),
    });

  const getCommit = (
    accessToken: string,
    owner: string,
    repo: string,
    sha: string,
  ): Effect.Effect<GitHubCommit, HttpError> =>
    Effect.tryPromise({
      try: async () => {
        const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/commits/${sha}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        });

        if (!res.ok) {
          const error = await res.text();
          throw new Error(`GitHub API error: ${res.status} - ${error}`);
        }

        return res.json() as Promise<GitHubCommit>;
      },
      catch: (error) =>
        new HttpError({
          message: `Failed to get commit: ${error instanceof Error ? error.message : 'Unknown error'}`,
          status: 500,
        }),
    });

  const listCommits = (
    accessToken: string,
    owner: string,
    repo: string,
    page = 1,
    sha?: string,
  ): Effect.Effect<GitHubCommit[], HttpError> =>
    Effect.tryPromise({
      try: async () => {
        const params = new URLSearchParams({
          per_page: '30',
          page: page.toString(),
        });
        if (sha) {
          params.set('sha', sha);
        }

        const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/commits?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        });

        if (!res.ok) {
          const error = await res.text();
          throw new Error(`GitHub API error: ${res.status} - ${error}`);
        }

        return res.json() as Promise<GitHubCommit[]>;
      },
      catch: (error) =>
        new HttpError({
          message: `Failed to list commits: ${error instanceof Error ? error.message : 'Unknown error'}`,
          status: 500,
        }),
    });

  const getContents = (
    accessToken: string,
    owner: string,
    repo: string,
    path: string,
    ref?: string,
  ): Effect.Effect<GitHubFile | GitHubFile[], HttpError> =>
    Effect.tryPromise({
      try: async () => {
        const params = new URLSearchParams();
        if (ref) {
          params.set('ref', ref);
        }

        const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}${params.toString() ? `?${params.toString()}` : ''}`;
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        });

        if (!res.ok) {
          const error = await res.text();
          throw new Error(`GitHub API error: ${res.status} - ${error}`);
        }

        return res.json() as Promise<GitHubFile | GitHubFile[]>;
      },
      catch: (error) =>
        new HttpError({
          message: `Failed to get contents: ${error instanceof Error ? error.message : 'Unknown error'}`,
          status: 500,
        }),
    });

  const searchCode = (
    accessToken: string,
    query: string,
    page = 1,
  ): Effect.Effect<
    {
      items: Array<{
        name: string;
        path: string;
        sha: string;
        html_url: string;
        repository: {
          full_name: string;
        };
      }>;
      total_count: number;
    },
    HttpError
  > =>
    Effect.tryPromise({
      try: async () => {
        const params = new URLSearchParams({
          q: query,
          per_page: '30',
          page: page.toString(),
        });

        const res = await fetch(`${GITHUB_API_BASE}/search/code?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        });

        if (!res.ok) {
          const error = await res.text();
          throw new Error(`GitHub API error: ${res.status} - ${error}`);
        }

        return res.json();
      },
      catch: (error) =>
        new HttpError({
          message: `Failed to search code: ${error instanceof Error ? error.message : 'Unknown error'}`,
          status: 500,
        }),
    });

  return {
    isConfigured,
    getAuthorizationUrl,
    exchangeCodeForToken,
    refreshAccessToken,
    getUserInfo,
    listRepositories,
    getRepository,
    getPullRequest,
    listPullRequests,
    getIssue,
    listIssues,
    getCommit,
    listCommits,
    getContents,
    searchCode,
  } satisfies GitHubServiceInterface;
});

// =============================================================================
// GitHub Layer
// =============================================================================

export const GitHubLive = Layer.effect(GitHub, makeGitHubService);

// =============================================================================
// GitHub Helper Functions
// =============================================================================

export const getGitHubAuthorizationUrl = (state: string): Effect.Effect<string, never, GitHub> =>
  Effect.gen(function* () {
    const github = yield* GitHub;
    return yield* github.getAuthorizationUrl(state);
  });

export const exchangeGitHubCodeForToken = (code: string): Effect.Effect<GitHubTokenResponse, HttpError, GitHub> =>
  Effect.gen(function* () {
    const github = yield* GitHub;
    return yield* github.exchangeCodeForToken(code);
  });

export const refreshGitHubAccessToken = (refreshToken: string): Effect.Effect<GitHubTokenResponse, HttpError, GitHub> =>
  Effect.gen(function* () {
    const github = yield* GitHub;
    return yield* github.refreshAccessToken(refreshToken);
  });

export const getGitHubUserInfo = (accessToken: string): Effect.Effect<GitHubUserInfo, HttpError, GitHub> =>
  Effect.gen(function* () {
    const github = yield* GitHub;
    return yield* github.getUserInfo(accessToken);
  });

export const listGitHubRepositories = (
  accessToken: string,
  page?: number,
  perPage?: number,
): Effect.Effect<GitHubRepositoriesResponse, HttpError, GitHub> =>
  Effect.gen(function* () {
    const github = yield* GitHub;
    return yield* github.listRepositories(accessToken, page, perPage);
  });

export const getGitHubRepository = (
  accessToken: string,
  owner: string,
  repo: string,
): Effect.Effect<GitHubRepository, HttpError, GitHub> =>
  Effect.gen(function* () {
    const github = yield* GitHub;
    return yield* github.getRepository(accessToken, owner, repo);
  });

export const getGitHubPullRequest = (
  accessToken: string,
  owner: string,
  repo: string,
  prNumber: number,
): Effect.Effect<GitHubPullRequest, HttpError, GitHub> =>
  Effect.gen(function* () {
    const github = yield* GitHub;
    return yield* github.getPullRequest(accessToken, owner, repo, prNumber);
  });

export const getGitHubIssue = (
  accessToken: string,
  owner: string,
  repo: string,
  issueNumber: number,
): Effect.Effect<GitHubIssue, HttpError, GitHub> =>
  Effect.gen(function* () {
    const github = yield* GitHub;
    return yield* github.getIssue(accessToken, owner, repo, issueNumber);
  });

export const getGitHubCommit = (
  accessToken: string,
  owner: string,
  repo: string,
  sha: string,
): Effect.Effect<GitHubCommit, HttpError, GitHub> =>
  Effect.gen(function* () {
    const github = yield* GitHub;
    return yield* github.getCommit(accessToken, owner, repo, sha);
  });
