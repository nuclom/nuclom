/**
 * AI Insights Schema
 *
 * Tables for AI-generated insights:
 * - aiTopics: Topic trends across organization
 * - aiActionItems: Action items extracted from videos
 */

import { relations } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { organizations, users } from './auth';
import { actionItemPriorityEnum, actionItemStatusEnum, topicTrendEnum } from './enums';
import { videos } from './videos';

// =============================================================================
// AI Topics
// =============================================================================

export const aiTopics = pgTable(
  'ai_topics',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    normalizedName: text('normalized_name').notNull(), // lowercase, trimmed for deduplication
    description: text('description'),
    // Aggregated stats
    mentionCount: integer('mention_count').default(1).notNull(),
    videoCount: integer('video_count').default(1).notNull(),
    lastMentionedAt: timestamp('last_mentioned_at').defaultNow().notNull(),
    firstMentionedAt: timestamp('first_mentioned_at').defaultNow().notNull(),
    // Trend calculation (based on recent vs older mentions)
    trend: topicTrendEnum('trend').default('stable').notNull(),
    trendScore: integer('trend_score').default(0), // -100 to 100
    // Related keywords for word cloud
    keywords: jsonb('keywords').$type<string[]>().default([]),
    // Metadata for additional context
    metadata: jsonb('metadata').$type<{
      recentVideos?: Array<{ id: string; title: string; mentionCount: number }>;
      relatedTopics?: string[];
    }>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('ai_topics_org_idx').on(table.organizationId),
    index('ai_topics_name_idx').on(table.organizationId, table.normalizedName),
    index('ai_topics_trend_idx').on(table.organizationId, table.trend),
    index('ai_topics_mention_idx').on(table.organizationId, table.mentionCount),
    unique('ai_topics_org_name_unique').on(table.organizationId, table.normalizedName),
  ],
);

// =============================================================================
// AI Action Items
// =============================================================================

export const aiActionItems = pgTable(
  'ai_action_items',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    videoId: text('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    // Action item content
    title: text('title').notNull(),
    description: text('description'),
    // Assignment and status
    assignee: text('assignee'), // Could be speaker name or user mention
    assigneeUserId: text('assignee_user_id').references(() => users.id, { onDelete: 'set null' }),
    status: actionItemStatusEnum('status').default('pending').notNull(),
    priority: actionItemPriorityEnum('priority').default('medium').notNull(),
    // Timing
    dueDate: timestamp('due_date'),
    completedAt: timestamp('completed_at'),
    completedById: text('completed_by_id').references(() => users.id, { onDelete: 'set null' }),
    // Video context
    timestampStart: integer('timestamp_start'), // seconds into video
    timestampEnd: integer('timestamp_end'),
    // AI extraction metadata
    confidence: integer('confidence'), // 0-100
    extractedFrom: text('extracted_from'), // transcript snippet
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('ai_action_items_org_idx').on(table.organizationId, table.status),
    index('ai_action_items_video_idx').on(table.videoId),
    index('ai_action_items_assignee_idx').on(table.assigneeUserId),
    index('ai_action_items_status_idx').on(table.status, table.priority),
    index('ai_action_items_due_date_idx').on(table.dueDate),
  ],
);

// =============================================================================
// Type Exports
// =============================================================================

export type AiTopic = typeof aiTopics.$inferSelect;
export type NewAiTopic = typeof aiTopics.$inferInsert;
export type AiActionItem = typeof aiActionItems.$inferSelect;
export type NewAiActionItem = typeof aiActionItems.$inferInsert;

// =============================================================================
// Relations
// =============================================================================

export const aiTopicsRelations = relations(aiTopics, ({ one }) => ({
  organization: one(organizations, {
    fields: [aiTopics.organizationId],
    references: [organizations.id],
  }),
}));

export const aiActionItemsRelations = relations(aiActionItems, ({ one }) => ({
  organization: one(organizations, {
    fields: [aiActionItems.organizationId],
    references: [organizations.id],
  }),
  video: one(videos, {
    fields: [aiActionItems.videoId],
    references: [videos.id],
  }),
  assigneeUser: one(users, {
    fields: [aiActionItems.assigneeUserId],
    references: [users.id],
    relationName: 'ActionItemAssignee',
  }),
  completedBy: one(users, {
    fields: [aiActionItems.completedById],
    references: [users.id],
    relationName: 'ActionItemCompletedBy',
  }),
}));
