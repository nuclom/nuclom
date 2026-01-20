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
import type { ContentSource } from '../../../db/schema';
import {
  type CodeContext,
  type GitHubContentConfig,
  type GitHubDiscussionMetadata,
  type GitHubIssueMetadata,
  type GitHubPRMetadata,
  type GitHubRepoSyncRecord,
  type GitHubUser,
  githubFileCache,
  githubRepoSync,
  githubUsers,
  type NewGitHubRepoSyncRecord,
  type NewGitHubUser,
} from '../../../db/schema';
import { ContentSourceAuthError, ContentSourceSyncError, DatabaseError } from '../../errors';
import { Database } from '../database';
import type { ContentSourceAdapter, RawContentItem } from './types';

// =============================================================================
// GitHub API Types
// =============================================================================

interface GitHubPR {
  id: number;
  node_id: string;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  draft: boolean;
  merged: boolean;
  merged_at: string | null;
  merged_by: { login: string } | null;
  user: { id: number; login: string; avatar_url: string };
  base: { ref: string; sha: string; repo: { full_name: string } };
  head: { ref: string; sha: string };
  merge_commit_sha: string | null;
  labels: Array<{ name: string }>;
  assignees: Array<{ login: string }>;
  requested_reviewers: Array<{ login: string }>;
  changed_files: number;
  additions: number;
  deletions: number;
  commits: number;
  comments: number;
  review_comments: number;
  html_url: string;
  url: string;
  created_at: string;
  updated_at: string;
}

interface GitHubIssue {
  id: number;
  node_id: string;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  state_reason: 'completed' | 'not_planned' | 'reopened' | null;
  user: { id: number; login: string; avatar_url: string };
  labels: Array<{ name: string }>;
  assignees: Array<{ login: string }>;
  milestone: { title: string } | null;
  comments: number;
  pull_request?: { url: string };
  reactions: {
    total_count: number;
    '+1': number;
    '-1': number;
    laugh: number;
    hooray: number;
    confused: number;
    heart: number;
    rocket: number;
    eyes: number;
  };
  html_url: string;
  url: string;
  created_at: string;
  updated_at: string;
}

interface GitHubDiscussion {
  id: string;
  number: number;
  title: string;
  body: string;
  author: { login: string; id?: string };
  category: { name: string };
  answer?: { id: string; author: { login: string } };
  comments: { totalCount: number };
  upvoteCount: number;
  labels: { nodes: Array<{ name: string }> };
  url: string;
  createdAt: string;
  updatedAt: string;
}

interface GitHubReview {
  id: number;
  user: { login: string };
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'PENDING' | 'DISMISSED';
  body: string | null;
  submitted_at: string;
}

interface GitHubComment {
  id: number;
  user: { login: string };
  body: string;
  created_at: string;
  updated_at: string;
  path?: string;
  line?: number;
}

interface GitHubFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

interface GitHubRepo {
  id: number;
  full_name: string;
  name: string;
  owner: { login: string };
  private: boolean;
  default_branch: string;
  description: string | null;
  html_url: string;
  has_wiki: boolean;
}

interface GitHubWikiPage {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  download_url: string;
  type: 'file' | 'dir';
}

interface GitHubWikiContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  content: string;
  encoding: string;
}

// =============================================================================
// Constants
// =============================================================================

const GITHUB_API_BASE = 'https://api.github.com';

// =============================================================================
// GitHub API Helpers
// =============================================================================

const githubFetch = async <T>(
  endpoint: string,
  accessToken: string,
  options?: { method?: string; body?: unknown },
): Promise<T> => {
  const response = await fetch(`${GITHUB_API_BASE}${endpoint}`, {
    method: options?.method || 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error: ${response.status} - ${error}`);
  }

  return (await response.json()) as T;
};

const githubGraphQL = async <T>(
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> => {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub GraphQL error: ${response.status} - ${error}`);
  }

  const result = (await response.json()) as { data: T; errors?: Array<{ message: string }> };
  if (result.errors) {
    throw new Error(`GitHub GraphQL error: ${result.errors.map((e) => e.message).join(', ')}`);
  }

  return result.data;
};

