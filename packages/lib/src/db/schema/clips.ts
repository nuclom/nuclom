/**
 * Video Clips Schema
 *
 * Tables for video clipping and highlights:
 * - videoMoments: AI-detected key moments
 * - videoClips: Extracted video segments
 * - highlightReels: Composed highlight reels
 */

import { relations } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { organizations, users } from './auth';
import { clipStatusEnum, clipTypeEnum, highlightReelStatusEnum, momentTypeEnum } from './enums';
import { videos } from './videos';

// =============================================================================
// JSONB Types
// =============================================================================

export type ClipMetadata = {
  readonly confidence?: number;
  readonly transcriptExcerpt?: string;
  readonly keywords?: readonly string[];
  readonly speakerInfo?: {
    readonly name?: string;
    readonly speakerSegments?: ReadonlyArray<{ startTime: number; endTime: number }>;
  };
};

export type HighlightReelTransition = {
  readonly type: 'fade' | 'crossfade' | 'cut' | 'wipe';
  readonly durationMs: number;
};

export type HighlightReelConfig = {
  readonly transitions?: HighlightReelTransition;
  readonly backgroundMusicId?: string;
  readonly backgroundMusicVolume?: number;
  readonly introTemplate?: string;
  readonly outroTemplate?: string;
};

// =============================================================================
// Video Moments
// =============================================================================

export const videoMoments = pgTable(
  'video_moments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    videoId: text('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    startTime: integer('start_time').notNull(), // seconds
    endTime: integer('end_time').notNull(), // seconds
    momentType: momentTypeEnum('moment_type').notNull(),
    confidence: integer('confidence').notNull().default(0), // 0-100 percentage
    transcriptExcerpt: text('transcript_excerpt'),
    metadata: jsonb('metadata').$type<ClipMetadata>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('video_moments_video_idx').on(table.videoId),
    index('video_moments_video_start_idx').on(table.videoId, table.startTime),
    index('video_moments_type_idx').on(table.momentType),
  ],
);

// =============================================================================
// Video Clips
// =============================================================================

export const videoClips = pgTable(
  'video_clips',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    videoId: text('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    // Source moment (optional - null for manual clips)
    momentId: text('moment_id').references(() => videoMoments.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    description: text('description'),
    startTime: integer('start_time').notNull(), // seconds
    endTime: integer('end_time').notNull(), // seconds
    clipType: clipTypeEnum('clip_type').notNull().default('manual'),
    momentType: momentTypeEnum('moment_type'),
    // Storage
    storageKey: text('storage_key'), // R2 path for generated clip
    thumbnailUrl: text('thumbnail_url'),
    // Processing
    status: clipStatusEnum('status').notNull().default('pending'),
    processingError: text('processing_error'),
    // Metadata
    transcriptExcerpt: text('transcript_excerpt'),
    metadata: jsonb('metadata').$type<ClipMetadata>(),
    // Ownership
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('video_clips_video_idx').on(table.videoId),
    index('video_clips_video_created_idx').on(table.videoId, table.createdAt),
    index('video_clips_status_idx').on(table.status),
    index('video_clips_org_idx').on(table.organizationId),
  ],
);

// =============================================================================
// Highlight Reels
// =============================================================================

export const highlightReels = pgTable(
  'highlight_reels',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    // Clips in order
    clipIds: jsonb('clip_ids').$type<string[]>().notNull().default([]),
    // Storage
    storageKey: text('storage_key'), // R2 path for rendered reel
    thumbnailUrl: text('thumbnail_url'),
    duration: integer('duration'), // total duration in seconds
    // Processing
    status: highlightReelStatusEnum('status').notNull().default('draft'),
    processingError: text('processing_error'),
    // Configuration
    config: jsonb('config').$type<HighlightReelConfig>(),
    // Ownership
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('highlight_reels_org_idx').on(table.organizationId),
    index('highlight_reels_status_idx').on(table.status),
    index('highlight_reels_created_by_idx').on(table.createdBy),
  ],
);

// =============================================================================
// Type Exports
// =============================================================================

export type VideoMoment = typeof videoMoments.$inferSelect;
export type NewVideoMoment = typeof videoMoments.$inferInsert;
export type VideoClip = typeof videoClips.$inferSelect;
export type NewVideoClip = typeof videoClips.$inferInsert;
export type HighlightReel = typeof highlightReels.$inferSelect;
export type NewHighlightReel = typeof highlightReels.$inferInsert;

// =============================================================================
// Relations
// =============================================================================

export const videoMomentsRelations = relations(videoMoments, ({ one, many }) => ({
  video: one(videos, {
    fields: [videoMoments.videoId],
    references: [videos.id],
  }),
  organization: one(organizations, {
    fields: [videoMoments.organizationId],
    references: [organizations.id],
  }),
  clips: many(videoClips),
}));

export const videoClipsRelations = relations(videoClips, ({ one }) => ({
  video: one(videos, {
    fields: [videoClips.videoId],
    references: [videos.id],
  }),
  organization: one(organizations, {
    fields: [videoClips.organizationId],
    references: [organizations.id],
  }),
  moment: one(videoMoments, {
    fields: [videoClips.momentId],
    references: [videoMoments.id],
  }),
  creator: one(users, {
    fields: [videoClips.createdBy],
    references: [users.id],
  }),
}));

export const highlightReelsRelations = relations(highlightReels, ({ one }) => ({
  organization: one(organizations, {
    fields: [highlightReels.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [highlightReels.createdBy],
    references: [users.id],
  }),
}));
