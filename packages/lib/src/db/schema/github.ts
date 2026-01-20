/**
 * GitHub Integration Schema
 *
 * Tables for GitHub content source integration:
 * - githubRepoSync: Track repository sync state
 * - githubUsers: GitHub user mapping
 * - githubFileCache: Cache file contents for code context
 */

import { relations } from 'drizzle-orm';
import { bigint, boolean, index, integer, jsonb, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { contentSources } from './content';

// =============================================================================
// Types
// =============================================================================

/**
 * GitHub content configuration stored in content_sources.config
 */
export type GitHubContentConfig = {
  readonly repositories?: string[]; // owner/repo format
  readonly syncPRs?: boolean;
  readonly syncIssues?: boolean;
  readonly syncDiscussions?: boolean;
  readonly syncCommits?: boolean; // Only significant (tags, merges)
  readonly syncWiki?: boolean;
  readonly labelFilters?: string[]; // Only sync with these labels
  readonly excludeLabels?: string[]; // Skip items with these labels
  readonly lookbackDays?: number; // Initial sync period
};

/**
 * GitHub PR metadata stored in content_items.metadata
 */
export type GitHubPRMetadata = {
  readonly repo: string; // owner/repo
  readonly number: number;
  readonly node_id?: string;
  readonly state: 'open' | 'closed' | 'merged';
  readonly draft?: boolean;
  readonly base_branch?: string;
  readonly head_branch?: string;
  readonly base_sha?: string;
  readonly head_sha?: string;
  readonly merge_commit_sha?: string | null;
  readonly labels?: string[];
  readonly assignees?: string[];
  readonly reviewers?: string[];
  readonly review_state?: 'approved' | 'changes_requested' | 'pending' | null;
  readonly merged_by?: string | null;
  readonly merged_at?: string | null;
  readonly files_changed?: number;
  readonly additions?: number;
  readonly deletions?: number;
  readonly commits?: number;
  readonly comments?: number;
  readonly review_comments?: number;
  readonly linked_issues?: number[]; // Extracted from body/commits
  readonly url?: string;
  readonly html_url?: string;
};

/**
 * GitHub Issue metadata stored in content_items.metadata
 */
export type GitHubIssueMetadata = {
  readonly repo: string;
  readonly number: number;
  readonly node_id?: string;
  readonly state: 'open' | 'closed';
  readonly state_reason?: 'completed' | 'not_planned' | 'reopened' | null;
  readonly labels?: string[];
  readonly assignees?: string[];
  readonly milestone?: string | null;
  readonly linked_prs?: number[]; // PRs that reference this issue
  readonly is_pull_request?: boolean;
  readonly comment_count?: number;
  readonly reactions?: Array<{ name: string; count: number }>;
  readonly url?: string;
  readonly html_url?: string;
};

/**
 * GitHub Discussion metadata stored in content_items.metadata
 */
export type GitHubDiscussionMetadata = {
  readonly repo: string;
  readonly number: number;
  readonly node_id?: string;
  readonly category?: string;
  readonly is_answered?: boolean;
  readonly answer_id?: string | null;
  readonly answer_author?: string | null;
  readonly comment_count?: number;
  readonly upvote_count?: number;
  readonly labels?: string[];
  readonly url?: string;
};

/**
 * Code context extracted from PRs
 */
export type CodeContext = {
  readonly languages?: string[];
  readonly files?: string[];
  readonly directories?: string[];
  readonly components?: string[];
  readonly functions?: string[];
  readonly imports?: string[];
};

// =============================================================================
// GitHub Repository Sync
// =============================================================================

export const githubRepoSync = pgTable(
  'github_repo_sync',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sourceId: text('source_id')
      .notNull()
      .references(() => contentSources.id, { onDelete: 'cascade' }),
    repoFullName: text('repo_full_name').notNull(), // owner/repo
    repoId: bigint('repo_id', { mode: 'number' }).notNull(), // GitHub repo ID
    defaultBranch: text('default_branch').default('main'),
    isPrivate: boolean('is_private').default(false).notNull(),
    syncPRs: boolean('sync_prs').default(true).notNull(),
    syncIssues: boolean('sync_issues').default(true).notNull(),
    syncDiscussions: boolean('sync_discussions').default(true).notNull(),
    syncCommits: boolean('sync_commits').default(false).notNull(), // Only tags/releases
    labelFilters: jsonb('label_filters').$type<string[]>().default([]).notNull(), // Only sync with these labels
    excludeLabels: jsonb('exclude_labels').$type<string[]>().default([]).notNull(), // Exclude items with these labels
    lastPRCursor: text('last_pr_cursor'), // GraphQL cursor for pagination
    lastIssueCursor: text('last_issue_cursor'),
    lastDiscussionCursor: text('last_discussion_cursor'),
    lastCommitSha: text('last_commit_sha'),
    lastSyncAt: timestamp('last_sync_at'),
    prCount: integer('pr_count').default(0).notNull(),
    issueCount: integer('issue_count').default(0).notNull(),
    discussionCount: integer('discussion_count').default(0).notNull(),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    sourceIdx: index('github_repo_sync_source_idx').on(table.sourceId),
    repoFullNameIdx: index('github_repo_sync_repo_full_name_idx').on(table.repoFullName),
    uniqueSourceRepo: unique('github_repo_sync_source_repo_unique').on(table.sourceId, table.repoFullName),
  }),
);

