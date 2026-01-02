/**
 * GitHub Integration Service using Effect-TS
 *
 * Provides type-safe GitHub API operations for repository access,
 * pull requests, issues, commits, and file information.
 */

import { Config, Context, Effect, Layer, Option } from "effect";
import { HttpError } from "../errors";

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
}

export interface GitHubRepository {
  readonly id: number;
  readonly name: string;
  readonly full_name: string;
  readonly private: boolean;
  readonly default_branch: string;
  readonly updated_at: string;
  readonly description: string | null;
  readonly html_url: string;
  readonly owner: {
    readonly login: string;
    readonly avatar_url: string;
  };
}

export interface GitHubPullRequest {
  readonly id: number;
  readonly number: number;
  readonly title: string;
  readonly state: "open" | "closed";
  readonly merged: boolean;
  readonly html_url: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly merged_at: string | null;
  readonly user: {
    readonly login: string;
    readonly avatar_url: string;
  };
  readonly body: string | null;
  readonly base: {
    readonly ref: string;
    readonly sha: string;
  };
  readonly head: {
    readonly ref: string;
    readonly sha: string;
  };
}

export interface GitHubIssue {
  readonly id: number;
  readonly number: number;
  readonly title: string;
  readonly state: "open" | "closed";
  readonly html_url: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly closed_at: string | null;
  readonly user: {
    readonly login: string;
    readonly avatar_url: string;
  };
  readonly body: string | null;
  readonly labels: Array<{
    readonly name: string;
    readonly color: string;
  }>;
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
  readonly type: "file" | "dir";
  readonly html_url: string;
  readonly download_url: string | null;
}

export interface GitHubFileContent {
  readonly name: string;
  readonly path: string;
  readonly sha: string;
  readonly size: number;
  readonly encoding: string;
  readonly content: string;
  readonly html_url: string;
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
   * Get the OAuth authorization URL with extended scopes for repository access
   */
  readonly getAuthorizationUrl: (state: string, scopes?: string[]) => Effect.Effect<string, never>;

  /**
   * Exchange authorization code for access token
   */
  readonly exchangeCodeForToken: (code: string) => Effect.Effect<GitHubTokenResponse, HttpError>;

  /**
   * Refresh an access token (if refresh token is available)
   */
  readonly refreshAccessToken: (refreshToken: string) => Effect.Effect<GitHubTokenResponse, HttpError>;

  /**
   * Get the authenticated user's info
   */
  readonly getUserInfo: (accessToken: string) => Effect.Effect<GitHubUserInfo, HttpError>;

  /**
   * List repositories accessible to the authenticated user
   */
  readonly listRepositories: (
    accessToken: string,
    options?: {
      type?: "all" | "owner" | "public" | "private" | "member";
      sort?: "created" | "updated" | "pushed" | "full_name";
      per_page?: number;
      page?: number;
    },
  ) => Effect.Effect<GitHubRepository[], HttpError>;

  /**
   * Get a specific repository
   */
  readonly getRepository: (accessToken: string, owner: string, repo: string) => Effect.Effect<GitHubRepository, HttpError>;

  /**
   * Get a pull request
   */
  readonly getPullRequest: (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
  ) => Effect.Effect<GitHubPullRequest, HttpError>;

  /**
   * List pull requests for a repository
   */
  readonly listPullRequests: (
    accessToken: string,
    owner: string,
    repo: string,
    options?: {
      state?: "open" | "closed" | "all";
      per_page?: number;
      page?: number;
    },
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
    options?: {
      state?: "open" | "closed" | "all";
      per_page?: number;
      page?: number;
    },
  ) => Effect.Effect<GitHubIssue[], HttpError>;

  /**
   * Get a specific commit
   */
  readonly getCommit: (
    accessToken: string,
    owner: string,
    repo: string,
    commitSha: string,
  ) => Effect.Effect<GitHubCommit, HttpError>;

  /**
   * Get file or directory contents
   */
  readonly getContents: (
    accessToken: string,
    owner: string,
    repo: string,
    path: string,
    ref?: string,
  ) => Effect.Effect<GitHubFile | GitHubFile[] | GitHubFileContent, HttpError>;

  /**
   * Post a comment on a PR (for GitHub App integration)
   */
  readonly postPRComment: (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    body: string,
  ) => Effect.Effect<void, HttpError>;
}

// =============================================================================
// GitHub Service Tag
// =============================================================================

export class GitHub extends Context.Tag("GitHub")<GitHub, GitHubServiceInterface>() {}

// =============================================================================
// GitHub Configuration
// =============================================================================

