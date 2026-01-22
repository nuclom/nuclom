/**
 * GitHub Content Converters
 *
 * Functions for converting GitHub API responses to RawContentItem format
 * and extracting metadata from code diffs.
 */

import type {
  CodeContext,
  GitHubDiscussionMetadata,
  GitHubIssueMetadata,
  GitHubPRMetadata,
} from '../../../../db/schema';
import type { RawContentItem } from '../types';
import type {
  GitHubComment,
  GitHubDiscussion,
  GitHubFile,
  GitHubIssue,
  GitHubPR,
  GitHubReview,
  GitHubWikiContent,
  SymbolChanges,
} from './types';

// =============================================================================
// Text Extraction Helpers
// =============================================================================

/**
 * Extract issue references from text (e.g., #123, closes #456)
 */
export function extractIssueReferences(text: string): number[] {
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

// =============================================================================
// Language Detection
// =============================================================================

const LANGUAGE_MAP: Record<string, string> = {
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

/**
 * Detect programming language from filename
 */
export function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  return LANGUAGE_MAP[ext || ''] || 'Unknown';
}

// =============================================================================
// Symbol Extraction from Diffs
// =============================================================================

/**
 * Extract symbols (functions, components, classes) from a diff patch
 */
export function extractSymbolsFromPatch(
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
export function extractImportsFromPatch(patch: string, language: string): string[] {
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
 * Extract symbols from patch lines (either added or removed)
 */
function extractSymbolsFromLines(lines: string[], language: string): Set<string> {
  const symbols = new Set<string>();

  // Only process TypeScript/JavaScript for now (matches existing behavior)
  if (!['TypeScript', 'JavaScript'].includes(language)) {
    return symbols;
  }

  const content = lines.join('\n');

  // Function declarations
  const functionDeclRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g;
  for (const match of content.matchAll(functionDeclRegex)) {
    symbols.add(match[1]);
  }

  // Arrow functions
  const arrowFunctionRegex = /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\(/g;
  for (const match of content.matchAll(arrowFunctionRegex)) {
    symbols.add(match[1]);
  }

  // Class declarations
  const classRegex = /(?:export\s+)?class\s+(\w+)/g;
  for (const match of content.matchAll(classRegex)) {
    symbols.add(match[1]);
  }

  // React.memo, forwardRef components
  const reactWrapperRegex = /(?:export\s+)?(?:const|let)\s+([A-Z]\w+)\s*=\s*(?:React\.)?(?:memo|forwardRef)/g;
  for (const match of content.matchAll(reactWrapperRegex)) {
    symbols.add(match[1]);
  }

  return symbols;
}

/**
 * Extract and categorize symbol changes from file diffs
 * - added: symbols only in added lines
 * - modified: symbols in both added and removed lines
 * - removed: symbols only in removed lines
 * - componentsChanged: all React components touched (uppercase names)
 */
export function extractSymbolChanges(files: GitHubFile[]): SymbolChanges {
  const allAdded = new Set<string>();
  const allRemoved = new Set<string>();
  const allComponents = new Set<string>();

  for (const file of files) {
    if (!file.patch) continue;

    const language = detectLanguage(file.filename);
    const lines = file.patch.split('\n');

    // Split lines into added and removed
    const addedLines = lines
      .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
      .map((line) => line.slice(1));

    const removedLines = lines
      .filter((line) => line.startsWith('-') && !line.startsWith('---'))
      .map((line) => line.slice(1));

    // Extract symbols from each set
    const addedSymbols = extractSymbolsFromLines(addedLines, language);
    const removedSymbols = extractSymbolsFromLines(removedLines, language);

    // Merge into global sets
    for (const sym of addedSymbols) allAdded.add(sym);
    for (const sym of removedSymbols) allRemoved.add(sym);

    // Track all components (uppercase names)
    for (const sym of addedSymbols) {
      if (sym[0] === sym[0].toUpperCase()) allComponents.add(sym);
    }
    for (const sym of removedSymbols) {
      if (sym[0] === sym[0].toUpperCase()) allComponents.add(sym);
    }
  }

  // Categorize: modified = in both, added = only in added, removed = only in removed
  const modified = [...allAdded].filter((sym) => allRemoved.has(sym));
  const added = [...allAdded].filter((sym) => !allRemoved.has(sym));
  const removed = [...allRemoved].filter((sym) => !allAdded.has(sym));

  return {
    added,
    modified,
    removed,
    componentsChanged: [...allComponents],
  };
}

/**
 * Extract code context from file diffs
 */
export function extractCodeContext(files: GitHubFile[]): CodeContext {
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

// =============================================================================
// Content Item Converters
// =============================================================================

/**
 * Convert a GitHub PR to a RawContentItem
 */
export function prToRawContentItem(
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
      sections.push(`${stateEmoji[review.state] || '○'} **${review.user?.login ?? 'unknown'}**: ${review.state}`);
      if (review.body) sections.push(`> ${review.body}`);
    }
    sections.push('');
  }

  // Add review comments (limited)
  if (reviewComments.length > 0) {
    sections.push('## Review Comments');
    for (const comment of reviewComments.slice(0, 10)) {
      sections.push(
        `**${comment.user?.login ?? 'unknown'}**${comment.path ? ` on \`${comment.path}:${comment.line}\`` : ''}:`,
      );
      sections.push(`> ${comment.body}`);
      sections.push('');
    }
  }

  const content = sections.join('\n');
  const linkedIssues = extractIssueReferences(pr.body || '');
  const codeContext = extractCodeContext(files);
  const symbolChanges = extractSymbolChanges(files);

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
    labels: (pr.labels ?? []).map((l) => (typeof l === 'string' ? l : l.name)),
    assignees: (pr.assignees ?? []).map((a) => a.login),
    reviewers: (pr.requested_reviewers ?? []).map((r) => r.login),
    review_state: reviewState,
    merged_by: pr.merged_by?.login,
    merged_at: pr.merged_at,
    files_changed: pr.changed_files ?? 0,
    additions: pr.additions,
    deletions: pr.deletions,
    commits: pr.commits,
    comments: pr.comments,
    review_comments: pr.review_comments ?? 0,
    linked_issues: linkedIssues,
    url: pr.url,
    html_url: pr.html_url,
    // Symbol extraction from diffs
    symbols_added: symbolChanges.added.length > 0 ? symbolChanges.added : undefined,
    symbols_modified: symbolChanges.modified.length > 0 ? symbolChanges.modified : undefined,
    symbols_removed: symbolChanges.removed.length > 0 ? symbolChanges.removed : undefined,
    components_changed: symbolChanges.componentsChanged.length > 0 ? symbolChanges.componentsChanged : undefined,
  };

  return {
    externalId: `${pr.base.repo.full_name}#${pr.number}`,
    type: 'pull_request',
    title: `PR #${pr.number}: ${pr.title}`,
    content,
    authorExternal: pr.user ? String(pr.user.id) : 'unknown',
    authorName: pr.user?.login ?? 'unknown',
    createdAtSource: new Date(pr.created_at),
    updatedAtSource: new Date(pr.updated_at),
    metadata: { ...metadata, code_context: codeContext },
    participants: [
      {
        externalId: pr.user ? String(pr.user.id) : 'unknown',
        name: pr.user?.login ?? 'unknown',
        role: 'author' as const,
      },
      ...reviews.map((r) => ({
        externalId: r.user?.login ?? 'unknown',
        name: r.user?.login ?? 'unknown',
        role: 'reviewer' as const,
      })),
    ],
  };
}

/**
 * Convert a GitHub Issue to a RawContentItem
 */
export function issueToRawContentItem(issue: GitHubIssue, comments: GitHubComment[]): RawContentItem {
  const sections = [`# ${issue.title}`, '', issue.body || '_No description provided_'];

  if (comments.length > 0) {
    sections.push('', '## Comments', '');
    for (const comment of comments.slice(0, 20)) {
      sections.push(`**${comment.user?.login ?? 'unknown'}** (${comment.created_at}):`);
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
    state: issue.state === 'closed' ? 'closed' : 'open',
    state_reason: issue.state_reason === 'duplicate' ? null : issue.state_reason,
    labels: (issue.labels ?? [])
      .map((l) => (typeof l === 'string' ? l : l.name))
      .filter((label): label is string => Boolean(label)),
    assignees: (issue.assignees ?? []).map((a) => a.login),
    milestone: issue.milestone?.title,
    linked_prs: linkedPRs,
    is_pull_request: !!issue.pull_request,
    comment_count: issue.comments,
    reactions: issue.reactions
      ? [
          { name: '+1', count: issue.reactions['+1'] ?? 0 },
          { name: '-1', count: issue.reactions['-1'] ?? 0 },
          { name: 'laugh', count: issue.reactions.laugh ?? 0 },
          { name: 'hooray', count: issue.reactions.hooray ?? 0 },
          { name: 'confused', count: issue.reactions.confused ?? 0 },
          { name: 'heart', count: issue.reactions.heart ?? 0 },
          { name: 'rocket', count: issue.reactions.rocket ?? 0 },
          { name: 'eyes', count: issue.reactions.eyes ?? 0 },
        ].filter((r) => r.count > 0)
      : [],
    url: issue.url,
    html_url: issue.html_url,
  };

  return {
    externalId: issue.node_id,
    type: 'issue',
    title: `Issue #${issue.number}: ${issue.title}`,
    content,
    authorExternal: issue.user ? String(issue.user.id) : 'unknown',
    authorName: issue.user?.login ?? 'unknown',
    createdAtSource: new Date(issue.created_at),
    updatedAtSource: new Date(issue.updated_at),
    metadata,
    participants: [
      {
        externalId: issue.user ? String(issue.user.id) : 'unknown',
        name: issue.user?.login ?? 'unknown',
        role: 'author' as const,
      },
      ...comments.map((c) => ({
        externalId: c.user?.login ?? 'unknown',
        name: c.user?.login ?? 'unknown',
        role: 'participant' as const,
      })),
    ],
  };
}

/**
 * Convert a GitHub Wiki page to a RawContentItem
 */
export function wikiToRawContentItem(page: GitHubWikiContent, repo: string, htmlUrl: string): RawContentItem {
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
export function discussionToRawContentItem(discussion: GitHubDiscussion, repo: string): RawContentItem {
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
