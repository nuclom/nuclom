/**
 * Analytics Schema
 *
 * Performance and video analytics tables:
 * - performanceMetrics: System performance tracking
 * - videoViews: Individual video view records
 * - videoAnalyticsDaily: Aggregated daily video stats
 */

import { relations } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { organizations, users } from './auth';
import { videoViewSourceEnum } from './enums';
import { videos } from './videos';

// =============================================================================
// Performance Metrics
// =============================================================================

export const performanceMetrics = pgTable(
  'performance_metrics',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    metricType: text('metric_type').notNull(), // video_load, api_response, upload_speed, etc.
    metricName: text('metric_name').notNull(),
    value: integer('value').notNull(), // milliseconds or bytes
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    videoId: text('video_id').references(() => videos.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('performance_metrics_org_type_idx').on(table.organizationId, table.metricType, table.createdAt)],
);

// =============================================================================
// Video Views
// =============================================================================

export const videoViews = pgTable(
  'video_views',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    videoId: text('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }), // null for anonymous
    sessionId: text('session_id').notNull(), // browser session fingerprint
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    watchDuration: integer('watch_duration').default(0), // seconds watched
    completionPercent: integer('completion_percent').default(0), // 0-100
    source: videoViewSourceEnum('source').default('direct'),
    referrer: text('referrer'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('video_views_video_idx').on(table.videoId),
    unique('video_views_session_video_idx').on(table.sessionId, table.videoId),
    index('video_views_org_date_idx').on(table.organizationId, table.createdAt),
  ],
);

// =============================================================================
// Video Analytics Daily
// =============================================================================

export const videoAnalyticsDaily = pgTable(
  'video_analytics_daily',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    videoId: text('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    date: timestamp('date').notNull(),
    viewCount: integer('view_count').default(0),
    uniqueViewers: integer('unique_viewers').default(0),
    totalWatchTime: integer('total_watch_time').default(0), // seconds
    avgCompletionPercent: integer('avg_completion_percent').default(0),
  },
  (table) => [unique('video_analytics_video_date_idx').on(table.videoId, table.date)],
);

// =============================================================================
// Type Exports
// =============================================================================

export type PerformanceMetric = typeof performanceMetrics.$inferSelect;
export type NewPerformanceMetric = typeof performanceMetrics.$inferInsert;
export type VideoView = typeof videoViews.$inferSelect;
export type NewVideoView = typeof videoViews.$inferInsert;
export type VideoAnalyticsDaily = typeof videoAnalyticsDaily.$inferSelect;
export type NewVideoAnalyticsDaily = typeof videoAnalyticsDaily.$inferInsert;

// =============================================================================
// Relations
// =============================================================================

export const performanceMetricsRelations = relations(performanceMetrics, ({ one }) => ({
  organization: one(organizations, {
    fields: [performanceMetrics.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [performanceMetrics.userId],
    references: [users.id],
  }),
  video: one(videos, {
    fields: [performanceMetrics.videoId],
    references: [videos.id],
  }),
}));

export const videoViewsRelations = relations(videoViews, ({ one }) => ({
  video: one(videos, {
    fields: [videoViews.videoId],
    references: [videos.id],
  }),
  user: one(users, {
    fields: [videoViews.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [videoViews.organizationId],
    references: [organizations.id],
  }),
}));

export const videoAnalyticsDailyRelations = relations(videoAnalyticsDaily, ({ one }) => ({
  video: one(videos, {
    fields: [videoAnalyticsDaily.videoId],
    references: [videos.id],
  }),
}));
