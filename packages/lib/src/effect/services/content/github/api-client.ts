/**
 * GitHub API Client
 *
 * Low-level API helpers for making GitHub REST and GraphQL API requests.
 */

// =============================================================================
// Constants
// =============================================================================

export const GITHUB_API_BASE = 'https://api.github.com';
export const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';

// =============================================================================
// GitHub API Helpers
// =============================================================================

/**
 * Make a REST API request to GitHub
 */
export const githubFetch = async <T>(
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

/**
 * Make a GraphQL request to GitHub
 */
export const githubGraphQL = async <T>(
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> => {
  const response = await fetch(GITHUB_GRAPHQL_URL, {
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