const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_AUTH_BASE = "https://github.com";

// Default scopes for repository context integration
const DEFAULT_SCOPES = ["read:user", "repo", "read:org"];

const GitHubConfigEffect = Config.all({
  clientId: Config.string("GITHUB_CLIENT_ID").pipe(Config.option),
  clientSecret: Config.string("GITHUB_CLIENT_SECRET").pipe(Config.option),
  baseUrl: Config.string("NEXT_PUBLIC_URL").pipe(Config.option),
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

  const getAuthorizationUrl = (state: string, scopes: string[] = DEFAULT_SCOPES): Effect.Effect<string, never> =>
    Effect.sync(() => {
      const cfg = getConfig();
      if (!cfg) {
        throw new Error("GitHub is not configured");
      }

      const params = new URLSearchParams({
        client_id: cfg.clientId,
        redirect_uri: cfg.redirectUri,
        scope: scopes.join(" "),
        state,
      });

      return `${GITHUB_AUTH_BASE}/login/oauth/authorize?${params.toString()}`;
    });

  const exchangeCodeForToken = (code: string): Effect.Effect<GitHubTokenResponse, HttpError> =>
    Effect.gen(function* () {
      const cfg = getConfig();
      if (!cfg) {
        return yield* Effect.fail(
          new HttpError({
            message: "GitHub is not configured",
            status: 503,
          }),
        );
      }

      const response = yield* Effect.tryPromise({
        try: async () => {
          const res = await fetch(`${GITHUB_AUTH_BASE}/login/oauth/access_token`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
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

          const data = (await res.json()) as GitHubTokenResponse | { error: string; error_description: string };

          if ("error" in data) {
            throw new Error(`GitHub token exchange failed: ${data.error_description}`);
          }

          return data;
        },
        catch: (error) =>
          new HttpError({
            message: `Failed to exchange code for token: ${error instanceof Error ? error.message : "Unknown error"}`,
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
            message: "GitHub is not configured",
            status: 503,
          }),
        );
      }

      const response = yield* Effect.tryPromise({
        try: async () => {
          const res = await fetch(`${GITHUB_AUTH_BASE}/login/oauth/access_token`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              client_id: cfg.clientId,
              client_secret: cfg.clientSecret,
              grant_type: "refresh_token",
              refresh_token: refreshToken,
            }),
          });

          if (!res.ok) {
            const error = await res.text();
            throw new Error(`GitHub token refresh failed: ${res.status} - ${error}`);
          }

          const data = (await res.json()) as GitHubTokenResponse | { error: string; error_description: string };

          if ("error" in data) {
            throw new Error(`GitHub token refresh failed: ${data.error_description}`);
          }

          return data;
        },
        catch: (error) =>
          new HttpError({
            message: `Failed to refresh access token: ${error instanceof Error ? error.message : "Unknown error"}`,
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
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
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
          message: `Failed to get user info: ${error instanceof Error ? error.message : "Unknown error"}`,
          status: 500,
        }),
    });

  const listRepositories = (
    accessToken: string,
    options: {
      type?: "all" | "owner" | "public" | "private" | "member";
      sort?: "created" | "updated" | "pushed" | "full_name";
      per_page?: number;
      page?: number;
    } = {},
  ): Effect.Effect<GitHubRepository[], HttpError> =>
    Effect.tryPromise({
      try: async () => {
        const params = new URLSearchParams({
          type: options.type || "all",
          sort: options.sort || "updated",
          per_page: (options.per_page || 100).toString(),
          page: (options.page || 1).toString(),
        });

        const res = await fetch(`${GITHUB_API_BASE}/user/repos?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        });

        if (!res.ok) {
          const error = await res.text();
          throw new Error(`GitHub API error: ${res.status} - ${error}`);
        }

        return res.json() as Promise<GitHubRepository[]>;
      },
      catch: (error) =>
        new HttpError({
          message: `Failed to list repositories: ${error instanceof Error ? error.message : "Unknown error"}`,
          status: 500,
        }),
    });

  const getRepository = (accessToken: string, owner: string, repo: string): Effect.Effect<GitHubRepository, HttpError> =>
    Effect.tryPromise({
      try: async () => {
        const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
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
          message: `Failed to get repository: ${error instanceof Error ? error.message : "Unknown error"}`,
          status: 500,
        }),
    });

  const getPullRequest = (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
  ): Effect.Effect<GitHubPullRequest, HttpError> =>
    Effect.tryPromise({
      try: async () => {
        const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${pullNumber}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
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
          message: `Failed to get pull request: ${error instanceof Error ? error.message : "Unknown error"}`,
          status: 500,
        }),
    });

  const listPullRequests = (
    accessToken: string,
    owner: string,
    repo: string,
    options: {
      state?: "open" | "closed" | "all";
      per_page?: number;
      page?: number;
    } = {},
  ): Effect.Effect<GitHubPullRequest[], HttpError> =>
    Effect.tryPromise({
      try: async () => {
        const params = new URLSearchParams({
          state: options.state || "all",
          per_page: (options.per_page || 30).toString(),
          page: (options.page || 1).toString(),
        });

        const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
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
          message: `Failed to list pull requests: ${error instanceof Error ? error.message : "Unknown error"}`,
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
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
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
          message: `Failed to get issue: ${error instanceof Error ? error.message : "Unknown error"}`,
          status: 500,
        }),
    });

  const listIssues = (
    accessToken: string,
    owner: string,
    repo: string,
    options: {
      state?: "open" | "closed" | "all";
      per_page?: number;
      page?: number;
    } = {},
  ): Effect.Effect<GitHubIssue[], HttpError> =>
    Effect.tryPromise({
      try: async () => {
        const params = new URLSearchParams({
          state: options.state || "all",
          per_page: (options.per_page || 30).toString(),
          page: (options.page || 1).toString(),
        });

        const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/issues?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
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
          message: `Failed to list issues: ${error instanceof Error ? error.message : "Unknown error"}`,
          status: 500,
        }),
    });

  const getCommit = (
    accessToken: string,
    owner: string,
    repo: string,
    commitSha: string,
  ): Effect.Effect<GitHubCommit, HttpError> =>
    Effect.tryPromise({
      try: async () => {
        const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/commits/${commitSha}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
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
          message: `Failed to get commit: ${error instanceof Error ? error.message : "Unknown error"}`,
          status: 500,
        }),
    });

  const getContents = (
    accessToken: string,
    owner: string,
    repo: string,
    path: string,
    ref?: string,
  ): Effect.Effect<GitHubFile | GitHubFile[] | GitHubFileContent, HttpError> =>
    Effect.tryPromise({
      try: async () => {
        const params = ref ? `?ref=${encodeURIComponent(ref)}` : "";
        const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}${params}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        });

        if (!res.ok) {
          const error = await res.text();
          throw new Error(`GitHub API error: ${res.status} - ${error}`);
        }

        return res.json() as Promise<GitHubFile | GitHubFile[] | GitHubFileContent>;
      },
      catch: (error) =>
        new HttpError({
          message: `Failed to get contents: ${error instanceof Error ? error.message : "Unknown error"}`,
          status: 500,
        }),
    });

  const postPRComment = (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    body: string,
  ): Effect.Effect<void, HttpError> =>
    Effect.tryPromise({
      try: async () => {
        const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${pullNumber}/comments`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ body }),
        });

        if (!res.ok) {
          const error = await res.text();
          throw new Error(`GitHub API error: ${res.status} - ${error}`);
        }
      },
      catch: (error) =>
        new HttpError({
          message: `Failed to post PR comment: ${error instanceof Error ? error.message : "Unknown error"}`,
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
    getContents,
    postPRComment,
  } satisfies GitHubServiceInterface;
});