// =============================================================================
// GitHub Users
// =============================================================================

export const githubUsers = pgTable(
  'github_users',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sourceId: text('source_id')
      .notNull()
      .references(() => contentSources.id, { onDelete: 'cascade' }),
    githubUserId: bigint('github_user_id', { mode: 'number' }).notNull(),
    githubLogin: text('github_login').notNull(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    name: text('name'),
    email: text('email'),
    avatarUrl: text('avatar_url'),
    type: text('type'), // 'User', 'Bot', 'Organization'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    sourceIdx: index('github_users_source_idx').on(table.sourceId),
    githubUserIdIdx: index('github_users_github_user_id_idx').on(table.githubUserId),
    githubLoginIdx: index('github_users_github_login_idx').on(table.githubLogin),
    uniqueSourceGithubUser: unique('github_users_source_github_user_unique').on(table.sourceId, table.githubUserId),
  }),
);

// =============================================================================
// GitHub File Cache
// =============================================================================

export const githubFileCache = pgTable(
  'github_file_cache',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sourceId: text('source_id')
      .notNull()
      .references(() => contentSources.id, { onDelete: 'cascade' }),
    repoFullName: text('repo_full_name').notNull(),
    path: text('path').notNull(),
    ref: text('ref').notNull(), // branch/tag/sha
    content: text('content'),
    language: text('language'),
    size: integer('size'),
    sha: text('sha'),
    fetchedAt: timestamp('fetched_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at').notNull(),
  },
  (table) => ({
    sourceIdx: index('github_file_cache_source_idx').on(table.sourceId),
    expiresIdx: index('github_file_cache_expires_idx').on(table.expiresAt),
    uniqueSourcePathRef: unique('github_file_cache_source_path_ref_unique').on(
      table.sourceId,
      table.repoFullName,
      table.path,
      table.ref,
    ),
  }),
);

// =============================================================================
// Type Exports
// =============================================================================

export type GitHubRepoSyncRecord = typeof githubRepoSync.$inferSelect;
export type NewGitHubRepoSyncRecord = typeof githubRepoSync.$inferInsert;

export type GitHubUser = typeof githubUsers.$inferSelect;
export type NewGitHubUser = typeof githubUsers.$inferInsert;

export type GitHubFileCacheRecord = typeof githubFileCache.$inferSelect;
export type NewGitHubFileCacheRecord = typeof githubFileCache.$inferInsert;

// =============================================================================
// Relations
// =============================================================================

export const githubRepoSyncRelations = relations(githubRepoSync, ({ one }) => ({
  source: one(contentSources, {
    fields: [githubRepoSync.sourceId],
    references: [contentSources.id],
  }),
}));

export const githubUsersRelations = relations(githubUsers, ({ one }) => ({
  source: one(contentSources, {
    fields: [githubUsers.sourceId],
    references: [contentSources.id],
  }),
  user: one(users, {
    fields: [githubUsers.userId],
    references: [users.id],
  }),
}));

export const githubFileCacheRelations = relations(githubFileCache, ({ one }) => ({
  source: one(contentSources, {
    fields: [githubFileCache.sourceId],
    references: [contentSources.id],
  }),
}));
