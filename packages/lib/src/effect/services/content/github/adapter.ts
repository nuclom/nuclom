/**
 * GitHub Content Adapter
 *
 * Adapter that ingests GitHub PRs, issues, discussions, and commits as content items.
 * Implements the ContentSourceAdapter interface with GitHub-specific features:
 * - OAuth or GitHub App authentication
 * - PR/Issue/Discussion sync with incremental updates
 * - Code context extraction from diffs
 * - Issue/PR linking
 * - Real-time webhook support
 */

import { and, eq, lte } from 'drizzle-orm';
import { Context, Effect, Layer } from 'effect';
import type { ContentSource } from '../../../../db/schema';
import {
  type GitHubContentConfig,
  type GitHubRepoSyncRecord,
  type GitHubUser,
  githubFileCache,
  githubRepoSync,
  githubUsers,
  type NewGitHubRepoSyncRecord,
  type NewGitHubUser,
} from '../../../../db/schema';
import { ContentSourceAuthError, ContentSourceSyncError, DatabaseError } from '../../../errors';
import { Database } from '../../database';
import { GitHubClient } from '../../github-client';
import type { ContentSourceAdapter, RawContentItem } from '../types';
import { githubFetch as githubFetchApi, githubGraphQL as githubGraphQLApi } from './api-client';
import {
  detectLanguage,
  discussionToRawContentItem,
  issueToRawContentItem,
  prToRawContentItem,
  wikiToRawContentItem,
} from './content-converters';
import type {
  GitHubComment,
  GitHubContributor,
  GitHubDiscussion,
  GitHubFile,
  GitHubFileContent,
  GitHubIssue,
  GitHubPR,
  GitHubRepo,
  GitHubReview,
  GitHubWikiContent,
  GitHubWikiPage,
} from './types';

// =============================================================================
// Service Interface
// =============================================================================

export interface GitHubContentAdapterService extends ContentSourceAdapter {
  /**
   * List accessible repositories
   */
  listRepositories(source: ContentSource): Effect.Effect<GitHubRepo[], ContentSourceSyncError>;

  /**
   * Get repository sync state
   */
  getRepoSyncState(sourceId: string, repoFullName: string): Effect.Effect<GitHubRepoSyncRecord | null, DatabaseError>;

  /**
   * Update repository sync state
   */
  updateRepoSyncState(
    sourceId: string,
    repoFullName: string,
    update: Partial<NewGitHubRepoSyncRecord>,
  ): Effect.Effect<GitHubRepoSyncRecord, DatabaseError>;

  /**
   * Sync PRs from a repository
   */
  syncPRs(source: ContentSource, repo: string, since?: Date): Effect.Effect<RawContentItem[], ContentSourceSyncError>;

  /**
   * Sync issues from a repository
   */
  syncIssues(
    source: ContentSource,
    repo: string,
    since?: Date,
  ): Effect.Effect<RawContentItem[], ContentSourceSyncError>;

  /**
   * Sync discussions from a repository (GraphQL)
   */
  syncDiscussions(
    source: ContentSource,
    repo: string,
    since?: Date,
  ): Effect.Effect<RawContentItem[], ContentSourceSyncError>;

  /**
   * Sync users from repositories
   */
  syncUsers(source: ContentSource): Effect.Effect<GitHubUser[], ContentSourceSyncError>;

  /**
   * Get file content (for code context)
   */
  getFileContent(
    source: ContentSource,
    repo: string,
    path: string,
    ref?: string,
  ): Effect.Effect<string | null, ContentSourceSyncError>;

  /**
   * Handle a GitHub webhook event
   */
  handleWebhook(
    source: ContentSource,
    event: string,
    payload: unknown,
  ): Effect.Effect<RawContentItem | null, ContentSourceSyncError>;

  /**
   * Sync wiki pages from a repository
   */
  syncWiki(source: ContentSource, repo: string): Effect.Effect<RawContentItem[], ContentSourceSyncError>;
}

export class GitHubContentAdapter extends Context.Tag('GitHubContentAdapter')<
  GitHubContentAdapter,
  GitHubContentAdapterService
>() {}

// =============================================================================
// Service Implementation
// =============================================================================

