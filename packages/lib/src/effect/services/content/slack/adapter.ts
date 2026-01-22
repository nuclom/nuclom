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
import { SlackClient } from '../../slack-client';
import { Storage } from '../../storage';
import type { ContentSourceAdapter, RawContentItem } from '../types';
import { slackFetch } from './api-client';
import { aggregateThread, messageToRawContentItem } from './message-converters';
import type {
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
  const slackClient = yield* SlackClient;
  const slackFetchWithClient = <T>(
    endpoint: string,
    accessToken: string,
    params?: Record<string, string | number | boolean>,
  ) => slackFetch<T>(endpoint, accessToken, params).pipe(Effect.provideService(SlackClient, slackClient));

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

  const getSlackUsers = (sourceId: string): Effect.Effect<Map<string, SlackUser>, Error> =>
    Effect.tryPromise({
      try: async () => {
        const users = await db.query.slackUsers.findMany({
          where: eq(slackUsers.sourceId, sourceId),
        });
        return new Map(users.map((u) => [u.slackUserId, u]));
      },
      catch: (error) => new Error(`Failed to fetch Slack users: ${error instanceof Error ? error.message : 'Unknown'}`),
    });

  const fetchChannelHistory = (
    accessToken: string,
    channelId: string,
    cursor?: string,
    oldest?: string,
    latest?: string,
    limit = 100,
  ): Effect.Effect<SlackConversationHistoryResponse, Error> => {
    const params: Record<string, string> = {
      channel: channelId,
      limit: String(limit),
    };
    if (cursor) params.cursor = cursor;
    if (oldest) params.oldest = oldest;
    if (latest) params.latest = latest;

    return slackFetchWithClient<SlackConversationHistoryResponse>('conversations.history', accessToken, params);
  };

  const fetchThreadReplies = (
    accessToken: string,
    channelId: string,
    threadTs: string,
    cursor?: string,
  ): Effect.Effect<SlackConversationRepliesResponse, Error> => {
    const params: Record<string, string> = {
      channel: channelId,
      ts: threadTs,
      limit: '100',
    };
    if (cursor) params.cursor = cursor;

    return slackFetchWithClient<SlackConversationRepliesResponse>('conversations.replies', accessToken, params);
  };

  const fetchPermalink = (
    accessToken: string,
    channelId: string,
    messageTs: string,
  ): Effect.Effect<string | null, never> =>
    slackFetchWithClient<SlackPermalinkResponse>('chat.getPermalink', accessToken, {
      channel: channelId,
      message_ts: messageTs,
    }).pipe(
      Effect.map((response) => response.permalink ?? null),
      Effect.catchAll(() => Effect.succeed(null)),
    );

  /**
   * Fetch all channels from Slack and build a map of channelId -> channelName
   * Used for resolving channel mentions in messages
   */
  const fetchChannelMap = (accessToken: string): Effect.Effect<Map<string, string>, never> =>
    Effect.gen(function* () {
      const channelMap = new Map<string, string>();
      let cursor: string | undefined;

      do {
        const params: Record<string, string> = {
          types: 'public_channel,private_channel',
          limit: '1000',
        };
        if (cursor) params.cursor = cursor;

        const response = yield* slackFetchWithClient<SlackChannelsListResponse>(
          'conversations.list',
          accessToken,
          params,
        );

        for (const channel of response.channels ?? []) {
          if (!channel.id) continue;
          channelMap.set(channel.id, channel.name ?? channel.id);
        }

        cursor = response.response_metadata?.next_cursor;
      } while (cursor);

      return channelMap;
    }).pipe(Effect.catchAll(() => Effect.succeed(new Map<string, string>())));

  const isSlackMessageEvent = (
    event: unknown,
  ): event is SlackMessage & { channel: string; ts: string; type: string } => {
    if (typeof event !== 'object' || event === null) {
      return false;
    }
    const record = event as Record<string, unknown>;
    return record.type === 'message' && typeof record.channel === 'string' && typeof record.ts === 'string';
  };

  const isSlackReactionEvent = (event: {
    type: string;
    [key: string]: unknown;
  }): event is { type: 'reaction_added' | 'reaction_removed'; item: { channel: string; ts: string } } =>
    (event.type === 'reaction_added' || event.type === 'reaction_removed') &&
    typeof event.item === 'object' &&
    event.item !== null &&
    typeof (event.item as { channel?: unknown }).channel === 'string' &&
    typeof (event.item as { ts?: unknown }).ts === 'string';

  // ==========================================================================
  // ContentSourceAdapter Interface
  // ==========================================================================

  const service: SlackContentAdapterService = {
    sourceType: 'slack',

    validateCredentials: (source) =>
      Effect.gen(function* () {
        const accessToken = getAccessToken(source);
        yield* slackFetchWithClient<{ ok: boolean }>('auth.test', accessToken);
        return true;
      }).pipe(Effect.catchAll(() => Effect.succeed(false))),

    fetchContent: (source, options) =>
      Effect.gen(function* () {
        const accessToken = getAccessToken(source);
        const config = source.config as SlackContentConfig | undefined;
        const channelIds = config?.channels || [];

        if (channelIds.length === 0) {
          // No channels configured, return empty
          return { items: [] as RawContentItem[], hasMore: false };
        }

        // Get user mapping for name resolution
        const usersMap = yield* getSlackUsers(source.id).pipe(
          Effect.catchAll(() => Effect.succeed(new Map<string, SlackUser>())),
        );

        // Create processing context for file downloads
        const processingContext: MessageProcessingContext = {
          sourceId: source.id,
          accessToken,
          storage,
          syncFiles: config?.syncFiles !== false, // Default to true
        };

        // Fetch channel map for resolving channel mentions
        const channelMap = yield* fetchChannelMap(accessToken);

        const items: RawContentItem[] = [];
        let hasMore = false;

        // Fetch from each configured channel
        for (const channelId of channelIds) {
          // Get channel info
          let channel: SlackChannelInfo;
          try {
            const channelsResponse = yield* slackFetchWithClient<SlackConversationInfoResponse>(
              'conversations.info',
              accessToken,
              {
                channel: channelId,
              },
            );
            if (!channelsResponse.channel) {
              continue;
            }
            channel = channelsResponse.channel;
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
          const historyResponse = yield* fetchChannelHistory(
            accessToken,
            channelId,
            undefined,
            oldest,
            undefined,
            limit,
          );

          hasMore = hasMore || (historyResponse.has_more ?? false);

          const historyMessages = historyResponse.messages ?? [];

          // Process messages
          for (const message of historyMessages) {
            if (!message.ts) {
              continue;
            }
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
              const repliesResponse = yield* fetchThreadReplies(accessToken, channelId, message.ts);
              const replies = (repliesResponse.messages ?? []).filter((m) => m.ts !== message.ts); // Remove parent
              const permalink = yield* fetchPermalink(accessToken, channelId, message.ts);
              const threadItem = yield* Effect.tryPromise({
                try: () =>
                  aggregateThread(
                    message,
                    replies,
                    channel,
                    usersMap,
                    permalink || undefined,
                    processingContext,
                    channelMap,
                  ),
                catch: (error) => (error instanceof Error ? error : new Error(String(error))),
              });
              items.push(threadItem);
            } else {
              // Single message
              const permalink = yield* fetchPermalink(accessToken, channelId, message.ts);
              const item = yield* Effect.tryPromise({
                try: () =>
                  messageToRawContentItem(
                    message,
                    channel,
                    usersMap,
                    permalink || undefined,
                    processingContext,
                    channelMap,
                  ),
                catch: (error) => (error instanceof Error ? error : new Error(String(error))),
              });
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
      }).pipe(
        Effect.mapError(
          (e) =>
            new ContentSourceSyncError({
              message: e instanceof Error ? e.message : 'Unknown error',
              sourceId: source.id,
              sourceType: 'slack',
              cause: e,
            }),
        ),
      ),

    fetchItem: (source, externalId) =>
      Effect.gen(function* () {
        // externalId is the message timestamp
        // We need to find which channel it's in from the sync state
        const accessToken = getAccessToken(source);
        const config = source.config as SlackContentConfig | undefined;
        const channelIds = config?.channels || [];

        const usersMap = yield* getSlackUsers(source.id).pipe(
          Effect.catchAll(() => Effect.succeed(new Map<string, SlackUser>())),
        );

        // Create processing context for file downloads
        const processingContext: MessageProcessingContext = {
          sourceId: source.id,
          accessToken,
          storage,
          syncFiles: config?.syncFiles !== false, // Default to true
        };

        // Fetch channel map for resolving channel mentions
        const channelMap = yield* fetchChannelMap(accessToken);

        // Try each channel until we find the message
        for (const channelId of channelIds) {
          try {
            // Try to get the message as a thread parent
            const response = yield* fetchThreadReplies(accessToken, channelId, externalId);
            const responseMessages = response.messages ?? [];
            if (responseMessages.length > 0) {
              const parentMessage = responseMessages[0];

              // Get channel info
              const channelsResponse = yield* slackFetchWithClient<SlackConversationInfoResponse>(
                'conversations.info',
                accessToken,
                {
                  channel: channelId,
                },
              );
              if (!channelsResponse.channel) {
                continue;
              }
              const channel = channelsResponse.channel;

              if (responseMessages.length > 1) {
                // It's a thread
                const replies = responseMessages.slice(1);
                const permalink = yield* fetchPermalink(accessToken, channelId, externalId);
                return yield* Effect.tryPromise({
                  try: () =>
                    aggregateThread(
                      parentMessage,
                      replies,
                      channel,
                      usersMap,
                      permalink || undefined,
                      processingContext,
                      channelMap,
                    ),
                  catch: (error) => (error instanceof Error ? error : new Error(String(error))),
                });
              } else {
                // Single message
                const permalink = yield* fetchPermalink(accessToken, channelId, externalId);
                return yield* Effect.tryPromise({
                  try: () =>
                    messageToRawContentItem(
                      parentMessage,
                      channel,
                      usersMap,
                      permalink || undefined,
                      processingContext,
                      channelMap,
                    ),
                  catch: (error) => (error instanceof Error ? error : new Error(String(error))),
                });
              }
            }
          } catch {}
        }

        return null;
      }).pipe(
        Effect.mapError(
          (e) =>
            new ContentSourceSyncError({
              message: e instanceof Error ? e.message : 'Unknown error',
              sourceId: source.id,
              sourceType: 'slack',
              cause: e,
            }),
        ),
      ),

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

          const response = yield* slackFetchWithClient<SlackChannelsListResponse>(
            'conversations.list',
            accessToken,
            params,
          ).pipe(
            Effect.mapError(
              (e) =>
                new ContentSourceSyncError({
                  message: `Failed to list channels: ${e instanceof Error ? e.message : 'Unknown'}`,
                  sourceId: source.id,
                  sourceType: 'slack',
                  cause: e,
                }),
            ),
          );

          channels.push(...(response.channels ?? []));
          cursor = response.response_metadata?.next_cursor;
        } while (cursor);

        return channels;
      }),

    syncUsers: (source) =>
      Effect.gen(function* () {
        const accessToken = getAccessToken(source);
        const slackUsersList: NonNullable<SlackUsersListResponse['members']> = [];
        let cursor: string | undefined;

        // Fetch all users from Slack
        do {
          const params: Record<string, string> = { limit: '200' };
          if (cursor) params.cursor = cursor;

          const response = yield* slackFetchWithClient<SlackUsersListResponse>('users.list', accessToken, params).pipe(
            Effect.mapError(
              (e) =>
                new ContentSourceSyncError({
                  message: `Failed to list users: ${e instanceof Error ? e.message : 'Unknown'}`,
                  sourceId: source.id,
                  sourceType: 'slack',
                  cause: e,
                }),
            ),
          );

          slackUsersList.push(...(response.members ?? []));
          cursor = response.response_metadata?.next_cursor;
        } while (cursor);

        // Upsert users to database
        const savedUsers: SlackUser[] = [];
        for (const slackUser of slackUsersList) {
          if (!slackUser.id) {
            continue;
          }
          const slackUserId = slackUser.id;
          const profile = slackUser.profile;
          const userData: NewSlackUser = {
            sourceId: source.id,
            slackUserId,
            displayName: profile?.display_name || slackUser.name || slackUser.real_name || slackUserId,
            realName: slackUser.real_name,
            email: profile?.email,
            avatarUrl: profile?.image_48,
            isBot: Boolean(slackUser.is_bot),
            isAdmin: Boolean(slackUser.is_admin),
            timezone: slackUser.tz,
          };

          const [saved] = yield* Effect.tryPromise({
            try: async () => {
              const existing = await db.query.slackUsers.findFirst({
                where: and(eq(slackUsers.sourceId, source.id), eq(slackUsers.slackUserId, slackUserId)),
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
      if (isSlackReactionEvent(event)) {
        // Map auth errors to sync errors for consistent error type
        return service.fetchItem(source, event.item.ts).pipe(
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

      return Effect.gen(function* () {
        const accessToken = getAccessToken(source);
        const config = source.config as SlackContentConfig | undefined;
        const usersMap = yield* getSlackUsers(source.id).pipe(
          Effect.catchAll(() => Effect.succeed(new Map<string, SlackUser>())),
        );

        // Create processing context for file downloads
        const processingContext: MessageProcessingContext = {
          sourceId: source.id,
          accessToken,
          storage,
          syncFiles: config?.syncFiles !== false, // Default to true
        };

        // Fetch channel map for resolving channel mentions
        const channelMap = yield* fetchChannelMap(accessToken);

        switch (event.type) {
          case 'message': {
            if (!isSlackMessageEvent(event)) return null;
            const message = event;

            // Skip subtypes we don't care about
            if (message.subtype && message.subtype !== 'thread_broadcast') {
              return null;
            }

            // Get channel info
            let channel: SlackChannelInfo;
            try {
              const channelsResponse = yield* slackFetchWithClient<SlackConversationInfoResponse>(
                'conversations.info',
                accessToken,
                { channel: message.channel },
              );
              if (!channelsResponse.channel) {
                return null;
              }
              channel = channelsResponse.channel;
            } catch {
              return null;
            }

            const permalink = yield* fetchPermalink(accessToken, message.channel, message.ts);

            // If it's a thread reply, we need to re-aggregate the whole thread
            if (message.thread_ts && message.thread_ts !== message.ts) {
              const repliesResponse = yield* fetchThreadReplies(accessToken, message.channel, message.thread_ts);
              const repliesMessages = repliesResponse.messages ?? [];
              const parentMessage = repliesMessages[0];
              if (!parentMessage) return null;
              const replies = repliesMessages.slice(1);
              return yield* Effect.tryPromise({
                try: () =>
                  aggregateThread(
                    parentMessage,
                    replies,
                    channel,
                    usersMap,
                    permalink || undefined,
                    processingContext,
                    channelMap,
                  ),
                catch: (error) => (error instanceof Error ? error : new Error(String(error))),
              });
            }

            return yield* Effect.tryPromise({
              try: () =>
                messageToRawContentItem(
                  message,
                  channel,
                  usersMap,
                  permalink || undefined,
                  processingContext,
                  channelMap,
                ),
              catch: (error) => (error instanceof Error ? error : new Error(String(error))),
            });
          }

          default:
            return null;
        }
      }).pipe(
        Effect.mapError(
          (e) =>
            new ContentSourceSyncError({
              message: e instanceof Error ? e.message : 'Unknown error',
              sourceId: source.id,
              sourceType: 'slack',
              cause: e,
            }),
        ),
      );
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
