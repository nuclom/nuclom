/**
 * GitHub Content Adapter Types
 *
 * Type definitions for GitHub API responses and internal structures.
 */

import type { Endpoints } from '@octokit/types';

// =============================================================================
// GitHub API Types
// =============================================================================

export type GitHubPR = Endpoints['GET /repos/{owner}/{repo}/pulls/{pull_number}']['response']['data'];
export type GitHubIssue = Endpoints['GET /repos/{owner}/{repo}/issues/{issue_number}']['response']['data'];

export interface GitHubDiscussion {
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

export type GitHubReview =
  Endpoints['GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews']['response']['data'][number];
export type GitHubComment =
  Endpoints['GET /repos/{owner}/{repo}/pulls/{pull_number}/comments']['response']['data'][number];
export type GitHubFile = Endpoints['GET /repos/{owner}/{repo}/pulls/{pull_number}/files']['response']['data'][number];
export type GitHubRepo = Endpoints['GET /repos/{owner}/{repo}']['response']['data'];

export interface GitHubWikiPage {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  download_url: string;
  type: 'file' | 'dir';
}

export interface GitHubWikiContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  content: string;
  encoding: string;
}

export type GitHubContributor = Endpoints['GET /repos/{owner}/{repo}/contributors']['response']['data'][number];
export type GitHubFileContent = Endpoints['GET /repos/{owner}/{repo}/contents/{path}']['response']['data'];

// =============================================================================
// Internal Types
// =============================================================================

/**
 * Extracted symbol changes categorized by addition/modification/removal
 */
export interface SymbolChanges {
  added: string[];
  modified: string[];
  removed: string[];
  componentsChanged: string[];
}
