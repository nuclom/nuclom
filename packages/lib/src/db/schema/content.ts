/**
 * Content Schema
 *
 * Unified content source abstraction layer for multi-source knowledge base.
 * This is the foundation for integrating multiple content sources (videos, Slack, Notion, GitHub, etc.)
 *
 * Tables:
 * - contentSources: Knowledge source connections (OAuth, API keys, etc.)
 * - contentItems: Unified content atoms (videos, messages, documents, etc.)
 * - contentChunks: Chunked content for semantic search on long content
 * - contentRelationships: Explicit links between content items
 * - contentParticipants: People involved in content (speakers, authors, etc.)
 */

import { relations } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, real, text, timestamp, unique, vector } from 'drizzle-orm/pg-core';
import { organizations, users } from './auth';
import {
  contentItemTypeEnum,
  contentParticipantRoleEnum,
  contentProcessingStatusEnum,
  contentRelationshipTypeEnum,
  contentSourceSyncStatusEnum,
  contentSourceTypeEnum,
} from './enums';

// =============================================================================
// JSONB Types
// =============================================================================

/**
 * Configuration for a content source (OAuth tokens, API settings, etc.)
 */
export type ContentSourceConfig = {
  readonly webhookUrl?: string;
  readonly syncInterval?: number; // minutes
  readonly filters?: {
    readonly channels?: string[];
    readonly users?: string[];
    readonly dateRange?: { from?: string; to?: string };
  };
  readonly settings?: Record<string, unknown>;
};

/**
 * Encrypted credentials for OAuth or API authentication
 */
export type ContentSourceCredentials = {
  readonly accessToken?: string;
  readonly refreshToken?: string;
  readonly expiresAt?: string;
  readonly apiKey?: string;
  readonly scope?: string;
};

/**
 * Metadata for content items (source-specific data)
 */
export type ContentItemMetadata = {
  // Video-specific
  readonly duration?: number;
  readonly storageKey?: string;
  readonly thumbnailKey?: string;
  readonly videoId?: string;
  // Slack-specific
  readonly channelId?: string;
  readonly channelName?: string;
  readonly threadTs?: string;
  readonly replyCount?: number;
  // Notion-specific
  readonly pageId?: string;
  readonly databaseId?: string;
  readonly parentId?: string;
  // GitHub-specific
  readonly repoOwner?: string;
  readonly repoName?: string;
  readonly issueNumber?: number;
  readonly prNumber?: number;
  // Generic
  readonly url?: string;
  readonly attachments?: Array<{ name: string; url: string; type: string }>;
  readonly reactions?: Array<{ emoji: string; count: number }>;
  readonly [key: string]: unknown;
};

/**
 * Key points extracted from content
 */
export type ContentKeyPoint = {
  readonly text: string;
  readonly timestamp?: number; // For video/audio content
  readonly confidence?: number;
};

// =============================================================================
// Content Sources
// =============================================================================

export const contentSources = pgTable(
  'content_sources',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    type: contentSourceTypeEnum('type').notNull(),
    name: text('name').notNull(),
    config: jsonb('config').$type<ContentSourceConfig>().default({}).notNull(),
    credentials: jsonb('credentials').$type<ContentSourceCredentials>(),
    syncStatus: contentSourceSyncStatusEnum('sync_status').default('idle').notNull(),
    lastSyncAt: timestamp('last_sync_at'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index('content_sources_org_idx').on(table.organizationId),
    typeIdx: index('content_sources_type_idx').on(table.type),
    syncStatusIdx: index('content_sources_sync_status_idx').on(table.syncStatus),
  }),
);

// =============================================================================
// Content Items
// =============================================================================

export const contentItems = pgTable(
  'content_items',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    sourceId: text('source_id')
      .notNull()
      .references(() => contentSources.id, { onDelete: 'cascade' }),
    type: contentItemTypeEnum('type').notNull(),
    externalId: text('external_id').notNull(), // ID in source system

    // Universal fields
    title: text('title'),
    content: text('content'), // Normalized text content (transcript, body, etc.)
    contentHtml: text('content_html'), // Original rich content
    authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
    authorExternal: text('author_external'), // External author ID (Slack user ID, etc.)
    authorName: text('author_name'),

    // Temporal
    createdAtSource: timestamp('created_at_source'),
    updatedAtSource: timestamp('updated_at_source'),

    // Metadata
    metadata: jsonb('metadata').$type<ContentItemMetadata>().default({}).notNull(),
    tags: jsonb('tags').$type<string[]>().default([]).notNull(),

    // Processing
    processingStatus: contentProcessingStatusEnum('processing_status').default('pending').notNull(),
    processingError: text('processing_error'),
    processedAt: timestamp('processed_at'),

    // AI-generated
    summary: text('summary'),
    keyPoints: jsonb('key_points').$type<ContentKeyPoint[]>().default([]).notNull(),
    sentiment: text('sentiment'), // positive, negative, neutral, mixed

    // Search - embedding for semantic search
    embeddingVector: vector('embedding_vector', { dimensions: 1536 }),
    searchText: text('search_text'), // Concatenated text for full-text search

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index('content_items_org_idx').on(table.organizationId),
    sourceIdx: index('content_items_source_idx').on(table.sourceId),
    typeIdx: index('content_items_type_idx').on(table.type),
    processingIdx: index('content_items_processing_idx').on(table.processingStatus),
    createdAtSourceIdx: index('content_items_created_at_source_idx').on(table.createdAtSource),
    authorIdx: index('content_items_author_idx').on(table.authorId),
    // Unique constraint: one item per external ID per source
    uniqueSourceExternal: unique('content_items_source_external_unique').on(table.sourceId, table.externalId),
  }),
);

