/**
 * Slack Content Adapter
 *
 * Adapter that ingests Slack messages and threads as content items.
 * Implements the ContentSourceAdapter interface with Slack-specific features:
 * - OAuth with content scopes (channels:history, etc.)
 * - Channel sync with incremental updates
 * - Thread aggregation
 * - User mapping
 * - Real-time webhook support
 */

import { and, eq } from 'drizzle-orm';
import { Context, Effect, Layer } from 'effect';
import type { ContentSource } from '../../../db/schema';
import {
  type NewSlackChannelSyncRecord,
  type NewSlackUser,
  type SlackChannelSyncRecord,
  type SlackContentConfig,
  type SlackFileAttachment,
  type SlackMessageMetadata,
  type SlackUser,
  slackChannelSync,
  slackUsers,
} from '../../../db/schema';
import { ContentSourceAuthError, ContentSourceSyncError, DatabaseError, UploadError } from '../../errors';
import { Database } from '../database';
import { Storage, type StorageService } from '../storage';
import type { ContentSourceAdapter, RawContentItem } from './types';

// =============================================================================
// Types
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
// Constants
// =============================================================================

const SLACK_API_BASE = 'https://slack.com/api';

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
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Storage path prefix for Slack files
 */
const SLACK_FILES_PREFIX = 'slack-files';

// =============================================================================
// File Download/Upload Helpers
// =============================================================================

/**
 * Download a file from Slack using the bot token
 */
