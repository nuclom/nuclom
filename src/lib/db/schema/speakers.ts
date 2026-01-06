/**
 * Speaker Diarization Schema
 *
 * Tables for speaker identification and analytics:
 * - speakerProfiles: Organization speaker profiles
 * - videoSpeakers: Speakers detected in videos
 * - speakerSegments: Individual speaking segments
 * - speakerAnalytics: Aggregated speaker statistics
 */

import { relations } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { organizations, users } from './auth';
import { videos } from './videos';

// =============================================================================
// JSONB Types
// =============================================================================

export type SpeakerSegment = {
  readonly startTime: number; // seconds
  readonly endTime: number; // seconds
  readonly text: string;
  readonly speakerId: string; // references speaker_profiles.id
  readonly speakerLabel: string; // "Speaker 1", "Speaker 2", etc.
  readonly confidence?: number;
};

// =============================================================================
// Speaker Profiles
// =============================================================================

export const speakerProfiles = pgTable(
  'speaker_profiles',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    // Optional link to org member
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    displayName: text('display_name').notNull(),
    // Voice embedding for voice matching (optional, stored as JSON array)
    voiceEmbedding: jsonb('voice_embedding').$type<number[]>(),
    // Metadata for the speaker
    metadata: jsonb('metadata').$type<{
      jobTitle?: string;
      department?: string;
      avatarUrl?: string;
    }>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('speaker_profiles_org_idx').on(table.organizationId),
    index('speaker_profiles_user_idx').on(table.userId),
    unique('speaker_profiles_org_user_unique').on(table.organizationId, table.userId),
  ],
);

// =============================================================================
// Video Speakers
// =============================================================================

export const videoSpeakers = pgTable(
  'video_speakers',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    videoId: text('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    // Links to speaker profile (may be created or matched during diarization)
    speakerProfileId: text('speaker_profile_id').references(() => speakerProfiles.id, { onDelete: 'set null' }),
    // Original label from diarization ("Speaker A", "Speaker 1", etc.)
    speakerLabel: text('speaker_label').notNull(),
    // Computed stats
    totalSpeakingTime: integer('total_speaking_time').default(0).notNull(), // seconds
    segmentCount: integer('segment_count').default(0).notNull(),
    // Speaking percentage of total video duration
    speakingPercentage: integer('speaking_percentage').default(0), // 0-100
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('video_speakers_video_idx').on(table.videoId),
    index('video_speakers_profile_idx').on(table.speakerProfileId),
    unique('video_speakers_video_label_unique').on(table.videoId, table.speakerLabel),
  ],
);

// =============================================================================
// Speaker Segments
// =============================================================================

export const speakerSegments = pgTable(
  'speaker_segments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    videoId: text('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    videoSpeakerId: text('video_speaker_id')
      .notNull()
      .references(() => videoSpeakers.id, { onDelete: 'cascade' }),
    startTime: integer('start_time').notNull(), // milliseconds for precision
    endTime: integer('end_time').notNull(), // milliseconds
    transcriptText: text('transcript_text'),
    confidence: integer('confidence'), // 0-100
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('speaker_segments_video_idx').on(table.videoId),
    index('speaker_segments_speaker_idx').on(table.videoSpeakerId),
    index('speaker_segments_time_idx').on(table.videoId, table.startTime),
  ],
);

// =============================================================================
// Speaker Analytics
// =============================================================================

export const speakerAnalytics = pgTable(
  'speaker_analytics',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    speakerProfileId: text('speaker_profile_id')
      .notNull()
      .references(() => speakerProfiles.id, { onDelete: 'cascade' }),
    // Aggregation period
    periodStart: timestamp('period_start').notNull(),
    periodEnd: timestamp('period_end').notNull(),
    // Aggregated stats
    videoCount: integer('video_count').default(0).notNull(),
    totalSpeakingTime: integer('total_speaking_time').default(0).notNull(), // seconds
    avgSpeakingPercentage: integer('avg_speaking_percentage').default(0), // 0-100
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('speaker_analytics_org_period_idx').on(table.organizationId, table.periodStart),
    index('speaker_analytics_profile_idx').on(table.speakerProfileId),
    unique('speaker_analytics_profile_period_unique').on(table.speakerProfileId, table.periodStart),
  ],
);

// =============================================================================
// Type Exports
// =============================================================================

export type SpeakerProfile = typeof speakerProfiles.$inferSelect;
export type NewSpeakerProfile = typeof speakerProfiles.$inferInsert;
export type VideoSpeaker = typeof videoSpeakers.$inferSelect;
export type NewVideoSpeaker = typeof videoSpeakers.$inferInsert;
export type SpeakerSegmentRow = typeof speakerSegments.$inferSelect;
export type NewSpeakerSegmentRow = typeof speakerSegments.$inferInsert;
export type SpeakerAnalytic = typeof speakerAnalytics.$inferSelect;
export type NewSpeakerAnalytic = typeof speakerAnalytics.$inferInsert;

// =============================================================================
// Relations
// =============================================================================

export const speakerProfilesRelations = relations(speakerProfiles, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [speakerProfiles.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [speakerProfiles.userId],
    references: [users.id],
  }),
  videoSpeakers: many(videoSpeakers),
  analytics: many(speakerAnalytics),
}));

export const videoSpeakersRelations = relations(videoSpeakers, ({ one, many }) => ({
  video: one(videos, {
    fields: [videoSpeakers.videoId],
    references: [videos.id],
  }),
  speakerProfile: one(speakerProfiles, {
    fields: [videoSpeakers.speakerProfileId],
    references: [speakerProfiles.id],
  }),
  segments: many(speakerSegments),
}));

export const speakerSegmentsRelations = relations(speakerSegments, ({ one }) => ({
  video: one(videos, {
    fields: [speakerSegments.videoId],
    references: [videos.id],
  }),
  videoSpeaker: one(videoSpeakers, {
    fields: [speakerSegments.videoSpeakerId],
    references: [videoSpeakers.id],
  }),
}));

export const speakerAnalyticsRelations = relations(speakerAnalytics, ({ one }) => ({
  organization: one(organizations, {
    fields: [speakerAnalytics.organizationId],
    references: [organizations.id],
  }),
  speakerProfile: one(speakerProfiles, {
    fields: [speakerAnalytics.speakerProfileId],
    references: [speakerProfiles.id],
  }),
}));
