/**
 * Videos Schema
 *
 * Core video-related tables including:
 * - videos: Main video metadata
 * - channels: Organization channels
 * - collections: Video collections/series
 * - videoProgresses: User watch progress
 * - videoChapters: Video chapter markers
 * - videoCodeSnippets: Code snippets in videos
 */

import { relations, sql } from 'drizzle-orm';
import { boolean, index, integer, jsonb, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { organizations, users } from './auth';
import { tsvector } from './custom-types';
import { processingStatusEnum } from './enums';

// =============================================================================
// JSONB Types
// =============================================================================

export type TranscriptSegment = {
  readonly startTime: number; // seconds
  readonly endTime: number; // seconds
  readonly text: string;
  readonly confidence?: number;
};

export type ActionItem = {
  readonly text: string;
  readonly timestamp?: number; // seconds in video
  readonly priority?: 'high' | 'medium' | 'low';
};

// =============================================================================
// Channels
// =============================================================================

export const channels = pgTable(
  'channels',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    description: text('description'),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    memberCount: integer('member_count').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('channels_organization_id_idx').on(table.organizationId)],
);

// =============================================================================
// Collections (Series)
// =============================================================================

export const collections = pgTable(
  'collections',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    description: text('description'),
    thumbnailUrl: text('thumbnail_url'),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    isPublic: boolean('is_public').default(false).notNull(),
    createdById: text('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('collections_organization_id_idx').on(table.organizationId),
    index('collections_created_by_id_idx').on(table.createdById),
  ],
);

// =============================================================================
// Videos
// =============================================================================

export const videos = pgTable(
  'videos',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    title: text('title').notNull(),
    description: text('description'),
    duration: text('duration').notNull(),
    thumbnailUrl: text('thumbnail_url'),
    videoUrl: text('video_url'),
    authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    channelId: text('channel_id').references(() => channels.id, { onDelete: 'set null' }),
    collectionId: text('collection_id').references(() => collections.id, { onDelete: 'set null' }),
    // Transcription fields
    transcript: text('transcript'),
    transcriptSegments: jsonb('transcript_segments').$type<TranscriptSegment[]>(),
    // AI Analysis fields
    processingStatus: processingStatusEnum('processing_status').default('pending').notNull(),
    processingError: text('processing_error'),
    aiSummary: text('ai_summary'),
    aiTags: jsonb('ai_tags').$type<string[]>(),
    aiActionItems: jsonb('ai_action_items').$type<ActionItem[]>(),
    // Full-text search vector (generated column)
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      sql.raw(
        "to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(transcript, ''))",
      ),
    ),
    // Soft-delete fields
    deletedAt: timestamp('deleted_at'),
    retentionUntil: timestamp('retention_until'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    organizationCreatedIdx: index('videos_organization_created_idx').on(table.organizationId, table.createdAt),
    authorIdx: index('videos_author_id_idx').on(table.authorId),
    channelIdx: index('videos_channel_id_idx').on(table.channelId),
    collectionIdx: index('videos_collection_id_idx').on(table.collectionId),
    processingStatusIdx: index('videos_processing_status_idx').on(table.processingStatus),
  }),
);

// =============================================================================
// Series Videos (Junction table)
// =============================================================================

export const seriesVideos = pgTable(
  'series_videos',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    seriesId: text('series_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    videoId: text('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    unique().on(table.seriesId, table.videoId),
    index('series_videos_series_id_idx').on(table.seriesId),
    index('series_videos_video_id_idx').on(table.videoId),
  ],
);

// =============================================================================
// Series Progress
// =============================================================================

export const seriesProgress = pgTable(
  'series_progress',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    seriesId: text('series_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    lastVideoId: text('last_video_id').references(() => videos.id, { onDelete: 'set null' }),
    lastPosition: integer('last_position').default(0).notNull(),
    completedVideoIds: jsonb('completed_video_ids').$type<string[]>().default([]).notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    unique().on(table.userId, table.seriesId),
    index('series_progress_user_id_idx').on(table.userId),
    index('series_progress_series_id_idx').on(table.seriesId),
  ],
);

// =============================================================================
// Video Progress
// =============================================================================

export const videoProgresses = pgTable(
  'video_progresses',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    videoId: text('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    currentTime: text('current_time').notNull(),
    completed: boolean('completed').default(false).notNull(),
    lastWatchedAt: timestamp('last_watched_at').defaultNow().notNull(),
  },
  (table) => [
    unique().on(table.userId, table.videoId),
    index('video_progresses_user_id_idx').on(table.userId),
    index('video_progresses_video_id_idx').on(table.videoId),
  ],
);

// =============================================================================
// Video Chapters
// =============================================================================

export const videoChapters = pgTable(
  'video_chapters',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    videoId: text('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    summary: text('summary'),
    startTime: integer('start_time').notNull(), // seconds
    endTime: integer('end_time'), // seconds
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('video_chapters_video_id_idx').on(table.videoId)],
);

// =============================================================================
// Video Code Snippets
// =============================================================================

export const videoCodeSnippets = pgTable(
  'video_code_snippets',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    videoId: text('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    language: text('language'),
    code: text('code').notNull(),
    title: text('title'),
    description: text('description'),
    timestamp: integer('timestamp'), // seconds in video
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('video_code_snippets_video_id_idx').on(table.videoId)],
);

// =============================================================================
// Watch Later
// =============================================================================

export const watchLater = pgTable(
  'watch_later',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    videoId: text('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    addedAt: timestamp('added_at').defaultNow().notNull(),
    priority: integer('priority').default(0).notNull(),
    notes: text('notes'),
  },
  (table) => ({
    uniqueUserVideo: unique().on(table.userId, table.videoId),
    userIdx: index('watch_later_user_idx').on(table.userId, table.addedAt),
  }),
);

