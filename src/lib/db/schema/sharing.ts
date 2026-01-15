/**
 * Video Sharing Schema
 *
 * Tables for video sharing functionality:
 * - videoShareLinks: Shareable video links with access controls
 * - videoShares: Direct sharing of private videos with specific users or teams
 */

import { relations } from 'drizzle-orm';
import { index, integer, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { teams, users } from './auth';
import { videoShareLinkAccessEnum, videoShareLinkStatusEnum } from './enums';
import { videos } from './videos';

// =============================================================================
// Video Share Links
// =============================================================================

export const videoShareLinks = pgTable(
  'video_share_links',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    videoId: text('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Access control
    accessLevel: videoShareLinkAccessEnum('access_level').notNull().default('view'),
    password: text('password'), // hashed, null = no password
    // Limits
    expiresAt: timestamp('expires_at'), // null = never expires
    maxViews: integer('max_views'), // null = unlimited
    viewCount: integer('view_count').default(0),
    // Status
    status: videoShareLinkStatusEnum('status').default('active'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    lastAccessedAt: timestamp('last_accessed_at'),
  },
  (table) => [
    index('video_share_links_video_idx').on(table.videoId),
    index('video_share_links_status_idx').on(table.status),
  ],
);

// =============================================================================
// Video Shares (Direct sharing with users/teams)
// =============================================================================

/**
 * Direct video sharing for private videos.
 * Each record grants access to either a specific user OR a team (mutually exclusive).
 * Used when video visibility is 'private' to grant access to specific parties.
 */
export const videoShares = pgTable(
  'video_shares',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    videoId: text('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    // Either userId OR teamId should be set, not both
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    teamId: text('team_id').references(() => teams.id, { onDelete: 'cascade' }),
    // Access level for this share
    accessLevel: videoShareLinkAccessEnum('access_level').notNull().default('view'),
    // Who created this share
    sharedBy: text('shared_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('video_shares_video_idx').on(table.videoId),
    index('video_shares_user_idx').on(table.userId),
    index('video_shares_team_idx').on(table.teamId),
    // Ensure unique share per user per video
    unique('video_shares_video_user_unique').on(table.videoId, table.userId),
    // Ensure unique share per team per video
    unique('video_shares_video_team_unique').on(table.videoId, table.teamId),
  ],
);

// =============================================================================
// Type Exports
// =============================================================================

export type VideoShareLink = typeof videoShareLinks.$inferSelect;
export type NewVideoShareLink = typeof videoShareLinks.$inferInsert;
export type VideoShare = typeof videoShares.$inferSelect;
export type NewVideoShare = typeof videoShares.$inferInsert;

// =============================================================================
// Relations
// =============================================================================

export const videoShareLinksRelations = relations(videoShareLinks, ({ one }) => ({
  video: one(videos, {
    fields: [videoShareLinks.videoId],
    references: [videos.id],
  }),
  creator: one(users, {
    fields: [videoShareLinks.createdBy],
    references: [users.id],
  }),
}));

export const videoSharesRelations = relations(videoShares, ({ one }) => ({
  video: one(videos, {
    fields: [videoShares.videoId],
    references: [videos.id],
  }),
  user: one(users, {
    fields: [videoShares.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [videoShares.teamId],
    references: [teams.id],
  }),
  sharedByUser: one(users, {
    fields: [videoShares.sharedBy],
    references: [users.id],
  }),
}));