// =============================================================================
// Content Chunks
// =============================================================================

export const contentChunks = pgTable(
  'content_chunks',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    contentItemId: text('content_item_id')
      .notNull()
      .references(() => contentItems.id, { onDelete: 'cascade' }),
    chunkIndex: integer('chunk_index').notNull(),
    content: text('content').notNull(),
    embeddingVector: vector('embedding_vector', { dimensions: 1536 }),

    // Context markers
    startOffset: integer('start_offset'), // Character offset in source content
    endOffset: integer('end_offset'),
    timestampStart: integer('timestamp_start'), // For video/audio (ms)
    timestampEnd: integer('timestamp_end'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    itemIdx: index('content_chunks_item_idx').on(table.contentItemId),
    uniqueItemChunk: unique('content_chunks_item_chunk_unique').on(table.contentItemId, table.chunkIndex),
  }),
);

// =============================================================================
// Content Relationships
// =============================================================================

export const contentRelationships = pgTable(
  'content_relationships',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sourceItemId: text('source_item_id')
      .notNull()
      .references(() => contentItems.id, { onDelete: 'cascade' }),
    targetItemId: text('target_item_id')
      .notNull()
      .references(() => contentItems.id, { onDelete: 'cascade' }),
    relationshipType: contentRelationshipTypeEnum('relationship_type').notNull(),
    confidence: real('confidence').default(1.0).notNull(), // AI confidence score 0-1
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    sourceIdx: index('content_relationships_source_idx').on(table.sourceItemId),
    targetIdx: index('content_relationships_target_idx').on(table.targetItemId),
    typeIdx: index('content_relationships_type_idx').on(table.relationshipType),
    uniqueRelationship: unique('content_relationships_unique').on(
      table.sourceItemId,
      table.targetItemId,
      table.relationshipType,
    ),
  }),
);

// =============================================================================
// Content Participants
// =============================================================================

export const contentParticipants = pgTable(
  'content_participants',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    contentItemId: text('content_item_id')
      .notNull()
      .references(() => contentItems.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    externalId: text('external_id'), // External user ID (Slack, GitHub, etc.)
    name: text('name').notNull(),
    email: text('email'),
    role: contentParticipantRoleEnum('role').default('participant').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    itemIdx: index('content_participants_item_idx').on(table.contentItemId),
    userIdx: index('content_participants_user_idx').on(table.userId),
    externalIdx: index('content_participants_external_idx').on(table.externalId),
  }),
);

// =============================================================================
// Type Exports
// =============================================================================

export type ContentSource = typeof contentSources.$inferSelect;
export type NewContentSource = typeof contentSources.$inferInsert;
export type ContentSourceType = ContentSource['type'];
export type ContentSourceSyncStatus = ContentSource['syncStatus'];

export type ContentItem = typeof contentItems.$inferSelect;
export type NewContentItem = typeof contentItems.$inferInsert;
export type ContentItemType = ContentItem['type'];
export type ContentProcessingStatus = ContentItem['processingStatus'];

export type ContentChunk = typeof contentChunks.$inferSelect;
export type NewContentChunk = typeof contentChunks.$inferInsert;

export type ContentRelationship = typeof contentRelationships.$inferSelect;
export type NewContentRelationship = typeof contentRelationships.$inferInsert;
export type ContentRelationshipType = ContentRelationship['relationshipType'];

export type ContentParticipant = typeof contentParticipants.$inferSelect;
export type NewContentParticipant = typeof contentParticipants.$inferInsert;
export type ContentParticipantRole = ContentParticipant['role'];

// =============================================================================
// Relations
// =============================================================================

export const contentSourcesRelations = relations(contentSources, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [contentSources.organizationId],
    references: [organizations.id],
  }),
  items: many(contentItems),
}));

export const contentItemsRelations = relations(contentItems, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [contentItems.organizationId],
    references: [organizations.id],
  }),
  source: one(contentSources, {
    fields: [contentItems.sourceId],
    references: [contentSources.id],
  }),
  author: one(users, {
    fields: [contentItems.authorId],
    references: [users.id],
  }),
  chunks: many(contentChunks),
  participants: many(contentParticipants),
  outgoingRelationships: many(contentRelationships, { relationName: 'SourceItem' }),
  incomingRelationships: many(contentRelationships, { relationName: 'TargetItem' }),
}));

export const contentChunksRelations = relations(contentChunks, ({ one }) => ({
  contentItem: one(contentItems, {
    fields: [contentChunks.contentItemId],
    references: [contentItems.id],
  }),
}));

export const contentRelationshipsRelations = relations(contentRelationships, ({ one }) => ({
  sourceItem: one(contentItems, {
    fields: [contentRelationships.sourceItemId],
    references: [contentItems.id],
    relationName: 'SourceItem',
  }),
  targetItem: one(contentItems, {
    fields: [contentRelationships.targetItemId],
    references: [contentItems.id],
    relationName: 'TargetItem',
  }),
}));

export const contentParticipantsRelations = relations(contentParticipants, ({ one }) => ({
  contentItem: one(contentItems, {
    fields: [contentParticipants.contentItemId],
    references: [contentItems.id],
  }),
  user: one(users, {
    fields: [contentParticipants.userId],
    references: [users.id],
  }),
}));
