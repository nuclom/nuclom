/**
 * GitHub Content Adapter Types
 *
 * Type definitions for GitHub API responses and internal structures.
 */

// =============================================================================
// GitHub API Types
// =============================================================================

export interface GitHubPR {
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

export interface GitHubIssue {
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

export interface GitHubReview {
  id: number;
  user: { login: string };
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'PENDING' | 'DISMISSED';
  body: string | null;
  submitted_at: string;
}

export interface GitHubComment {
  id: number;
  user: { login: string };
  body: string;
  created_at: string;
  updated_at: string;
  path?: string;
  line?: number;
}

export interface GitHubFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

export interface GitHubRepo {
  id: number;
  full_name: string;
  name: string;
  owner: { login: string };
  private: boolean;
  default_branch: string;
  description: string | null;
  html_url: string;
  has_wiki: boolean;
  stargazers_count?: number;
  language?: string | null;
  updated_at?: string;
}

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

export interface GitHubContributor {
  id: number;
  login: string;
  avatar_url: string;
  type: string;
}

export interface GitHubFileContent {
  content: string;
  encoding: string;
  sha: string;
  size: number;
}

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
