/**
 * GitHub Content Adapter
 *
 * Re-exports all GitHub adapter functionality for backward compatibility.
 */

// Adapter (main service)
export {
  cleanupExpiredFileCache,
  createGitHubContentAdapter,
  GitHubContentAdapter,
  GitHubContentAdapterLive,
  type GitHubContentAdapterService,
} from './adapter';

// API Client
export { GITHUB_API_BASE, GITHUB_GRAPHQL_URL, githubFetch, githubGraphQL } from './api-client';
// Auth
export { exchangeGitHubCode, getGitHubAuthUrl, verifyGitHubWebhookSignature } from './auth';
// Content Converters
export {
  detectLanguage,
  discussionToRawContentItem,
  extractCodeContext,
  extractImportsFromPatch,
  extractIssueReferences,
  extractSymbolChanges,
  extractSymbolsFromPatch,
  issueToRawContentItem,
  prToRawContentItem,
  wikiToRawContentItem,
} from './content-converters';
// Types
export type {
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
  SymbolChanges,
} from './types';