const downloadSlackFile = async (
  fileUrl: string,
  accessToken: string,
): Promise<{ buffer: Buffer; contentType: string }> => {
  const response = await fetch(fileUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return { buffer, contentType };
};

/**
 * Generate a storage key for a Slack file
 * Format: slack-files/{sourceId}/{fileId}/{filename}
 */
const generateSlackFileKey = (sourceId: string, fileId: string, filename: string): string => {
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${SLACK_FILES_PREFIX}/${sourceId}/${fileId}/${sanitizedFilename}`;
};

/**
 * Process a single Slack file: download and upload to R2
 * Returns the file attachment with storage key if successful
 */
const processSlackFile = async (
  file: { id: string; name: string; mimetype: string; url_private: string; size: number },
  sourceId: string,
  accessToken: string,
  storage: StorageService,
): Promise<SlackFileAttachment> => {
  // Check file size limit
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      id: file.id,
      name: file.name,
      mimetype: file.mimetype,
      url: file.url_private,
      size: file.size,
      skipped: true,
      skipReason: `File exceeds ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB limit`,
    };
  }

  // Check if storage is configured
  if (!storage.isConfigured) {
    return {
      id: file.id,
      name: file.name,
      mimetype: file.mimetype,
      url: file.url_private,
      size: file.size,
      skipped: true,
      skipReason: 'Storage not configured',
    };
  }

  try {
    // Download the file from Slack
    const { buffer } = await downloadSlackFile(file.url_private, accessToken);

    // Generate storage key
    const storageKey = generateSlackFileKey(sourceId, file.id, file.name);

    // Upload to R2
    const uploadEffect = storage.uploadFile(buffer, storageKey, {
      contentType: file.mimetype,
      metadata: {
        sourceId,
        slackFileId: file.id,
        originalName: file.name,
      },
    });

    const exit = await Effect.runPromiseExit(uploadEffect);

    if (exit._tag === 'Success') {
      return {
        id: file.id,
        name: file.name,
        mimetype: file.mimetype,
        url: file.url_private,
        size: file.size,
        storageKey,
      };
    } else {
      // Upload failed, return file without storage key
      const error = exit.cause;
      return {
        id: file.id,
        name: file.name,
        mimetype: file.mimetype,
        url: file.url_private,
        size: file.size,
        skipped: true,
        skipReason: `Upload failed: ${error}`,
      };
    }
  } catch (error) {
    // Download or upload failed
    return {
      id: file.id,
      name: file.name,
      mimetype: file.mimetype,
      url: file.url_private,
      size: file.size,
      skipped: true,
      skipReason: `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};

/**
 * Process multiple Slack files concurrently
 */
const processSlackFiles = async (
  files: Array<{ id: string; name: string; mimetype: string; url_private: string; size: number }> | undefined,
  sourceId: string,
  accessToken: string,
  storage: StorageService,
  syncFiles: boolean,
): Promise<SlackFileAttachment[] | undefined> => {
  if (!files || files.length === 0) {
    return undefined;
  }

  // If syncFiles is disabled, just store metadata without downloading
  if (!syncFiles) {
    return files.map((f) => ({
      id: f.id,
      name: f.name,
      mimetype: f.mimetype,
      url: f.url_private,
      size: f.size,
      skipped: true,
      skipReason: 'File sync disabled',
    }));
  }

  // Process files concurrently (limit concurrency to avoid rate limits)
  const results = await Promise.all(files.map((file) => processSlackFile(file, sourceId, accessToken, storage)));

  return results;
};

// =============================================================================
// Slack API Helpers
// =============================================================================

const slackFetch = async <T>(endpoint: string, accessToken: string, params?: Record<string, string>): Promise<T> => {
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

// =============================================================================
// Message Conversion
// =============================================================================

/**
 * Context for processing Slack messages with file attachments
 */
interface MessageProcessingContext {
  readonly sourceId: string;
  readonly accessToken: string;
  readonly storage: StorageService;
  readonly syncFiles: boolean;
}

/**
 * Convert a Slack message to a RawContentItem
 * Optionally downloads and stores file attachments if context is provided
 */
async function messageToRawContentItem(
  message: SlackMessage,
  channel: SlackChannelInfo,
  users: Map<string, SlackUser>,
  permalink?: string,
  processingContext?: MessageProcessingContext,
): Promise<RawContentItem> {
  const user = users.get(message.user);
  const isThread = message.reply_count && message.reply_count > 0;

  // Process files if context is available
  let processedFiles: SlackFileAttachment[] | undefined;
  if (processingContext && message.files && message.files.length > 0) {
    processedFiles = await processSlackFiles(
      message.files,
      processingContext.sourceId,
      processingContext.accessToken,
      processingContext.storage,
      processingContext.syncFiles,
    );
  } else if (message.files) {
    // No processing context, just store metadata
    processedFiles = message.files.map((f) => ({
      id: f.id,
      name: f.name,
      mimetype: f.mimetype,
      url: f.url_private,
      size: f.size,
    }));
  }

  const metadata: SlackMessageMetadata = {
    channel_id: channel.id,
    channel_name: channel.name,
    channel_type: channel.is_private ? 'private' : 'public',
    message_ts: message.ts,
    thread_ts: message.thread_ts,
    reactions: message.reactions,
    files: processedFiles,
    blocks: message.blocks,
    edited: message.edited,
    reply_count: message.reply_count,
    reply_users_count: message.reply_users_count,
    latest_reply: message.latest_reply,
    permalink,
  };

  return {
    externalId: message.ts,
    type: isThread ? 'thread' : 'message',
    title: generateMessageTitle(message, channel, user),
    content: message.text,
    authorExternal: message.user,
    authorName: user?.realName || user?.displayName || message.user,
    createdAtSource: new Date(Number.parseFloat(message.ts) * 1000),
    updatedAtSource: message.edited ? new Date(Number.parseFloat(message.edited.ts) * 1000) : undefined,
    metadata,
    participants: user
      ? [
          {
            externalId: user.slackUserId,
            name: user.realName || user.displayName,
            email: user.email || undefined,
            role: 'author' as const,
          },
        ]
      : undefined,
  };
}

/**
 * Generate a title for a Slack message
 */
function generateMessageTitle(message: SlackMessage, channel: SlackChannelInfo, user?: SlackUser): string {
  const userName = user?.realName || user?.displayName || 'Unknown';
  const preview = message.text?.slice(0, 50) || '';
  const suffix = message.text && message.text.length > 50 ? '...' : '';

  if (message.reply_count && message.reply_count > 0) {
    return `Thread: ${preview}${suffix} (${message.reply_count} replies)`;
  }
  return `${userName} in #${channel.name}: ${preview}${suffix}`;
}

/**
 * Aggregate thread messages into a single content item
 * Optionally downloads and stores file attachments if context is provided
 */
async function aggregateThread(
  parentMessage: SlackMessage,
  replies: SlackMessage[],
  channel: SlackChannelInfo,
  users: Map<string, SlackUser>,
  permalink?: string,
  processingContext?: MessageProcessingContext,
): Promise<RawContentItem> {
  const allMessages = [parentMessage, ...replies.toSorted((a, b) => Number.parseFloat(a.ts) - Number.parseFloat(b.ts))];

  // Build readable content
  const contentParts = allMessages.map((msg) => {
    const user = users.get(msg.user);
    const name = user?.realName || user?.displayName || 'Unknown';
    const time = new Date(Number.parseFloat(msg.ts) * 1000).toISOString();
    return `**${name}** (${time}):\n${msg.text}`;
  });
  const content = contentParts.join('\n\n---\n\n');

  // Extract participants
  const participantIds = [...new Set(allMessages.map((m) => m.user))];
  const participants = participantIds.map((id) => {
    const user = users.get(id);
    return {
      externalId: id,
      name: user?.realName || user?.displayName || 'Unknown',
      email: user?.email || undefined,
      role: id === parentMessage.user ? ('author' as const) : ('participant' as const),
    };
  });

  // Aggregate reactions
  const allReactions: Map<string, { count: number; users: Set<string> }> = new Map();
  for (const msg of allMessages) {
    if (msg.reactions) {
      for (const reaction of msg.reactions) {
        const existing = allReactions.get(reaction.name) || { count: 0, users: new Set<string>() };
        existing.count += reaction.count;
        for (const u of reaction.users) existing.users.add(u);
        allReactions.set(reaction.name, existing);
      }
    }
  }

  // Collect all files from all messages
  const allFilesRaw = allMessages.flatMap((m) => m.files || []);

  // Process files if context is available
  let processedFiles: SlackFileAttachment[] | undefined;
  if (processingContext && allFilesRaw.length > 0) {
    processedFiles = await processSlackFiles(
      allFilesRaw,
      processingContext.sourceId,
      processingContext.accessToken,
      processingContext.storage,
      processingContext.syncFiles,
    );
  } else if (allFilesRaw.length > 0) {
    // No processing context, just store metadata
    processedFiles = allFilesRaw.map((f) => ({
      id: f.id,
      name: f.name,
      mimetype: f.mimetype,
      url: f.url_private,
      size: f.size,
    }));
  }

  const latestMessage = allMessages[allMessages.length - 1];
  const user = users.get(parentMessage.user);

  const metadata: SlackMessageMetadata = {
    channel_id: channel.id,
    channel_name: channel.name,
    channel_type: channel.is_private ? 'private' : 'public',
    message_ts: parentMessage.ts,
    thread_ts: parentMessage.ts,
    reactions: Array.from(allReactions.entries()).map(([name, data]) => ({
      name,
      count: data.count,
      users: Array.from(data.users),
    })),
    files: processedFiles,
    reply_count: replies.length,
    reply_users_count: participantIds.length,
    permalink,
  };

  return {
    externalId: parentMessage.ts,
    type: 'thread',
    title: generateThreadTitle(parentMessage, channel, user, replies.length),
    content,
    authorExternal: parentMessage.user,
    authorName: user?.realName || user?.displayName || parentMessage.user,
    createdAtSource: new Date(Number.parseFloat(parentMessage.ts) * 1000),
    updatedAtSource: new Date(Number.parseFloat(latestMessage.ts) * 1000),
    metadata,
    participants,
  };
}

/**
 * Generate a title for a thread
 */
function generateThreadTitle(
  parentMessage: SlackMessage,
  channel: SlackChannelInfo,
  user?: SlackUser,
  replyCount?: number,
): string {
  const userName = user?.realName || user?.displayName || 'Unknown';
  const preview = parentMessage.text?.slice(0, 40) || 'Discussion';
  const suffix = parentMessage.text && parentMessage.text.length > 40 ? '...' : '';
  const replySuffix = replyCount ? ` (${replyCount} replies)` : '';
  return `${userName} in #${channel.name}: ${preview}${suffix}${replySuffix}`;
}

// =============================================================================
// Slack Content Adapter Service
// =============================================================================

export interface SlackContentAdapterService extends ContentSourceAdapter {
  /**
   * List available channels from Slack
   */
  listChannels(source: ContentSource): Effect.Effect<SlackChannelInfo[], ContentSourceSyncError>;

  /**
   * Sync users from Slack workspace
   */
  syncUsers(source: ContentSource): Effect.Effect<SlackUser[], ContentSourceSyncError>;

  /**
   * Get or sync channel sync state
   */
  getChannelSyncState(sourceId: string, channelId: string): Effect.Effect<SlackChannelSyncRecord | null, DatabaseError>;

  /**
   * Update channel sync state
   */
  updateChannelSyncState(
    sourceId: string,
    channelId: string,
    update: Partial<NewSlackChannelSyncRecord>,
  ): Effect.Effect<SlackChannelSyncRecord, DatabaseError>;

  /**
   * Handle a real-time Slack event
   */
  handleEvent(
    source: ContentSource,
    event: { type: string; [key: string]: unknown },
  ): Effect.Effect<RawContentItem | null, ContentSourceSyncError>;
}

export class SlackContentAdapter extends Context.Tag('SlackContentAdapter')<
  SlackContentAdapter,
  SlackContentAdapterService
>() {}

// =============================================================================
// Service Implementation
// =============================================================================

const makeSlackContentAdapter = Effect.gen(function* () {
  const { db } = yield* Database;
  const storage = yield* Storage;

  // ==========================================================================
  // Helper Functions
  // ==========================================================================

  const getAccessToken = (source: ContentSource): string => {
    const credentials = source.credentials;
    if (!credentials?.accessToken) {
      throw new Error('No access token found for Slack source');
    }
    return credentials.accessToken;
  };

  const getSlackUsers = async (sourceId: string): Promise<Map<string, SlackUser>> => {
    const users = await db.query.slackUsers.findMany({
      where: eq(slackUsers.sourceId, sourceId),
    });
    return new Map(users.map((u) => [u.slackUserId, u]));
  };

  const fetchChannelHistory = async (
    accessToken: string,
    channelId: string,
    cursor?: string,
    oldest?: string,
    latest?: string,
    limit = 100,
  ): Promise<SlackConversationHistoryResponse> => {
    const params: Record<string, string> = {
      channel: channelId,
      limit: String(limit),
    };
    if (cursor) params.cursor = cursor;
    if (oldest) params.oldest = oldest;
    if (latest) params.latest = latest;

    return slackFetch<SlackConversationHistoryResponse>('conversations.history', accessToken, params);
  };

  const fetchThreadReplies = async (
    accessToken: string,
    channelId: string,
    threadTs: string,
    cursor?: string,
  ): Promise<SlackConversationRepliesResponse> => {
    const params: Record<string, string> = {
      channel: channelId,
      ts: threadTs,
      limit: '100',
    };
    if (cursor) params.cursor = cursor;

    return slackFetch<SlackConversationRepliesResponse>('conversations.replies', accessToken, params);
  };

  const fetchPermalink = async (accessToken: string, channelId: string, messageTs: string): Promise<string | null> => {
    try {
      const response = await slackFetch<SlackPermalinkResponse>('chat.getPermalink', accessToken, {
        channel: channelId,
        message_ts: messageTs,
      });
      return response.permalink;
    } catch {
      return null;
    }
  };

  // ==========================================================================
  // ContentSourceAdapter Interface
  // ==========================================================================

  const service: SlackContentAdapterService = {
    sourceType: 'slack',

    validateCredentials: (source) =>
      Effect.tryPromise({
        try: async () => {
          const accessToken = getAccessToken(source);
          // Try to call a simple API endpoint to verify credentials
          await slackFetch<{ ok: boolean }>('auth.test', accessToken);
          return true;
        },
        catch: () => false,
      }).pipe(Effect.catchAll(() => Effect.succeed(false))),

    fetchContent: (source, options) =>
      Effect.tryPromise({
        try: async () => {
          const accessToken = getAccessToken(source);
          const config = source.config as SlackContentConfig | undefined;
          const channelIds = config?.channels || [];

          if (channelIds.length === 0) {
            // No channels configured, return empty
            return { items: [] as RawContentItem[], hasMore: false };
          }

          // Get user mapping for name resolution
          const usersMap = await getSlackUsers(source.id);

          // Create processing context for file downloads
          const processingContext: MessageProcessingContext = {
            sourceId: source.id,
            accessToken,
            storage,
            syncFiles: config?.syncFiles !== false, // Default to true
          };

          const items: RawContentItem[] = [];
          let hasMore = false;

          // Fetch from each configured channel
          for (const channelId of channelIds) {
            // Get channel info
            let channel: SlackChannelInfo;
            try {
              const channelsResponse = await slackFetch<SlackChannelsListResponse>('conversations.info', accessToken, {
                channel: channelId,
              });
              channel = (channelsResponse as unknown as { channel: SlackChannelInfo }).channel;
            } catch {
              // Skip channel if we can't get info
              continue;
            }

            // Parse cursor (format: channelId:timestamp)
            let oldest: string | undefined;
            if (options?.cursor) {
              const [cursorChannel, cursorTs] = options.cursor.split(':');
              if (cursorChannel === channelId) {
                oldest = cursorTs;
              }
            }

            // If we have a since date, use that as oldest
            if (options?.since) {
              const sinceTs = String(options.since.getTime() / 1000);
              if (!oldest || Number.parseFloat(sinceTs) > Number.parseFloat(oldest)) {
                oldest = sinceTs;
              }
            }

            const limit = options?.limit || 50;

            // Fetch messages
            const historyResponse = await fetchChannelHistory(
              accessToken,
              channelId,
              undefined,
              oldest,
              undefined,
              limit,
            );

            hasMore = hasMore || historyResponse.has_more;

            // Process messages
            for (const message of historyResponse.messages) {
              // Skip bot messages if configured
              if (config?.excludeBots && message.bot_id) {
                continue;
              }

              // Skip subtypes like channel_join, channel_leave, etc.
              if (message.subtype && message.subtype !== 'thread_broadcast') {
                continue;
              }

              // Check for thread
              if (message.reply_count && message.reply_count > 0 && config?.syncThreads !== false) {
                // Fetch thread replies and aggregate
                const repliesResponse = await fetchThreadReplies(accessToken, channelId, message.ts);
                const replies = repliesResponse.messages.filter((m) => m.ts !== message.ts); // Remove parent
                const permalink = await fetchPermalink(accessToken, channelId, message.ts);
                const threadItem = await aggregateThread(
                  message,
                  replies,
                  channel,
                  usersMap,
                  permalink || undefined,
                  processingContext,
                );
                items.push(threadItem);
              } else {
                // Single message
                const permalink = await fetchPermalink(accessToken, channelId, message.ts);
                const item = await messageToRawContentItem(
                  message,
                  channel,
                  usersMap,
                  permalink || undefined,
                  processingContext,
                );
                items.push(item);
              }
            }
          }

          return {
            items,
            hasMore,
            nextCursor:
              hasMore && items.length > 0 ? `${channelIds[0]}:${items[items.length - 1].externalId}` : undefined,
          };
        },
        catch: (e) =>
          new ContentSourceSyncError({
            message: e instanceof Error ? e.message : 'Unknown error',
            sourceId: source.id,
            sourceType: 'slack',
            cause: e,
          }),
      }),

    fetchItem: (source, externalId) =>
      Effect.tryPromise({
        try: async () => {
          // externalId is the message timestamp
          // We need to find which channel it's in from the sync state
          const accessToken = getAccessToken(source);
          const config = source.config as SlackContentConfig | undefined;
          const channelIds = config?.channels || [];

          const usersMap = await getSlackUsers(source.id).catch(() => new Map<string, SlackUser>());

          // Create processing context for file downloads
          const processingContext: MessageProcessingContext = {
            sourceId: source.id,
            accessToken,
            storage,
            syncFiles: config?.syncFiles !== false, // Default to true
          };

          // Try each channel until we find the message
          for (const channelId of channelIds) {
            try {
              // Try to get the message as a thread parent
              const response = await fetchThreadReplies(accessToken, channelId, externalId);
              if (response.messages.length > 0) {
                const parentMessage = response.messages[0];

                // Get channel info
                const channelsResponse = await slackFetch<SlackChannelsListResponse>(
                  'conversations.info',
                  accessToken,
                  {
                    channel: channelId,
                  },
                );
                const channel = (channelsResponse as unknown as { channel: SlackChannelInfo }).channel;

                if (response.messages.length > 1) {
                  // It's a thread
                  const replies = response.messages.slice(1);
                  const permalink = await fetchPermalink(accessToken, channelId, externalId);
                  return await aggregateThread(
                    parentMessage,
                    replies,
                    channel,
                    usersMap,
                    permalink || undefined,
                    processingContext,
                  );
                } else {
                  // Single message
                  const permalink = await fetchPermalink(accessToken, channelId, externalId);
                  return await messageToRawContentItem(
                    parentMessage,
                    channel,
                    usersMap,
                    permalink || undefined,
                    processingContext,
                  );
                }
              }
            } catch {}
          }

          return null;
        },
        catch: (e) =>
          new ContentSourceSyncError({
            message: e instanceof Error ? e.message : 'Unknown error',
            sourceId: source.id,
            sourceType: 'slack',
            cause: e,
          }),
      }),

    refreshAuth: (source) =>
      Effect.gen(function* () {
        // Slack OAuth tokens don't expire, so this is a no-op
        // If we had refresh token support, we'd implement it here
        const credentials = source.credentials;
        if (!credentials?.accessToken) {
          return yield* Effect.fail(
            new ContentSourceAuthError({
              message: 'No access token found',
              sourceId: source.id,
              sourceType: 'slack',
            }),
          );
        }
        return {
          accessToken: credentials.accessToken,
          refreshToken: credentials.refreshToken,
          expiresAt: credentials.expiresAt,
        };
      }),

    // ==========================================================================
    // Slack-specific methods
    // ==========================================================================

    listChannels: (source) =>
      Effect.gen(function* () {
        const accessToken = getAccessToken(source);
        const channels: SlackChannelInfo[] = [];
        let cursor: string | undefined;

        do {
          const params: Record<string, string> = {
            types: 'public_channel,private_channel',
            exclude_archived: 'true',
            limit: '200',
          };
          if (cursor) params.cursor = cursor;

          const response = yield* Effect.tryPromise({
            try: () => slackFetch<SlackChannelsListResponse>('conversations.list', accessToken, params),
            catch: (e) =>
              new ContentSourceSyncError({
                message: `Failed to list channels: ${e instanceof Error ? e.message : 'Unknown'}`,
                sourceId: source.id,
                sourceType: 'slack',
                cause: e,
              }),
          });

          channels.push(...response.channels);
          cursor = response.response_metadata?.next_cursor;
        } while (cursor);

        return channels;
      }),

    syncUsers: (source) =>
      Effect.gen(function* () {
        const accessToken = getAccessToken(source);
        const slackUsersList: SlackUsersListResponse['members'] = [];
        let cursor: string | undefined;

        // Fetch all users from Slack
        do {
          const params: Record<string, string> = { limit: '200' };
          if (cursor) params.cursor = cursor;

          const response = yield* Effect.tryPromise({
            try: () => slackFetch<SlackUsersListResponse>('users.list', accessToken, params),
            catch: (e) =>
              new ContentSourceSyncError({
                message: `Failed to list users: ${e instanceof Error ? e.message : 'Unknown'}`,
                sourceId: source.id,
                sourceType: 'slack',
                cause: e,
              }),
          });

          slackUsersList.push(...response.members);
          cursor = response.response_metadata?.next_cursor;
        } while (cursor);

        // Upsert users to database
        const savedUsers: SlackUser[] = [];
        for (const slackUser of slackUsersList) {
          const userData: NewSlackUser = {
            sourceId: source.id,
            slackUserId: slackUser.id,
            displayName: slackUser.profile.display_name || slackUser.name,
            realName: slackUser.real_name,
            email: slackUser.profile.email,
            avatarUrl: slackUser.profile.image_48,
            isBot: slackUser.is_bot,
            isAdmin: slackUser.is_admin || false,
            timezone: slackUser.tz,
          };

          const [saved] = yield* Effect.tryPromise({
            try: async () => {
              const existing = await db.query.slackUsers.findFirst({
                where: and(eq(slackUsers.sourceId, source.id), eq(slackUsers.slackUserId, slackUser.id)),
              });

              if (existing) {
                const [updated] = await db
                  .update(slackUsers)
                  .set({ ...userData, updatedAt: new Date() })
                  .where(eq(slackUsers.id, existing.id))
                  .returning();
                return [updated];
              } else {
                const [inserted] = await db.insert(slackUsers).values(userData).returning();
                return [inserted];
              }
            },
            catch: (e) =>
              new ContentSourceSyncError({
                message: `Failed to save user: ${e instanceof Error ? e.message : 'Unknown'}`,
                sourceId: source.id,
                sourceType: 'slack',
                cause: e,
              }),
          });

          savedUsers.push(saved);
        }

        return savedUsers;
      }),

    getChannelSyncState: (sourceId, channelId) =>
      Effect.tryPromise({
        try: async () => {
          const record = await db.query.slackChannelSync.findFirst({
            where: and(eq(slackChannelSync.sourceId, sourceId), eq(slackChannelSync.channelId, channelId)),
          });
          return record || null;
        },
        catch: (e) =>
          new DatabaseError({
            message: `Failed to get channel sync state: ${e instanceof Error ? e.message : 'Unknown'}`,
            cause: e,
          }),
      }),

    updateChannelSyncState: (sourceId, channelId, update) =>
      Effect.tryPromise({
        try: async () => {
          const existing = await db.query.slackChannelSync.findFirst({
            where: and(eq(slackChannelSync.sourceId, sourceId), eq(slackChannelSync.channelId, channelId)),
          });

          if (existing) {
            const [updated] = await db
              .update(slackChannelSync)
              .set({ ...update, updatedAt: new Date() })
              .where(eq(slackChannelSync.id, existing.id))
              .returning();
            return updated;
          } else {
            const [inserted] = await db
              .insert(slackChannelSync)
              .values({
                sourceId,
                channelId,
                channelName: update.channelName || channelId,
                channelType: update.channelType || 'public',
                ...update,
              })
              .returning();
            return inserted;
          }
        },
        catch: (e) =>
          new DatabaseError({
            message: `Failed to update channel sync state: ${e instanceof Error ? e.message : 'Unknown'}`,
            cause: e,
          }),
      }),

    handleEvent: (source, event) => {
      // Handle reaction events differently as they need to call fetchItem
      if (event.type === 'reaction_added' || event.type === 'reaction_removed') {
        const item = event as unknown as { item: { channel: string; ts: string } };
        if (!item.item?.channel || !item.item?.ts) {
          return Effect.succeed(null);
        }
        // Map auth errors to sync errors for consistent error type
        return service.fetchItem(source, item.item.ts).pipe(
          Effect.mapError((e) =>
            e._tag === 'ContentSourceAuthError'
              ? new ContentSourceSyncError({
                  message: e.message,
                  sourceId: source.id,
                  sourceType: 'slack',
                  cause: e,
                })
              : e,
          ),
        );
      }

      return Effect.tryPromise({
        try: async () => {
          const accessToken = getAccessToken(source);
          const config = source.config as SlackContentConfig | undefined;
          const usersMap = await getSlackUsers(source.id).catch(() => new Map<string, SlackUser>());

          // Create processing context for file downloads
          const processingContext: MessageProcessingContext = {
            sourceId: source.id,
            accessToken,
            storage,
            syncFiles: config?.syncFiles !== false, // Default to true
          };

          switch (event.type) {
            case 'message': {
              const message = event as unknown as SlackMessage & { channel: string };
              if (!message.channel || !message.ts) return null;

              // Skip subtypes we don't care about
              if (message.subtype && message.subtype !== 'thread_broadcast') {
                return null;
              }

              // Get channel info
              let channel: SlackChannelInfo;
              try {
                const channelsResponse = await slackFetch<SlackChannelsListResponse>(
                  'conversations.info',
                  accessToken,
                  { channel: message.channel },
                );
                channel = (channelsResponse as unknown as { channel: SlackChannelInfo }).channel;
              } catch {
                return null;
              }

              const permalink = await fetchPermalink(accessToken, message.channel, message.ts);

              // If it's a thread reply, we need to re-aggregate the whole thread
              if (message.thread_ts && message.thread_ts !== message.ts) {
                const repliesResponse = await fetchThreadReplies(accessToken, message.channel, message.thread_ts);
                const parentMessage = repliesResponse.messages[0];
                const replies = repliesResponse.messages.slice(1);
                return await aggregateThread(
                  parentMessage,
                  replies,
                  channel,
                  usersMap,
                  permalink || undefined,
                  processingContext,
                );
              }

              return await messageToRawContentItem(
                message,
                channel,
                usersMap,
                permalink || undefined,
                processingContext,
              );
            }

            default:
              return null;
          }
        },
        catch: (e) =>
          new ContentSourceSyncError({
            message: e instanceof Error ? e.message : 'Unknown error',
            sourceId: source.id,
            sourceType: 'slack',
            cause: e,
          }),
      });
    },
  };

  return service;
});

// =============================================================================
// Layer
// =============================================================================

export const SlackContentAdapterLive = Layer.effect(SlackContentAdapter, makeSlackContentAdapter);

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a Slack content adapter instance
 */
export const createSlackContentAdapter = () =>
  Effect.gen(function* () {
    const adapter = yield* SlackContentAdapter;
    return adapter as ContentSourceAdapter;
  });

/**
 * Get Slack OAuth URL with content scopes
 */
export const getSlackContentAuthUrl = (clientId: string, redirectUri: string, state: string): string => {
  const scopes = SLACK_CONTENT_SCOPES.join(',');
  const params = new URLSearchParams({
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri,
    state,
  });
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
};

/**
 * Exchange Slack OAuth code for access token
 */
export const exchangeSlackCode = async (
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
): Promise<{
  access_token: string;
  token_type: string;
  scope: string;
  team: { id: string; name: string };
  authed_user: { id: string };
}> => {
  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Slack OAuth error: ${error}`);
  }

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Slack OAuth error: ${data.error || 'Unknown error'}`);
  }

  return data as {
    access_token: string;
    token_type: string;
    scope: string;
    team: { id: string; name: string };
    authed_user: { id: string };
  };
};

