/**
 * Slack Content Adapter Types
 *
 * Type definitions for Slack API responses and internal structures.
 */

import type { StorageService } from '../../storage';

// =============================================================================
// Slack API Response Types
// =============================================================================

export interface SlackMessage {
  readonly type: string;
  readonly user: string;
  readonly text: string;
  readonly ts: string;
  readonly thread_ts?: string;
  readonly reply_count?: number;
  readonly reply_users_count?: number;
  readonly latest_reply?: string;
  readonly reactions?: Array<{ name: string; count: number; users: string[] }>;
  readonly files?: Array<{
    id: string;
    name: string;
    mimetype: string;
    url_private: string;
    size: number;
  }>;
  readonly blocks?: unknown[];
  readonly edited?: { user: string; ts: string };
  readonly subtype?: string;
  readonly bot_id?: string;
}

export interface SlackConversationHistoryResponse {
  readonly ok: boolean;
  readonly messages: SlackMessage[];
  readonly has_more: boolean;
  readonly response_metadata?: {
    next_cursor?: string;
  };
  readonly error?: string;
}

export interface SlackConversationRepliesResponse {
  readonly ok: boolean;
  readonly messages: SlackMessage[];
  readonly has_more: boolean;
  readonly response_metadata?: {
    next_cursor?: string;
  };
  readonly error?: string;
}

export interface SlackChannelInfo {
  readonly id: string;
  readonly name: string;
  readonly is_private: boolean;
  readonly is_member: boolean;
  readonly is_archived: boolean;
  readonly num_members?: number;
  readonly topic?: { value: string };
  readonly purpose?: { value: string };
}

export interface SlackChannelsListResponse {
  readonly ok: boolean;
  readonly channels: SlackChannelInfo[];
  readonly response_metadata?: {
    next_cursor?: string;
  };
  readonly error?: string;
}

export interface SlackUsersListResponse {
  readonly ok: boolean;
  readonly members: Array<{
    id: string;
    name: string;
    real_name?: string;
    profile: {
      email?: string;
      image_48?: string;
      display_name?: string;
    };
    is_bot: boolean;
    is_admin?: boolean;
    tz?: string;
  }>;
  readonly response_metadata?: {
    next_cursor?: string;
  };
  readonly error?: string;
}

export interface SlackPermalinkResponse {
  readonly ok: boolean;
  readonly permalink: string;
  readonly error?: string;
}

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