// =============================================================================
// User Presence
// =============================================================================

export const userPresence = pgTable(
  'user_presence',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    videoId: text('video_id').references(() => videos.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    status: text('status').default('online').notNull(), // online, away, busy
    currentTime: integer('current_time'), // video timestamp in seconds
    lastSeen: timestamp('last_seen').defaultNow().notNull(),
    metadata: jsonb('metadata').$type<{ cursorPosition?: number; isTyping?: boolean }>(),
  },
  (table) => ({
    userIdx: index('user_presence_user_idx').on(table.userId),
    videoIdx: index('user_presence_video_idx').on(table.videoId),
    lastSeenIdx: index('user_presence_last_seen_idx').on(table.lastSeen),
  }),
);

// =============================================================================
// Type Exports
// =============================================================================

export type Channel = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;
export type Collection = typeof collections.$inferSelect;
export type NewCollection = typeof collections.$inferInsert;
export type Video = typeof videos.$inferSelect;
export type NewVideo = typeof videos.$inferInsert;
export type SeriesVideo = typeof seriesVideos.$inferSelect;
export type NewSeriesVideo = typeof seriesVideos.$inferInsert;
export type SeriesProgress = typeof seriesProgress.$inferSelect;
export type NewSeriesProgress = typeof seriesProgress.$inferInsert;
export type VideoProgress = typeof videoProgresses.$inferSelect;
export type NewVideoProgress = typeof videoProgresses.$inferInsert;
export type VideoChapter = typeof videoChapters.$inferSelect;
export type NewVideoChapter = typeof videoChapters.$inferInsert;
export type VideoCodeSnippet = typeof videoCodeSnippets.$inferSelect;
export type NewVideoCodeSnippet = typeof videoCodeSnippets.$inferInsert;
export type WatchLater = typeof watchLater.$inferSelect;
export type NewWatchLater = typeof watchLater.$inferInsert;
export type UserPresence = typeof userPresence.$inferSelect;
export type NewUserPresence = typeof userPresence.$inferInsert;

// =============================================================================
// Relations (forward declarations for imports from other files)
// =============================================================================

import { aiActionItems } from './ai-insights';
// Import these lazily to avoid circular dependencies
import { comments } from './comments';
import { codeLinks } from './integrations';
import { decisions } from './knowledge';
import { transcriptChunks } from './search';
import { speakerSegments, videoSpeakers } from './speakers';

export const videosRelations = relations(videos, ({ one, many }) => ({
  author: one(users, {
    fields: [videos.authorId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [videos.organizationId],
    references: [organizations.id],
  }),
  channel: one(channels, {
    fields: [videos.channelId],
    references: [channels.id],
  }),
  collection: one(collections, {
    fields: [videos.collectionId],
    references: [collections.id],
  }),
  comments: many(comments),
  videoProgresses: many(videoProgresses),
  chapters: many(videoChapters),
  codeSnippets: many(videoCodeSnippets),
  codeLinks: many(codeLinks),
  decisions: many(decisions),
  speakers: many(videoSpeakers),
  speakerSegments: many(speakerSegments),
  aiActionItems: many(aiActionItems),
  transcriptChunks: many(transcriptChunks),
}));

export const videoChaptersRelations = relations(videoChapters, ({ one }) => ({
  video: one(videos, {
    fields: [videoChapters.videoId],
    references: [videos.id],
  }),
}));

export const videoCodeSnippetsRelations = relations(videoCodeSnippets, ({ one }) => ({
  video: one(videos, {
    fields: [videoCodeSnippets.videoId],
    references: [videos.id],
  }),
}));

export const channelRelations = relations(channels, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [channels.organizationId],
    references: [organizations.id],
  }),
  videos: many(videos),
}));

export const collectionRelations = relations(collections, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [collections.organizationId],
    references: [organizations.id],
  }),
  createdBy: one(users, {
    fields: [collections.createdById],
    references: [users.id],
  }),
  videos: many(videos),
  seriesVideos: many(seriesVideos),
  seriesProgress: many(seriesProgress),
}));

export const seriesVideosRelations = relations(seriesVideos, ({ one }) => ({
  series: one(collections, {
    fields: [seriesVideos.seriesId],
    references: [collections.id],
  }),
  video: one(videos, {
    fields: [seriesVideos.videoId],
    references: [videos.id],
  }),
}));

export const seriesProgressRelations = relations(seriesProgress, ({ one }) => ({
  user: one(users, {
    fields: [seriesProgress.userId],
    references: [users.id],
  }),
  series: one(collections, {
    fields: [seriesProgress.seriesId],
    references: [collections.id],
  }),
  lastVideo: one(videos, {
    fields: [seriesProgress.lastVideoId],
    references: [videos.id],
  }),
}));

export const videoProgressRelations = relations(videoProgresses, ({ one }) => ({
  user: one(users, {
    fields: [videoProgresses.userId],
    references: [users.id],
  }),
  video: one(videos, {
    fields: [videoProgresses.videoId],
    references: [videos.id],
  }),
}));

export const watchLaterRelations = relations(watchLater, ({ one }) => ({
  user: one(users, {
    fields: [watchLater.userId],
    references: [users.id],
  }),
  video: one(videos, {
    fields: [watchLater.videoId],
    references: [videos.id],
  }),
}));

export const userPresenceRelations = relations(userPresence, ({ one }) => ({
  user: one(users, {
    fields: [userPresence.userId],
    references: [users.id],
  }),
  video: one(videos, {
    fields: [userPresence.videoId],
    references: [videos.id],
  }),
  organization: one(organizations, {
    fields: [userPresence.organizationId],
    references: [organizations.id],
  }),
}));
