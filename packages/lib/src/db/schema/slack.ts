/**
 * Slack Integration Schema
 *
 * Tables for Slack content source integration:
 * - slackUsers: User mapping for identity resolution
 * - slackChannelSync: Track sync state per channel
 */

import { relations } from 'drizzle-orm';
import { boolean, index, integer, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { contentSources } from './content';

// =============================================================================
// Types
// =============================================================================

/**
 * Slack content configuration stored in content_sources.config
 */
export type SlackContentConfig = {
  readonly channels?: string[]; // Channel IDs to sync
  readonly syncPrivate?: boolean;
  readonly syncThreads?: boolean;
  readonly syncFiles?: boolean;
  readonly excludeBots?: boolean;
  readonly excludePatterns?: string[]; // Regex patterns to exclude
  readonly lookbackDays?: number; // Initial sync period
};

/**
 * File attachment metadata stored in Slack message metadata
 */
export type SlackFileAttachment = {
  readonly id: string;
  readonly name: string;
  readonly mimetype: string;
  readonly url: string; // Original Slack URL (requires auth)
  readonly size: number;
  readonly storageKey?: string; // R2 storage key (if downloaded)
  readonly skipped?: boolean; // True if file was too large to download
  readonly skipReason?: string; // Reason for skipping (e.g., "File exceeds 10MB limit")
};

/**
 * Slack message metadata stored in content_items.metadata
 */
export type SlackMessageMetadata = {
  readonly channel_id: string;
  readonly channel_name: string;
  readonly channel_type: 'public' | 'private' | 'dm' | 'mpim';
  readonly message_ts: string; // Slack timestamp (unique ID)
  readonly thread_ts?: string; // Parent thread timestamp
  readonly parent_ts?: string; // If this is a reply
  readonly reactions?: Array<{ name: string; count: number; users: string[] }>;
  readonly files?: SlackFileAttachment[];
  readonly blocks?: unknown[]; // Original Slack blocks for rich rendering
  readonly edited?: { user: string; ts: string };
  readonly reply_count?: number;
  readonly reply_users_count?: number;
  readonly latest_reply?: string;
  readonly is_pinned?: boolean;
  readonly permalink?: string;
};

// =============================================================================
// Slack Users
// =============================================================================

export const slackUsers = pgTable(
  'slack_users',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sourceId: text('source_id')
      .notNull()
      .references(() => contentSources.id, { onDelete: 'cascade' }),
    slackUserId: text('slack_user_id').notNull(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }), // Linked Nuclom user
    displayName: text('display_name').notNull(),
    realName: text('real_name'),
    email: text('email'),
    avatarUrl: text('avatar_url'),
    isBot: boolean('is_bot').default(false).notNull(),
    isAdmin: boolean('is_admin').default(false).notNull(),
    timezone: text('timezone'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    sourceIdx: index('slack_users_source_idx').on(table.sourceId),
    slackUserIdIdx: index('slack_users_slack_user_id_idx').on(table.slackUserId),
    emailIdx: index('slack_users_email_idx').on(table.email),
    uniqueSourceSlackUser: unique('slack_users_source_slack_user_unique').on(table.sourceId, table.slackUserId),
  }),
);

// =============================================================================
// Slack Channel Sync
// =============================================================================

export const slackChannelSync = pgTable(
  'slack_channel_sync',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sourceId: text('source_id')
      .notNull()
      .references(() => contentSources.id, { onDelete: 'cascade' }),
    channelId: text('channel_id').notNull(),
    channelName: text('channel_name').notNull(),
    channelType: text('channel_type').notNull(), // 'public', 'private', 'dm', 'mpim'
    isMember: boolean('is_member').default(true).notNull(),
    isArchived: boolean('is_archived').default(false).notNull(),
    isSyncing: boolean('is_syncing').default(false).notNull(),
    syncEnabled: boolean('sync_enabled').default(true).notNull(),
    lastMessageTs: text('last_message_ts'), // Cursor for incremental sync
    oldestMessageTs: text('oldest_message_ts'), // How far back we've synced
    lastSyncAt: timestamp('last_sync_at'),
    messageCount: integer('message_count').default(0).notNull(),
    memberCount: integer('member_count'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    sourceIdx: index('slack_channel_sync_source_idx').on(table.sourceId),
    channelIdIdx: index('slack_channel_sync_channel_id_idx').on(table.channelId),
    uniqueSourceChannel: unique('slack_channel_sync_source_channel_unique').on(table.sourceId, table.channelId),
  }),
);

// =============================================================================
// Type Exports
// =============================================================================

export type SlackUser = typeof slackUsers.$inferSelect;
export type NewSlackUser = typeof slackUsers.$inferInsert;

export type SlackChannelSyncRecord = typeof slackChannelSync.$inferSelect;
export type NewSlackChannelSyncRecord = typeof slackChannelSync.$inferInsert;

// =============================================================================
// Relations
// =============================================================================

export const slackUsersRelations = relations(slackUsers, ({ one }) => ({
  source: one(contentSources, {
    fields: [slackUsers.sourceId],
    references: [contentSources.id],
  }),
  user: one(users, {
    fields: [slackUsers.userId],
    references: [users.id],
  }),
}));

export const slackChannelSyncRelations = relations(slackChannelSync, ({ one }) => ({
  source: one(contentSources, {
    fields: [slackChannelSync.sourceId],
    references: [contentSources.id],
  }),
}));