// =============================================================================
// Content Conversion
// =============================================================================

/**
 * Extract issue references from text (e.g., #123, closes #456)
 */
function extractIssueReferences(text: string): number[] {
  const patterns = [
    /#(\d+)/g, // #123
    /(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi, // closes #123
    /github\.com\/[\w-]+\/[\w-]+\/issues\/(\d+)/g, // full URL
  ];

  const issues = new Set<number>();
  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      issues.add(Number.parseInt(match[1], 10));
    }
  }
  return [...issues];
}

/**
 * Detect programming language from filename
 */
function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    ts: 'TypeScript',
    tsx: 'TypeScript',
    js: 'JavaScript',
    jsx: 'JavaScript',
    py: 'Python',
    rb: 'Ruby',
    go: 'Go',
    rs: 'Rust',
    java: 'Java',
    kt: 'Kotlin',
    swift: 'Swift',
    cs: 'C#',
    cpp: 'C++',
    c: 'C',
    h: 'C',
    php: 'PHP',
    sql: 'SQL',
    md: 'Markdown',
    json: 'JSON',
    yaml: 'YAML',
    yml: 'YAML',
    xml: 'XML',
    html: 'HTML',
    css: 'CSS',
    scss: 'SCSS',
    less: 'LESS',
  };
  return languageMap[ext || ''] || 'Unknown';
}

/**
 * Extract symbols (functions, components, classes) from a diff patch
 */
function extractSymbolsFromPatch(
  patch: string,
  language: string,
): {
  functions: string[];
  components: string[];
  classes: string[];
} {
  const functions = new Set<string>();
  const components = new Set<string>();
  const classes = new Set<string>();

  // Only process TypeScript/JavaScript files for now
  if (!['TypeScript', 'JavaScript'].includes(language)) {
    return { functions: [], components: [], classes: [] };
  }

  // Extract only added lines from the patch (lines starting with +)
  const addedLines = patch
    .split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .map((line) => line.slice(1)); // Remove the leading +

  const content = addedLines.join('\n');

  // Function declarations: function foo() or async function foo()
  const functionDeclRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g;
  for (const match of content.matchAll(functionDeclRegex)) {
    const name = match[1];
    // Check if it's a React component (starts with uppercase)
    if (name[0] === name[0].toUpperCase()) {
      components.add(name);
    } else {
      functions.add(name);
    }
  }

  // Arrow functions: const foo = () => or const foo = async () =>
  const arrowFunctionRegex = /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\(/g;
  for (const match of content.matchAll(arrowFunctionRegex)) {
    const name = match[1];
    // Check if it's a React component (starts with uppercase)
    if (name[0] === name[0].toUpperCase()) {
      components.add(name);
    } else {
      functions.add(name);
    }
  }

  // Class declarations
  const classRegex = /(?:export\s+)?class\s+(\w+)/g;
  for (const match of content.matchAll(classRegex)) {
    classes.add(match[1]);
  }

  // React.memo, forwardRef components: const Foo = React.memo(() => ...)
  const reactWrapperRegex = /(?:export\s+)?(?:const|let)\s+([A-Z]\w+)\s*=\s*(?:React\.)?(?:memo|forwardRef)/g;
  for (const match of content.matchAll(reactWrapperRegex)) {
    components.add(match[1]);
  }

  // Method definitions within classes: methodName() { or async methodName() {
  const methodRegex = /^\s+(?:async\s+)?(\w+)\s*\([^)]*\)\s*[{:]/gm;
  for (const match of content.matchAll(methodRegex)) {
    const name = match[1];
    // Skip constructor and common lifecycle methods
    if (!['constructor', 'render', 'componentDidMount', 'componentWillUnmount', 'componentDidUpdate'].includes(name)) {
      functions.add(name);
    }
  }

  return {
    functions: [...functions],
    components: [...components],
    classes: [...classes],
  };
}

/**
 * Extract import statements from a diff patch
 */
function extractImportsFromPatch(patch: string, language: string): string[] {
  const imports = new Set<string>();

  // Only process TypeScript/JavaScript files
  if (!['TypeScript', 'JavaScript'].includes(language)) {
    return [];
  }

  // Extract only added lines from the patch
  const addedLines = patch
    .split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .map((line) => line.slice(1));

  const content = addedLines.join('\n');

  // ES6 imports: import { foo } from 'bar' or import foo from 'bar'
  const importRegex = /import\s+(?:{[^}]+}|\w+)\s+from\s+['"]([^'"]+)['"]/g;
  for (const match of content.matchAll(importRegex)) {
    imports.add(match[1]);
  }

  // Dynamic imports: import('foo')
  const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const match of content.matchAll(dynamicImportRegex)) {
    imports.add(match[1]);
  }

  // require statements: require('foo')
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const match of content.matchAll(requireRegex)) {
    imports.add(match[1]);
  }

  return [...imports];
}

