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
import type { ContentSource } from '../../../../db/schema';
import {
  type NewSlackChannelSyncRecord,
  type NewSlackUser,
  type SlackChannelSyncRecord,
  type SlackContentConfig,
  type SlackUser,
  slackChannelSync,
  slackUsers,
} from '../../../../db/schema';
import { ContentSourceAuthError, ContentSourceSyncError, DatabaseError } from '../../../errors';
import { Database } from '../../database';
import { Storage } from '../../storage';
import type { ContentSourceAdapter, RawContentItem } from '../types';
import { slackFetch } from './api-client';
import { aggregateThread, messageToRawContentItem } from './message-converters';
import type {
  MessageProcessingContext,
  SlackChannelInfo,
  SlackChannelsListResponse,
  SlackConversationHistoryResponse,
  SlackConversationRepliesResponse,
  SlackMessage,
  SlackPermalinkResponse,
  SlackUsersListResponse,
} from './types';

// =============================================================================
// Service Interface
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

  /**
   * Fetch all channels from Slack and build a map of channelId -> channelName
   * Used for resolving channel mentions in messages
   */
  const fetchChannelMap = async (accessToken: string): Promise<Map<string, string>> => {
    const channelMap = new Map<string, string>();
    let cursor: string | undefined;

    try {
      do {
        const params: Record<string, string> = {
          types: 'public_channel,private_channel',
          limit: '1000',
        };
        if (cursor) params.cursor = cursor;

        const response = await slackFetch<SlackChannelsListResponse>('conversations.list', accessToken, params);

        for (const channel of response.channels) {
          channelMap.set(channel.id, channel.name);
        }

        cursor = response.response_metadata?.next_cursor;
      } while (cursor);
    } catch {
      // If we can't fetch channels, return empty map - mentions will fall back to IDs
    }

    return channelMap;
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

          // Fetch channel map for resolving channel mentions
          const channelMap = await fetchChannelMap(accessToken);

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
                  channelMap,
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
                  channelMap,
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

          // Fetch channel map for resolving channel mentions
          const channelMap = await fetchChannelMap(accessToken);

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
                    channelMap,
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
                    channelMap,
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

          // Fetch channel map for resolving channel mentions
          const channelMap = await fetchChannelMap(accessToken);

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
                  channelMap,
                );
              }

              return await messageToRawContentItem(
                message,
                channel,
                usersMap,
                permalink || undefined,
                processingContext,
                channelMap,
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
