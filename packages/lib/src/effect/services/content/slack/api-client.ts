/**
 * Slack API Client
 *
 * Low-level API helper for making Slack API requests.
 */

import { SLACK_API_BASE } from './constants';

/**
 * Make a GET request to the Slack API
 */
export const slackFetch = async <T>(
  endpoint: string,
  accessToken: string,
  params?: Record<string, string>,
): Promise<T> => {
  const url = new URL(`${SLACK_API_BASE}/${endpoint}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Slack API error: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as T & { ok: boolean; error?: string };
  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error || 'Unknown error'}`);
  }

  return data;
};
