/**
 * Video Sharing Schema
 *
 * Tables for video sharing functionality:
 * - videoShareLinks: Shareable video links with access controls
 */

import { relations } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { videoShareLinkAccessEnum, videoShareLinkStatusEnum } from "./enums";
import { videos } from "./videos";

// =============================================================================
// Video Share Links
// =============================================================================

export const videoShareLinks = pgTable(
  "video_share_links",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Access control
    accessLevel: videoShareLinkAccessEnum("access_level").notNull().default("view"),
    password: text("password"), // hashed, null = no password
    // Limits
    expiresAt: timestamp("expires_at"), // null = never expires
    maxViews: integer("max_views"), // null = unlimited
    viewCount: integer("view_count").default(0),
    // Status
    status: videoShareLinkStatusEnum("status").default("active"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastAccessedAt: timestamp("last_accessed_at"),
  },
  (table) => [
    index("video_share_links_video_idx").on(table.videoId),
    index("video_share_links_status_idx").on(table.status),
  ],
);

// =============================================================================
// Type Exports
// =============================================================================

export type VideoShareLink = typeof videoShareLinks.$inferSelect;
export type NewVideoShareLink = typeof videoShareLinks.$inferInsert;

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