// =============================================================================
// GitHub Layer
// =============================================================================

export const GitHubLive = Layer.effect(GitHub, makeGitHubService);

// =============================================================================
// GitHub Helper Functions
// =============================================================================

export const getGitHubContextAuthorizationUrl = (
  state: string,
  scopes?: string[],
): Effect.Effect<string, never, GitHub> =>
  Effect.gen(function* () {
    const github = yield* GitHub;
    return yield* github.getAuthorizationUrl(state, scopes);
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
  options?: {
    type?: "all" | "owner" | "public" | "private" | "member";
    sort?: "created" | "updated" | "pushed" | "full_name";
    per_page?: number;
    page?: number;
  },
): Effect.Effect<GitHubRepository[], HttpError, GitHub> =>
  Effect.gen(function* () {
    const github = yield* GitHub;
    return yield* github.listRepositories(accessToken, options);
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
  pullNumber: number,
): Effect.Effect<GitHubPullRequest, HttpError, GitHub> =>
  Effect.gen(function* () {
    const github = yield* GitHub;
    return yield* github.getPullRequest(accessToken, owner, repo, pullNumber);
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
  commitSha: string,
): Effect.Effect<GitHubCommit, HttpError, GitHub> =>
  Effect.gen(function* () {
    const github = yield* GitHub;
    return yield* github.getCommit(accessToken, owner, repo, commitSha);
  });
