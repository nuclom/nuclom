/**
 * Slack Content Adapter Types
 *
 * Type definitions for Slack API responses and internal structures.
 */

import type {
  ChatGetPermalinkResponse,
  ConversationsHistoryResponse,
  ConversationsInfoResponse,
  ConversationsListResponse,
  ConversationsRepliesResponse,
  UsersListResponse,
} from '@slack/web-api';
import type { StorageService } from '../../storage';

// =============================================================================
// Slack API Response Types
// =============================================================================

export type SlackMessage = NonNullable<ConversationsHistoryResponse['messages']>[number];
export type SlackConversationHistoryResponse = ConversationsHistoryResponse;
export type SlackConversationInfoResponse = ConversationsInfoResponse;
export type SlackConversationRepliesResponse = ConversationsRepliesResponse;
export type SlackChannelsListResponse = ConversationsListResponse;
export type SlackChannelInfo = NonNullable<ConversationsListResponse['channels']>[number];
export type SlackUsersListResponse = UsersListResponse;
export type SlackPermalinkResponse = ChatGetPermalinkResponse;

// =============================================================================
// Internal Types
// =============================================================================

/**
 * Context for processing Slack messages with file attachments
 */
export interface MessageProcessingContext {
  readonly sourceId: string;
  readonly accessToken: string;
  readonly storage: StorageService;
  readonly syncFiles: boolean;
}
