/**
 * Slack Content Adapter
 *
 * Slack content adapter exports.
 */

// Adapter (main service)
export {
  createSlackContentAdapter,
  SlackContentAdapter,
  SlackContentAdapterLive,
  type SlackContentAdapterService,
} from './adapter';

// API Client
export { slackFetch } from './api-client';

// Auth
export { exchangeSlackCode, getSlackContentAuthUrl, verifySlackSignature } from './auth';

// Constants
export { MAX_FILE_SIZE_BYTES, SLACK_CONTENT_SCOPES, SLACK_FILES_PREFIX } from './constants';

// File Handlers
export { downloadSlackFile, generateSlackFileKey, processSlackFile, processSlackFiles } from './file-handlers';

// Formatters
export { formatSlackMrkdwn, resolveChannelMentions, resolveUserMentions } from './formatters';

// Message Converters
export {
  aggregateThread,
  generateMessageTitle,
  generateThreadTitle,
  messageToRawContentItem,
} from './message-converters';

// Types
export type {
  MessageProcessingContext,
  SlackChannelInfo,
  SlackChannelsListResponse,
  SlackConversationHistoryResponse,
  SlackConversationInfoResponse,
  SlackConversationRepliesResponse,
  SlackMessage,
  SlackPermalinkResponse,
  SlackUsersListResponse,
} from './types';