/**
 * Verify Slack request signature
 */
export const verifySlackSignature = (signature: string, timestamp: string, secret: string, body: string): boolean => {
  const crypto = require('node:crypto');
  const baseString = `v0:${timestamp}:${body}`;
  const expectedSignature = `v0=${crypto.createHmac('sha256', secret).update(baseString).digest('hex')}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch {
    return false;
  }
};

/**
 * Resolve Slack user mentions in text
 * Converts <@U123ABC> to @username
 */
export const resolveUserMentions = (text: string, users: Map<string, SlackUser>): string => {
  return text.replace(/<@([A-Z0-9]+)>/g, (match, userId) => {
    const user = users.get(userId);
    return user ? `@${user.displayName || user.realName || userId}` : match;
  });
};

/**
 * Resolve Slack channel mentions in text
 * Converts <#C123ABC|channel-name> to #channel-name
 */
export const resolveChannelMentions = (text: string): string => {
  return text.replace(/<#([A-Z0-9]+)\|([^>]+)>/g, '#$2');
};

/**
 * Format Slack mrkdwn to plain text
 */
export const formatSlackMrkdwn = (text: string, users: Map<string, SlackUser>): string => {
  let formatted = text;

  // Resolve mentions
  formatted = resolveUserMentions(formatted, users);
  formatted = resolveChannelMentions(formatted);

  // Convert links <url|text> to [text](url)
  formatted = formatted.replace(/<([^|>]+)\|([^>]+)>/g, '[$2]($1)');

  // Convert plain links <url> to url
  formatted = formatted.replace(/<([^>]+)>/g, '$1');

  // Convert bold *text* to **text**
  formatted = formatted.replace(/\*([^*]+)\*/g, '**$1**');

  // Convert code `text` stays as is
  // Convert code blocks ```text``` stays as is

  return formatted;
};
