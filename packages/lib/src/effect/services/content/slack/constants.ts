/**
 * Slack Content Adapter Constants
 *
 * Configuration constants and OAuth scopes for Slack integration.
 */

/**
 * OAuth scopes for content access (in addition to notification scopes)
 */
export const SLACK_CONTENT_SCOPES = [
  // Existing notification scopes
  'channels:read',
  'chat:write',
  'users:read',
  'users:read.email',
  // Content access scopes
  'channels:history', // Read messages from public channels
  'groups:history', // Read messages from private channels
  'reactions:read', // Track reactions (engagement signals)
  'files:read', // Access shared files
];

/**
 * Maximum file size to download (10MB)
 */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Storage path prefix for Slack files
 */
export const SLACK_FILES_PREFIX = 'slack-files';