const makeGitHubContentAdapter = Effect.gen(function* () {
  const { db } = yield* Database;
  const gitHubClient = yield* GitHubClient;
  const githubFetch = <T>(endpoint: string, accessToken: string, options?: { method?: string; body?: unknown }) =>
    githubFetchApi<T>(endpoint, accessToken, options).pipe(Effect.provideService(GitHubClient, gitHubClient));
  const githubGraphQL = <T>(accessToken: string, query: string, variables?: Record<string, unknown>) =>
    githubGraphQLApi<T>(accessToken, query, variables).pipe(Effect.provideService(GitHubClient, gitHubClient));

  const getAccessToken = (source: ContentSource): string => {
    const credentials = source.credentials;
    if (!credentials?.accessToken) {
      throw new Error('No access token found for GitHub source');
    }
    return credentials.accessToken;
  };

  const service: GitHubContentAdapterService = {
    sourceType: 'github',

    validateCredentials: (source) =>
      Effect.gen(function* () {
        const accessToken = getAccessToken(source);
        yield* githubFetch<{ login: string }>('/user', accessToken);
        return true;
      }).pipe(Effect.catchAll(() => Effect.succeed(false))),

    fetchContent: (source, options) =>
      Effect.gen(function* () {
        const config = source.config as GitHubContentConfig | undefined;
        const repositories = config?.repositories || [];
        const items: RawContentItem[] = [];

        for (const repo of repositories) {
          // Sync PRs
          if (config?.syncPRs !== false) {
            const prs = yield* service.syncPRs(source, repo, options?.since);
            items.push(...prs);
          }

          // Sync Issues
          if (config?.syncIssues !== false) {
            const issues = yield* service.syncIssues(source, repo, options?.since);
            items.push(...issues);
          }

          // Sync Discussions
          if (config?.syncDiscussions !== false) {
            const discussions = yield* service.syncDiscussions(source, repo, options?.since);
            items.push(...discussions);
          }

          // Sync Wiki pages
          if (config?.syncWiki === true) {
            const wikiPages = yield* service.syncWiki(source, repo);
            items.push(...wikiPages);
          }
        }

        return {
          items,
          hasMore: false, // We fetch all at once, pagination handled per-repo
          nextCursor: undefined,
        };
      }),

    fetchItem: (source, externalId) =>
      Effect.gen(function* () {
        const accessToken = getAccessToken(source);

        // Parse external ID format: owner/repo#number or node_id
        const prMatch = externalId.match(/^([^#]+)#(\d+)$/);
        if (prMatch) {
          const [, repo, number] = prMatch;
          const pr = yield* githubFetch<GitHubPR>(`/repos/${repo}/pulls/${number}`, accessToken).pipe(
            Effect.catchAll(() => Effect.succeed(null)),
          );
          if (!pr) return null;

          const reviews = yield* githubFetch<GitHubReview[]>(
            `/repos/${repo}/pulls/${number}/reviews`,
            accessToken,
          ).pipe(Effect.catchAll(() => Effect.succeed([] as GitHubReview[])));

          const reviewComments = yield* githubFetch<GitHubComment[]>(
            `/repos/${repo}/pulls/${number}/comments`,
            accessToken,
          ).pipe(Effect.catchAll(() => Effect.succeed([] as GitHubComment[])));

          const files = yield* githubFetch<GitHubFile[]>(`/repos/${repo}/pulls/${number}/files`, accessToken).pipe(
            Effect.catchAll(() => Effect.succeed([] as GitHubFile[])),
          );

          return prToRawContentItem(pr, reviews, reviewComments, files);
        }

        // Try as issue node_id
        // For now, return null for non-PR lookups
        return null;
      }).pipe(
        Effect.mapError((e: unknown) => {
          const message = e instanceof Error ? e.message : 'Unknown error';
          return new ContentSourceSyncError({
            message,
            sourceId: source.id,
            sourceType: 'github',
            cause: e,
          });
        }),
      ),

    refreshAuth: (source) =>
      Effect.gen(function* () {
        // GitHub OAuth tokens don't expire by default
        // For GitHub Apps with installation tokens, we'd need to refresh
        const credentials = source.credentials;
        if (!credentials?.accessToken) {
          return yield* Effect.fail(
            new ContentSourceAuthError({
              message: 'No access token found',
              sourceId: source.id,
              sourceType: 'github',
            }),
          );
        }
        return {
          accessToken: credentials.accessToken,
          refreshToken: credentials.refreshToken,
          expiresAt: credentials.expiresAt,
        };
      }),

    // GitHub-specific methods
    listRepositories: (source) =>
      Effect.gen(function* () {
        const accessToken = getAccessToken(source);
        const repos: GitHubRepo[] = [];
        let page = 1;

        do {
          const response = yield* githubFetch<GitHubRepo[]>(
            `/user/repos?per_page=100&page=${page}&sort=updated`,
            accessToken,
          ).pipe(
            Effect.mapError(
              (e) =>
                new ContentSourceSyncError({
                  message: `Failed to list repositories: ${e instanceof Error ? e.message : 'Unknown'}`,
                  sourceId: source.id,
                  sourceType: 'github',
                  cause: e,
                }),
            ),
          );

          repos.push(...response);
          if (response.length < 100) break;
          page++;
        } while (page < 10); // Limit to 1000 repos

        return repos;
      }),

    getRepoSyncState: (sourceId, repoFullName) =>
      Effect.tryPromise({
        try: async () => {
          const record = await db.query.githubRepoSync.findFirst({
            where: and(eq(githubRepoSync.sourceId, sourceId), eq(githubRepoSync.repoFullName, repoFullName)),
          });
          return record || null;
        },
        catch: (e) =>
          new DatabaseError({
            message: `Failed to get repo sync state: ${e instanceof Error ? e.message : 'Unknown'}`,
            cause: e,
          }),
      }),

    updateRepoSyncState: (sourceId, repoFullName, update) =>
      Effect.tryPromise({
        try: async () => {
          const existing = await db.query.githubRepoSync.findFirst({
            where: and(eq(githubRepoSync.sourceId, sourceId), eq(githubRepoSync.repoFullName, repoFullName)),
          });

          if (existing) {
            const [updated] = await db
              .update(githubRepoSync)
              .set({ ...update, updatedAt: new Date() })
              .where(eq(githubRepoSync.id, existing.id))
              .returning();
            return updated;
          } else {
            const [inserted] = await db
              .insert(githubRepoSync)
              .values({
                sourceId,
                repoFullName,
                repoId: update.repoId || 0,
                ...update,
              })
              .returning();
            return inserted;
          }
        },
        catch: (e) =>
          new DatabaseError({
            message: `Failed to update repo sync state: ${e instanceof Error ? e.message : 'Unknown'}`,
            cause: e,
          }),
      }),

    syncPRs: (source, repo, since) =>
      Effect.gen(function* () {
        const accessToken = getAccessToken(source);
        const config = source.config as GitHubContentConfig | undefined;
        const items: RawContentItem[] = [];
        let page = 1;

        do {
          const params = new URLSearchParams({
            state: 'all',
            sort: 'updated',
            direction: 'desc',
            per_page: '50',
            page: String(page),
          });

          const prs = yield* githubFetch<GitHubPR[]>(`/repos/${repo}/pulls?${params}`, accessToken).pipe(
            Effect.mapError(
              (e) =>
                new ContentSourceSyncError({
                  message: `Failed to fetch PRs: ${e instanceof Error ? e.message : 'Unknown'}`,
                  sourceId: source.id,
                  sourceType: 'github',
                  cause: e,
                }),
            ),
          );

          for (const pr of prs) {
            // Check if we've gone past our sync window
            if (since && new Date(pr.updated_at) < since) {
              return items;
            }

            // Apply label filters
            if (config?.labelFilters?.length) {
              const prLabels = pr.labels.map((l) => l.name);
              if (!config.labelFilters.some((f) => prLabels.includes(f))) {
                continue;
              }
            }

            // Apply exclude labels
            if (config?.excludeLabels?.length) {
              const prLabels = pr.labels.map((l) => l.name);
              if (config.excludeLabels.some((f) => prLabels.includes(f))) {
                continue;
              }
            }

            // Fetch additional PR data
            const reviews = yield* githubFetch<GitHubReview[]>(
              `/repos/${repo}/pulls/${pr.number}/reviews`,
              accessToken,
            ).pipe(Effect.catchAll(() => Effect.succeed([] as GitHubReview[])));

            const reviewComments = yield* githubFetch<GitHubComment[]>(
              `/repos/${repo}/pulls/${pr.number}/comments`,
              accessToken,
            ).pipe(Effect.catchAll(() => Effect.succeed([] as GitHubComment[])));

            const files = yield* githubFetch<GitHubFile[]>(`/repos/${repo}/pulls/${pr.number}/files`, accessToken).pipe(
              Effect.catchAll(() => Effect.succeed([] as GitHubFile[])),
            );

            items.push(prToRawContentItem(pr, reviews, reviewComments, files));
          }

          if (prs.length < 50) break;
          page++;
        } while (page < 20); // Limit to 1000 PRs

        return items;
      }),

    syncIssues: (source, repo, since) =>
      Effect.gen(function* () {
        const accessToken = getAccessToken(source);
        const config = source.config as GitHubContentConfig | undefined;
        const items: RawContentItem[] = [];
        let page = 1;

        do {
          const params = new URLSearchParams({
            state: 'all',
            sort: 'updated',
            direction: 'desc',
            per_page: '50',
            page: String(page),
          });

          if (since) {
            params.set('since', since.toISOString());
          }

          const issues = yield* githubFetch<GitHubIssue[]>(`/repos/${repo}/issues?${params}`, accessToken).pipe(
            Effect.mapError(
              (e) =>
                new ContentSourceSyncError({
                  message: `Failed to fetch issues: ${e instanceof Error ? e.message : 'Unknown'}`,
                  sourceId: source.id,
                  sourceType: 'github',
                  cause: e,
                }),
            ),
          );

          for (const issue of issues) {
            // Skip PRs (they show up in issues endpoint)
            if (issue.pull_request) continue;

            // Apply label filters
            if (config?.labelFilters?.length) {
              const issueLabels = issue.labels
                .map((label) => (typeof label === 'string' ? label : label.name))
                .filter((label): label is string => Boolean(label));
              if (!config.labelFilters.some((f) => issueLabels.includes(f))) {
                continue;
              }
            }

            // Fetch comments
            const comments = yield* githubFetch<GitHubComment[]>(
              `/repos/${repo}/issues/${issue.number}/comments`,
              accessToken,
            ).pipe(Effect.catchAll(() => Effect.succeed([] as GitHubComment[])));

            items.push(issueToRawContentItem(issue, comments));
          }

          if (issues.length < 50) break;
          page++;
        } while (page < 20);

        return items;
      }),

    syncDiscussions: (source, repo, since) =>
      Effect.gen(function* () {
        const accessToken = getAccessToken(source);
        const [owner, name] = repo.split('/');
        const items: RawContentItem[] = [];

        const query = `
          query($owner: String!, $name: String!, $cursor: String) {
            repository(owner: $owner, name: $name) {
              discussions(first: 50, after: $cursor, orderBy: {field: UPDATED_AT, direction: DESC}) {
                pageInfo {
                  hasNextPage
                  endCursor
                }
                nodes {
                  id
                  number
                  title
                  body
                  author { login }
                  category { name }
                  answer { id author { login } }
                  comments { totalCount }
                  upvoteCount
                  labels(first: 10) { nodes { name } }
                  url
                  createdAt
                  updatedAt
                }
              }
            }
          }
        `;

        let cursor: string | null = null;
        let page = 0;

        do {
          const result: {
            repository: {
              discussions: {
                pageInfo: { hasNextPage: boolean; endCursor: string };
                nodes: GitHubDiscussion[];
              };
            };
          } = yield* githubGraphQL<{
            repository: {
              discussions: {
                pageInfo: { hasNextPage: boolean; endCursor: string };
                nodes: GitHubDiscussion[];
              };
            };
          }>(accessToken, query, { owner, name, cursor }).pipe(
            Effect.mapError(
              (e) =>
                new ContentSourceSyncError({
                  message: `Failed to fetch discussions: ${e instanceof Error ? e.message : 'Unknown'}`,
                  sourceId: source.id,
                  sourceType: 'github',
                  cause: e,
                }),
            ),
          );

          const discussions: { pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: GitHubDiscussion[] } =
            result.repository.discussions;

          for (const discussion of discussions.nodes) {
            // Check sync window
            if (since && new Date(discussion.updatedAt) < since) {
              return items;
            }

            items.push(discussionToRawContentItem(discussion, repo));
          }

          cursor = discussions.pageInfo.hasNextPage ? discussions.pageInfo.endCursor : null;
          page++;
        } while (cursor && page < 10);

        return items;
      }),

    syncUsers: (source) =>
      Effect.gen(function* () {
        const config = source.config as GitHubContentConfig | undefined;
        const accessToken = getAccessToken(source);
        const savedUsers: GitHubUser[] = [];

        // Get unique users from repos
        for (const repo of config?.repositories || []) {
          // Fetch contributors
          const contributors = yield* githubFetch<GitHubContributor[]>(
            `/repos/${repo}/contributors?per_page=100`,
            accessToken,
          ).pipe(Effect.catchAll(() => Effect.succeed([] as GitHubContributor[])));

          for (const contributor of contributors) {
            if (contributor.id == null || !contributor.login) {
              continue;
            }
            const contributorId = contributor.id;
            const userData: NewGitHubUser = {
              sourceId: source.id,
              githubUserId: contributorId,
              githubLogin: contributor.login,
              avatarUrl: contributor.avatar_url,
              type: contributor.type,
            };

            yield* Effect.tryPromise({
              try: async () => {
                const existing = await db.query.githubUsers.findFirst({
                  where: and(eq(githubUsers.sourceId, source.id), eq(githubUsers.githubUserId, contributorId)),
                });

                if (existing) {
                  await db.update(githubUsers).set(userData).where(eq(githubUsers.id, existing.id));
                } else {
                  await db.insert(githubUsers).values(userData);
                }
              },
              catch: (e) => new Error(String(e)),
            }).pipe(Effect.catchAll(() => Effect.void));
          }
        }

        return savedUsers;
      }),

    getFileContent: (source, repo, path, ref) =>
      Effect.gen(function* () {
        const accessToken = getAccessToken(source);

        // Check cache first
        const cached = yield* Effect.tryPromise({
          try: async () => {
            const record = await db.query.githubFileCache.findFirst({
              where: and(
                eq(githubFileCache.sourceId, source.id),
                eq(githubFileCache.repoFullName, repo),
                eq(githubFileCache.path, path),
                eq(githubFileCache.ref, ref || 'HEAD'),
              ),
            });
            if (record && record.expiresAt > new Date()) {
              return record.content;
            }
            return null;
          },
          catch: () => null,
        });

        if (cached) return cached;

        // Fetch from GitHub
        try {
          const response = yield* githubFetch<GitHubFileContent>(
            `/repos/${repo}/contents/${path}${ref ? `?ref=${ref}` : ''}`,
            accessToken,
          ).pipe(Effect.catchAll(() => Effect.succeed(null)));

          if (!response || Array.isArray(response) || !('content' in response)) return null;

          const rawContent = response.content ?? '';
          const content =
            response.encoding === 'base64' ? Buffer.from(rawContent, 'base64').toString('utf-8') : rawContent;

          // Cache the content
          yield* Effect.tryPromise({
            try: async () => {
              await db.insert(githubFileCache).values({
                sourceId: source.id,
                repoFullName: repo,
                path,
                ref: ref || 'HEAD',
                content,
                language: detectLanguage(path),
                size: typeof response.size === 'number' ? response.size : 0,
                sha: response.sha ?? '',
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
              });
            },
            catch: () => null,
          });

          return content;
        } catch {
          return null;
        }
      }).pipe(
        Effect.mapError(
          (e: unknown) =>
            new ContentSourceSyncError({
              message: e instanceof Error ? e.message : 'Unknown error',
              sourceId: source.id,
              sourceType: 'github',
              cause: e,
            }),
        ),
      ),

    handleWebhook: (source, event, payload) =>
      Effect.gen(function* () {
        const isRecord = (value: unknown): value is Record<string, unknown> =>
          typeof value === 'object' && value !== null;

        // PR guard: PRs have head/base refs for branches, title, and state
        const isGitHubPR = (value: unknown): value is GitHubPR =>
          isRecord(value) &&
          typeof value.number === 'number' &&
          typeof value.title === 'string' &&
          isRecord(value.head) &&
          typeof (value.head as Record<string, unknown>).ref === 'string';

        // Issue guard: Issues have number, title, state, and assignees array
        const isGitHubIssue = (value: unknown): value is GitHubIssue =>
          isRecord(value) &&
          typeof value.number === 'number' &&
          typeof value.title === 'string' &&
          typeof value.state === 'string' &&
          Array.isArray(value.assignees);

        if (!isRecord(payload)) return null;

        const action = typeof payload.action === 'string' ? payload.action : null;
        const repo =
          isRecord(payload.repository) && typeof payload.repository.full_name === 'string'
            ? payload.repository.full_name
            : null;

        switch (event) {
          case 'pull_request': {
            if (!action || !['opened', 'edited', 'closed', 'reopened', 'synchronize'].includes(action)) {
              return null;
            }
            const pr = isGitHubPR(payload.pull_request) ? payload.pull_request : null;
            if (!pr || !repo) return null;
            const accessToken = getAccessToken(source);

            const reviews = yield* githubFetch<GitHubReview[]>(
              `/repos/${repo}/pulls/${pr.number}/reviews`,
              accessToken,
            ).pipe(Effect.catchAll(() => Effect.succeed([])));

            const reviewComments = yield* githubFetch<GitHubComment[]>(
              `/repos/${repo}/pulls/${pr.number}/comments`,
              accessToken,
            ).pipe(Effect.catchAll(() => Effect.succeed([])));

            const files = yield* githubFetch<GitHubFile[]>(`/repos/${repo}/pulls/${pr.number}/files`, accessToken).pipe(
              Effect.catchAll(() => Effect.succeed([])),
            );

            return prToRawContentItem(pr, reviews, reviewComments, files);
          }

          case 'issues': {
            if (!action || !['opened', 'edited', 'closed', 'reopened'].includes(action)) {
              return null;
            }
            const issue = isGitHubIssue(payload.issue) ? payload.issue : null;
            if (!issue || issue.pull_request || !repo) return null;

            const accessToken = getAccessToken(source);
            const comments = yield* githubFetch<GitHubComment[]>(
              `/repos/${repo}/issues/${issue.number}/comments`,
              accessToken,
            ).pipe(Effect.catchAll(() => Effect.succeed([])));

            return issueToRawContentItem(issue, comments);
          }

          case 'issue_comment': {
            const issue = isGitHubIssue(payload.issue) ? payload.issue : null;
            if (!issue || issue.pull_request || !repo) return null;

            const accessToken = getAccessToken(source);
            const comments = yield* githubFetch<GitHubComment[]>(
              `/repos/${repo}/issues/${issue.number}/comments`,
              accessToken,
            ).pipe(Effect.catchAll(() => Effect.succeed([])));

            return issueToRawContentItem(issue, comments);
          }

          case 'pull_request_review':
          case 'pull_request_review_comment': {
            const pr = isGitHubPR(payload.pull_request) ? payload.pull_request : null;
            if (!pr || !repo) return null;
            const accessToken = getAccessToken(source);

            const reviews = yield* githubFetch<GitHubReview[]>(
              `/repos/${repo}/pulls/${pr.number}/reviews`,
              accessToken,
            ).pipe(Effect.catchAll(() => Effect.succeed([])));

            const reviewComments = yield* githubFetch<GitHubComment[]>(
              `/repos/${repo}/pulls/${pr.number}/comments`,
              accessToken,
            ).pipe(Effect.catchAll(() => Effect.succeed([])));

            const files = yield* githubFetch<GitHubFile[]>(`/repos/${repo}/pulls/${pr.number}/files`, accessToken).pipe(
              Effect.catchAll(() => Effect.succeed([])),
            );

            return prToRawContentItem(pr, reviews, reviewComments, files);
          }
        }

        return null;
      }).pipe(
        Effect.mapError((e: unknown) => {
          const message = e instanceof Error ? e.message : 'Unknown error';
          return new ContentSourceSyncError({
            message,
            sourceId: source.id,
            sourceType: 'github',
            cause: e,
          });
        }),
      ),

    syncWiki: (source, repo) =>
      Effect.gen(function* () {
        const accessToken = getAccessToken(source);
        const items: RawContentItem[] = [];
        const [owner, name] = repo.split('/');

        // First check if the repo has a wiki enabled
        const repoInfo = yield* githubFetch<GitHubRepo>(`/repos/${repo}`, accessToken).pipe(
          Effect.mapError(
            (e) =>
              new ContentSourceSyncError({
                message: `Failed to fetch repo info: ${e instanceof Error ? e.message : 'Unknown'}`,
                sourceId: source.id,
                sourceType: 'github',
                cause: e,
              }),
          ),
        );

        if (!repoInfo.has_wiki) {
          // Wiki not enabled for this repo
          return [];
        }

        // List wiki pages using the Contents API on the wiki repo
        // Wiki repos are accessible at {owner}/{repo}.wiki
        const wikiRepoPath = `${owner}/${name}.wiki`;

        // Try to list wiki contents (root level)
        const wikiPages = yield* githubFetch<GitHubWikiPage[]>(`/repos/${wikiRepoPath}/contents`, accessToken).pipe(
          Effect.mapError(
            (e) =>
              new ContentSourceSyncError({
                message: `Failed to list wiki pages: ${e instanceof Error ? e.message : 'Unknown'}`,
                sourceId: source.id,
                sourceType: 'github',
                cause: e,
              }),
          ),
          // Wiki might not exist even if has_wiki is true
          Effect.catchAll(() => Effect.succeed<GitHubWikiPage[] | null>(null)),
        );

        if (!wikiPages || !Array.isArray(wikiPages)) {
          // No wiki content or wiki doesn't exist
          return [];
        }

        // Filter to markdown files only
        const markdownPages = wikiPages.filter(
          (p) => p.type === 'file' && (p.name.endsWith('.md') || p.name.endsWith('.markdown')),
        );

        // Fetch each wiki page content
        for (const page of markdownPages) {
          const pageContent = yield* githubFetch<GitHubWikiContent>(
            `/repos/${wikiRepoPath}/contents/${page.path}`,
            accessToken,
          ).pipe(Effect.catchAll(() => Effect.succeed<GitHubWikiContent | null>(null)));

          if (pageContent) {
            // Construct the HTML URL for the wiki page
            const pageSlug = page.name.replace(/\.(md|markdown)$/i, '');
            const htmlUrl = `https://github.com/${repo}/wiki/${pageSlug}`;

            items.push(wikiToRawContentItem(pageContent, repo, htmlUrl));
          }
        }

        // Also check for wiki pages in subdirectories (limited to one level)
        const directories = wikiPages.filter((p) => p.type === 'dir');
        for (const dir of directories.slice(0, 10)) {
          // Limit to 10 directories
          const subPages = yield* githubFetch<GitHubWikiPage[]>(
            `/repos/${wikiRepoPath}/contents/${dir.path}`,
            accessToken,
          ).pipe(Effect.catchAll(() => Effect.succeed<GitHubWikiPage[]>([])));

          const subMarkdownPages = subPages.filter(
            (p) => p.type === 'file' && (p.name.endsWith('.md') || p.name.endsWith('.markdown')),
          );

          for (const page of subMarkdownPages.slice(0, 50)) {
            // Limit per directory
            const pageContent = yield* githubFetch<GitHubWikiContent>(
              `/repos/${wikiRepoPath}/contents/${page.path}`,
              accessToken,
            ).pipe(Effect.catchAll(() => Effect.succeed<GitHubWikiContent | null>(null)));

            if (pageContent) {
              const pageSlug = page.path.replace(/\.(md|markdown)$/i, '');
              const htmlUrl = `https://github.com/${repo}/wiki/${pageSlug}`;

              items.push(wikiToRawContentItem(pageContent, repo, htmlUrl));
            }
          }
        }

        return items;
      }),
  };

  return service;
});

// =============================================================================
// Layer
// =============================================================================

export const GitHubContentAdapterLive = Layer.effect(GitHubContentAdapter, makeGitHubContentAdapter);

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a GitHub content adapter instance
 */
export const createGitHubContentAdapter = () =>
  Effect.gen(function* () {
    const adapter = yield* GitHubContentAdapter;
    return adapter as ContentSourceAdapter;
  });

/**
 * Clean up expired file cache entries
 */
export const cleanupExpiredFileCache = () =>
  Effect.gen(function* () {
    const { db } = yield* Database;
    yield* Effect.tryPromise({
      try: () => db.delete(githubFileCache).where(lte(githubFileCache.expiresAt, new Date())),
      catch: () => null,
    });
  });