/**
 * Extract code context from file diffs
 */
function extractCodeContext(files: GitHubFile[]): CodeContext {
  const allFunctions = new Set<string>();
  const allComponents = new Set<string>();
  const allClasses = new Set<string>();
  const allImports = new Set<string>();

  for (const file of files) {
    const language = detectLanguage(file.filename);

    // Only extract symbols if we have a patch
    if (file.patch) {
      const symbols = extractSymbolsFromPatch(file.patch, language);
      for (const f of symbols.functions) allFunctions.add(f);
      for (const c of symbols.components) allComponents.add(c);
      for (const c of symbols.classes) allClasses.add(c);

      const imports = extractImportsFromPatch(file.patch, language);
      for (const i of imports) allImports.add(i);
    }
  }

  return {
    languages: [...new Set(files.map((f) => detectLanguage(f.filename)))],
    files: files.map((f) => f.filename),
    directories: [...new Set(files.map((f) => f.filename.split('/').slice(0, -1).join('/')).filter(Boolean))],
    components: [...allComponents],
    functions: [...allFunctions],
    imports: [...allImports],
    classes: [...allClasses],
  };
}

/**
 * Convert a GitHub PR to a RawContentItem
 */
function prToRawContentItem(
  pr: GitHubPR,
  reviews: GitHubReview[],
  reviewComments: GitHubComment[],
  files: GitHubFile[],
): RawContentItem {
  // Build comprehensive content
  const sections = [
    `# ${pr.title}`,
    '',
    pr.body || '_No description provided_',
    '',
    '## Files Changed',
    files.map((f) => `- \`${f.filename}\` (+${f.additions}/-${f.deletions})`).join('\n'),
    '',
  ];

  // Add review summary
  if (reviews.length > 0) {
    sections.push('## Reviews');
    const stateEmoji: Record<string, string> = {
      APPROVED: '✓',
      CHANGES_REQUESTED: '✗',
      COMMENTED: '○',
      PENDING: '◌',
      DISMISSED: '–',
    };
    for (const review of reviews) {
      sections.push(`${stateEmoji[review.state] || '○'} **${review.user.login}**: ${review.state}`);
      if (review.body) sections.push(`> ${review.body}`);
    }
    sections.push('');
  }

  // Add review comments (limited)
  if (reviewComments.length > 0) {
    sections.push('## Review Comments');
    for (const comment of reviewComments.slice(0, 10)) {
      sections.push(`**${comment.user.login}**${comment.path ? ` on \`${comment.path}:${comment.line}\`` : ''}:`);
      sections.push(`> ${comment.body}`);
      sections.push('');
    }
  }

  const content = sections.join('\n');
  const linkedIssues = extractIssueReferences(pr.body || '');
  const codeContext = extractCodeContext(files);

  // Determine review state
  const approvedReviews = reviews.filter((r) => r.state === 'APPROVED');
  const changesRequested = reviews.filter((r) => r.state === 'CHANGES_REQUESTED');
  let reviewState: 'approved' | 'changes_requested' | 'pending' | null = null;
  if (approvedReviews.length > 0 && changesRequested.length === 0) {
    reviewState = 'approved';
  } else if (changesRequested.length > 0) {
    reviewState = 'changes_requested';
  } else if (reviews.length > 0) {
    reviewState = 'pending';
  }

  const metadata: GitHubPRMetadata = {
    repo: pr.base.repo.full_name,
    number: pr.number,
    node_id: pr.node_id,
    state: pr.merged ? 'merged' : pr.state,
    draft: pr.draft,
    base_branch: pr.base.ref,
    head_branch: pr.head.ref,
    base_sha: pr.base.sha,
    head_sha: pr.head.sha,
    merge_commit_sha: pr.merge_commit_sha,
    labels: pr.labels.map((l) => l.name),
    assignees: pr.assignees.map((a) => a.login),
    reviewers: pr.requested_reviewers.map((r) => r.login),
    review_state: reviewState,
    merged_by: pr.merged_by?.login,
    merged_at: pr.merged_at,
    files_changed: pr.changed_files,
    additions: pr.additions,
    deletions: pr.deletions,
    commits: pr.commits,
    comments: pr.comments,
    review_comments: pr.review_comments,
    linked_issues: linkedIssues,
    url: pr.url,
    html_url: pr.html_url,
  };

  return {
    externalId: `${pr.base.repo.full_name}#${pr.number}`,
    type: 'pull_request',
    title: `PR #${pr.number}: ${pr.title}`,
    content,
    authorExternal: String(pr.user.id),
    authorName: pr.user.login,
    createdAtSource: new Date(pr.created_at),
    updatedAtSource: new Date(pr.updated_at),
    metadata: { ...metadata, code_context: codeContext },
    participants: [
      {
        externalId: String(pr.user.id),
        name: pr.user.login,
        role: 'author' as const,
      },
      ...reviews.map((r) => ({
        externalId: r.user.login,
        name: r.user.login,
        role: 'reviewer' as const,
      })),
    ],
  };
}

/**
 * Convert a GitHub Issue to a RawContentItem
 */
function issueToRawContentItem(issue: GitHubIssue, comments: GitHubComment[]): RawContentItem {
  const sections = [`# ${issue.title}`, '', issue.body || '_No description provided_'];

  if (comments.length > 0) {
    sections.push('', '## Comments', '');
    for (const comment of comments.slice(0, 20)) {
      sections.push(`**${comment.user.login}** (${comment.created_at}):`);
      sections.push(`> ${comment.body}`);
      sections.push('');
    }
  }

  const content = sections.join('\n');
  const linkedPRs = extractIssueReferences(issue.body || '');

  const metadata: GitHubIssueMetadata = {
    repo: issue.html_url.match(/github\.com\/([^/]+\/[^/]+)/)?.[1] || '',
    number: issue.number,
    node_id: issue.node_id,
    state: issue.state,
    state_reason: issue.state_reason,
    labels: issue.labels.map((l) => l.name),
    assignees: issue.assignees.map((a) => a.login),
    milestone: issue.milestone?.title,
    linked_prs: linkedPRs,
    is_pull_request: !!issue.pull_request,
    comment_count: issue.comments,
    reactions: [
      { name: '+1', count: issue.reactions['+1'] },
      { name: '-1', count: issue.reactions['-1'] },
      { name: 'laugh', count: issue.reactions.laugh },
      { name: 'hooray', count: issue.reactions.hooray },
      { name: 'confused', count: issue.reactions.confused },
      { name: 'heart', count: issue.reactions.heart },
      { name: 'rocket', count: issue.reactions.rocket },
      { name: 'eyes', count: issue.reactions.eyes },
    ].filter((r) => r.count > 0),
    url: issue.url,
    html_url: issue.html_url,
  };

  return {
    externalId: issue.node_id,
    type: 'issue',
    title: `Issue #${issue.number}: ${issue.title}`,
    content,
    authorExternal: String(issue.user.id),
    authorName: issue.user.login,
    createdAtSource: new Date(issue.created_at),
    updatedAtSource: new Date(issue.updated_at),
    metadata,
    participants: [
      {
        externalId: String(issue.user.id),
        name: issue.user.login,
        role: 'author' as const,
      },
      ...comments.map((c) => ({
        externalId: c.user.login,
        name: c.user.login,
        role: 'participant' as const,
      })),
    ],
  };
}

/**
 * Convert a GitHub Wiki page to a RawContentItem
 */
function wikiToRawContentItem(page: GitHubWikiContent, repo: string, htmlUrl: string): RawContentItem {
  // Remove .md extension from page name for display
  const pageName = page.name.replace(/\.md$/i, '').replace(/-/g, ' ');

  // Decode content if base64 encoded
  const content = page.encoding === 'base64' ? Buffer.from(page.content, 'base64').toString('utf-8') : page.content;

  return {
    externalId: `${repo}/wiki/${page.path}`,
    type: 'document',
    title: `Wiki: ${pageName}`,
    content,
    authorExternal: undefined, // Wiki API doesn't provide author info
    authorName: undefined,
    createdAtSource: undefined, // Wiki API doesn't provide timestamps
    updatedAtSource: undefined,
    metadata: {
      repo,
      wikiPath: page.path,
      sha: page.sha,
      size: page.size,
      url: htmlUrl,
      html_url: htmlUrl,
    },
    participants: [],
  };
}

/**
 * Convert a GitHub Discussion to a RawContentItem
 */
function discussionToRawContentItem(discussion: GitHubDiscussion, repo: string): RawContentItem {
  const metadata: GitHubDiscussionMetadata = {
    repo,
    number: discussion.number,
    node_id: discussion.id,
    category: discussion.category.name,
    is_answered: !!discussion.answer,
    answer_id: discussion.answer?.id,
    answer_author: discussion.answer?.author.login,
    comment_count: discussion.comments.totalCount,
    upvote_count: discussion.upvoteCount,
    labels: discussion.labels.nodes.map((l) => l.name),
    url: discussion.url,
  };

  return {
    externalId: discussion.id,
    type: 'thread', // Using thread type for discussions
    title: `Discussion #${discussion.number}: ${discussion.title}`,
    content: discussion.body,
    authorExternal: discussion.author.id || discussion.author.login,
    authorName: discussion.author.login,
    createdAtSource: new Date(discussion.createdAt),
    updatedAtSource: new Date(discussion.updatedAt),
    metadata,
    participants: [
      {
        externalId: discussion.author.login,
        name: discussion.author.login,
        role: 'author' as const,
      },
    ],
  };
}

// =============================================================================
// GitHub Content Adapter Service
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
      Effect.tryPromise({
        try: async () => {
          const accessToken = getAccessToken(source);
          await githubFetch<{ login: string }>('/user', accessToken);
          return true;
        },
        catch: () => false,
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
          try {
            const pr = yield* Effect.tryPromise({
              try: () => githubFetch<GitHubPR>(`/repos/${repo}/pulls/${number}`, accessToken),
              catch: () => null,
            });
            if (!pr) return null;

            const reviews = yield* Effect.tryPromise({
              try: () => githubFetch<GitHubReview[]>(`/repos/${repo}/pulls/${number}/reviews`, accessToken),
              catch: () => [],
            });

            const reviewComments = yield* Effect.tryPromise({
              try: () => githubFetch<GitHubComment[]>(`/repos/${repo}/pulls/${number}/comments`, accessToken),
              catch: () => [],
            });

            const files = yield* Effect.tryPromise({
              try: () => githubFetch<GitHubFile[]>(`/repos/${repo}/pulls/${number}/files`, accessToken),
              catch: () => [],
            });

            return prToRawContentItem(pr, reviews, reviewComments, files);
          } catch {
            return null;
          }
        }

        // Try as issue node_id
        // For now, return null for non-PR lookups
        return null;
      }).pipe(
        Effect.mapError(
          (e) =>
            new ContentSourceSyncError({
              message: e instanceof Error ? e.message : 'Unknown error',
              sourceId: source.id,
              sourceType: 'github',
              cause: e,
            }),
        ),
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
          const response = yield* Effect.tryPromise({
            try: () => githubFetch<GitHubRepo[]>(`/user/repos?per_page=100&page=${page}&sort=updated`, accessToken),
            catch: (e) =>
              new ContentSourceSyncError({
                message: `Failed to list repositories: ${e instanceof Error ? e.message : 'Unknown'}`,
                sourceId: source.id,
                sourceType: 'github',
                cause: e,
              }),
          });

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

          const prs = yield* Effect.tryPromise({
            try: () => githubFetch<GitHubPR[]>(`/repos/${repo}/pulls?${params}`, accessToken),
            catch: (e) =>
              new ContentSourceSyncError({
                message: `Failed to fetch PRs: ${e instanceof Error ? e.message : 'Unknown'}`,
                sourceId: source.id,
                sourceType: 'github',
                cause: e,
              }),
          });

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
            const reviews = yield* Effect.tryPromise({
              try: () => githubFetch<GitHubReview[]>(`/repos/${repo}/pulls/${pr.number}/reviews`, accessToken),
              catch: (e) => new Error(String(e)),
            }).pipe(Effect.catchAll(() => Effect.succeed([] as GitHubReview[])));

            const reviewComments = yield* Effect.tryPromise({
              try: () => githubFetch<GitHubComment[]>(`/repos/${repo}/pulls/${pr.number}/comments`, accessToken),
              catch: (e) => new Error(String(e)),
            }).pipe(Effect.catchAll(() => Effect.succeed([] as GitHubComment[])));

            const files = yield* Effect.tryPromise({
              try: () => githubFetch<GitHubFile[]>(`/repos/${repo}/pulls/${pr.number}/files`, accessToken),
              catch: (e) => new Error(String(e)),
            }).pipe(Effect.catchAll(() => Effect.succeed([] as GitHubFile[])));

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

          const issues = yield* Effect.tryPromise({
            try: () => githubFetch<GitHubIssue[]>(`/repos/${repo}/issues?${params}`, accessToken),
            catch: (e) =>
              new ContentSourceSyncError({
                message: `Failed to fetch issues: ${e instanceof Error ? e.message : 'Unknown'}`,
                sourceId: source.id,
                sourceType: 'github',
                cause: e,
              }),
          });

          for (const issue of issues) {
            // Skip PRs (they show up in issues endpoint)
            if (issue.pull_request) continue;

            // Apply label filters
            if (config?.labelFilters?.length) {
              const issueLabels = issue.labels.map((l) => l.name);
              if (!config.labelFilters.some((f) => issueLabels.includes(f))) {
                continue;
              }
            }

            // Fetch comments
            const comments = yield* Effect.tryPromise({
              try: () => githubFetch<GitHubComment[]>(`/repos/${repo}/issues/${issue.number}/comments`, accessToken),
              catch: (e) => new Error(String(e)),
            }).pipe(Effect.catchAll(() => Effect.succeed([] as GitHubComment[])));

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
          const result = yield* Effect.tryPromise({
            try: () =>
              githubGraphQL<{
                repository: {
                  discussions: {
                    pageInfo: { hasNextPage: boolean; endCursor: string };
                    nodes: GitHubDiscussion[];
                  };
                };
              }>(accessToken, query, { owner, name, cursor }),
            catch: (e) =>
              new ContentSourceSyncError({
                message: `Failed to fetch discussions: ${e instanceof Error ? e.message : 'Unknown'}`,
                sourceId: source.id,
                sourceType: 'github',
                cause: e,
              }),
          });

          const discussions = result.repository.discussions;

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
          const contributors = yield* Effect.tryPromise({
            try: () =>
              githubFetch<Array<{ id: number; login: string; avatar_url: string; type: string }>>(
                `/repos/${repo}/contributors?per_page=100`,
                accessToken,
              ),
            catch: (e) => new Error(String(e)),
          }).pipe(
            Effect.catchAll(() =>
              Effect.succeed([] as Array<{ id: number; login: string; avatar_url: string; type: string }>),
            ),
          );

          for (const contributor of contributors) {
            const userData: NewGitHubUser = {
              sourceId: source.id,
              githubUserId: contributor.id,
              githubLogin: contributor.login,
              avatarUrl: contributor.avatar_url,
              type: contributor.type,
            };

            yield* Effect.tryPromise({
              try: async () => {
                const existing = await db.query.githubUsers.findFirst({
                  where: and(eq(githubUsers.sourceId, source.id), eq(githubUsers.githubUserId, contributor.id)),
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
          const response = yield* Effect.tryPromise({
            try: () =>
              githubFetch<{ content: string; encoding: string; sha: string; size: number }>(
                `/repos/${repo}/contents/${path}${ref ? `?ref=${ref}` : ''}`,
                accessToken,
              ),
            catch: () => null,
          });

          if (!response) return null;

          const content =
            response.encoding === 'base64'
              ? Buffer.from(response.content, 'base64').toString('utf-8')
              : response.content;

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
                size: response.size,
                sha: response.sha,
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
        const data = payload as Record<string, unknown>;

        switch (event) {
          case 'pull_request': {
            const action = data.action as string;
            if (['opened', 'edited', 'closed', 'reopened', 'synchronize'].includes(action)) {
              const pr = data.pull_request as GitHubPR;
              const repo = (data.repository as { full_name: string }).full_name;
              const accessToken = getAccessToken(source);

              const reviews = yield* Effect.tryPromise({
                try: () => githubFetch<GitHubReview[]>(`/repos/${repo}/pulls/${pr.number}/reviews`, accessToken),
                catch: () => [],
              });

              const reviewComments = yield* Effect.tryPromise({
                try: () => githubFetch<GitHubComment[]>(`/repos/${repo}/pulls/${pr.number}/comments`, accessToken),
                catch: () => [],
              });

              const files = yield* Effect.tryPromise({
                try: () => githubFetch<GitHubFile[]>(`/repos/${repo}/pulls/${pr.number}/files`, accessToken),
                catch: () => [],
              });

              return prToRawContentItem(pr, reviews, reviewComments, files);
            }
            break;
          }

          case 'issues': {
            const action = data.action as string;
            if (['opened', 'edited', 'closed', 'reopened'].includes(action)) {
              const issue = data.issue as GitHubIssue;
              if (issue.pull_request) return null; // Skip PR issues

              const repo = (data.repository as { full_name: string }).full_name;
              const accessToken = getAccessToken(source);

              const comments = yield* Effect.tryPromise({
                try: () => githubFetch<GitHubComment[]>(`/repos/${repo}/issues/${issue.number}/comments`, accessToken),
                catch: () => [],
              });

              return issueToRawContentItem(issue, comments);
            }
            break;
          }

          case 'issue_comment': {
            // Re-fetch the issue with updated comments
            const issue = data.issue as GitHubIssue;
            if (issue.pull_request) return null;

            const repo = (data.repository as { full_name: string }).full_name;
            const accessToken = getAccessToken(source);

            const comments = yield* Effect.tryPromise({
              try: () => githubFetch<GitHubComment[]>(`/repos/${repo}/issues/${issue.number}/comments`, accessToken),
              catch: () => [],
            });

            return issueToRawContentItem(issue, comments);
          }

          case 'pull_request_review':
          case 'pull_request_review_comment': {
            // Re-fetch the PR with updated reviews
            const pr = data.pull_request as GitHubPR;
            const repo = (data.repository as { full_name: string }).full_name;
            const accessToken = getAccessToken(source);

            const reviews = yield* Effect.tryPromise({
              try: () => githubFetch<GitHubReview[]>(`/repos/${repo}/pulls/${pr.number}/reviews`, accessToken),
              catch: () => [],
            });

            const reviewComments = yield* Effect.tryPromise({
              try: () => githubFetch<GitHubComment[]>(`/repos/${repo}/pulls/${pr.number}/comments`, accessToken),
              catch: () => [],
            });

            const files = yield* Effect.tryPromise({
              try: () => githubFetch<GitHubFile[]>(`/repos/${repo}/pulls/${pr.number}/files`, accessToken),
              catch: () => [],
            });

            return prToRawContentItem(pr, reviews, reviewComments, files);
          }
        }

        return null;
      }).pipe(
        Effect.mapError(
          (e) =>
            new ContentSourceSyncError({
              message: e instanceof Error ? e.message : 'Unknown error',
              sourceId: source.id,
              sourceType: 'github',
              cause: e,
            }),
        ),
      ),

    syncWiki: (source, repo) =>
      Effect.gen(function* () {
        const accessToken = getAccessToken(source);
        const items: RawContentItem[] = [];
        const [owner, name] = repo.split('/');

        // First check if the repo has a wiki enabled
        const repoInfo = yield* Effect.tryPromise({
          try: () => githubFetch<GitHubRepo>(`/repos/${repo}`, accessToken),
          catch: (e) =>
            new ContentSourceSyncError({
              message: `Failed to fetch repo info: ${e instanceof Error ? e.message : 'Unknown'}`,
              sourceId: source.id,
              sourceType: 'github',
              cause: e,
            }),
        });

        if (!repoInfo.has_wiki) {
          // Wiki not enabled for this repo
          return [];
        }

        // List wiki pages using the Contents API on the wiki repo
        // Wiki repos are accessible at {owner}/{repo}.wiki
        const wikiRepoPath = `${owner}/${name}.wiki`;

        // Try to list wiki contents (root level)
        const wikiPages = yield* Effect.tryPromise({
          try: () => githubFetch<GitHubWikiPage[]>(`/repos/${wikiRepoPath}/contents`, accessToken),
          catch: (e) =>
            new ContentSourceSyncError({
              message: `Failed to list wiki pages: ${e instanceof Error ? e.message : 'Unknown'}`,
              sourceId: source.id,
              sourceType: 'github',
              cause: e,
            }),
        }).pipe(
          // Wiki might not exist even if has_wiki is true
          Effect.catchAll(() => Effect.succeed(null as GitHubWikiPage[] | null)),
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
          const pageContent = yield* Effect.tryPromise({
            try: () => githubFetch<GitHubWikiContent>(`/repos/${wikiRepoPath}/contents/${page.path}`, accessToken),
            catch: (e) => new Error(String(e)),
          }).pipe(Effect.catchAll(() => Effect.succeed(null as GitHubWikiContent | null)));

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
          const subPages = yield* Effect.tryPromise({
            try: () => githubFetch<GitHubWikiPage[]>(`/repos/${wikiRepoPath}/contents/${dir.path}`, accessToken),
            catch: (e) => new Error(String(e)),
          }).pipe(Effect.catchAll(() => Effect.succeed([] as GitHubWikiPage[])));

          const subMarkdownPages = subPages.filter(
            (p) => p.type === 'file' && (p.name.endsWith('.md') || p.name.endsWith('.markdown')),
          );

          for (const page of subMarkdownPages.slice(0, 50)) {
            // Limit per directory
            const pageContent = yield* Effect.tryPromise({
              try: () => githubFetch<GitHubWikiContent>(`/repos/${wikiRepoPath}/contents/${page.path}`, accessToken),
              catch: (e) => new Error(String(e)),
            }).pipe(Effect.catchAll(() => Effect.succeed(null as GitHubWikiContent | null)));

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
 * Get GitHub OAuth URL
 */
export const getGitHubAuthUrl = (clientId: string, redirectUri: string, state: string, scope?: string): string => {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: scope || 'repo read:org read:user',
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
};

/**
 * Exchange GitHub OAuth code for access token
 */
export const exchangeGitHubCode = async (
  clientId: string,
  clientSecret: string,
  code: string,
): Promise<{ access_token: string; token_type: string; scope: string }> => {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub OAuth error: ${error}`);
  }

  return (await response.json()) as { access_token: string; token_type: string; scope: string };
};

/**
 * Verify GitHub webhook signature
 */
export const verifyGitHubWebhookSignature = (signature: string, secret: string, body: string): boolean => {
  const crypto = require('node:crypto');
  const expectedSignature = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch {
    return false;
  }
};

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
