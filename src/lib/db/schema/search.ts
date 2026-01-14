/**
 * Search Schema
 *
 * Search-related tables:
 * - searchHistory: User search history
 * - savedSearches: Saved search queries
 * - transcriptChunks: Chunked transcripts for semantic search
 */

import { relations } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp, unique, vector } from 'drizzle-orm/pg-core';
import { organizations, users } from './auth';
import { videos } from './videos';

// =============================================================================
// JSONB Types
// =============================================================================

export type SearchFilters = {
  readonly types?: ReadonlyArray<'video' | 'collections'>;
  readonly authorId?: string;
  readonly collectionId?: string;
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly hasTranscript?: boolean;
  readonly hasAiSummary?: boolean;
  readonly processingStatus?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly sortBy?: 'relevance' | 'date' | 'title';
  readonly sortOrder?: 'asc' | 'desc';
};

// =============================================================================
// Search History
// =============================================================================

export const searchHistory = pgTable(
  'search_history',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    query: text('query').notNull(),
    filters: jsonb('filters').$type<SearchFilters>(),
    resultsCount: integer('results_count').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('search_history_user_org_idx').on(table.userId, table.organizationId, table.createdAt)],
);

// =============================================================================
// Saved Searches
// =============================================================================

export const savedSearches = pgTable(
  'saved_searches',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    query: text('query').notNull(),
    filters: jsonb('filters').$type<SearchFilters>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('saved_searches_user_org_idx').on(table.userId, table.organizationId),
    unique('saved_searches_user_name_unique').on(table.userId, table.organizationId, table.name),
  ],
);

// =============================================================================
// Transcript Chunks
// =============================================================================

export const transcriptChunks = pgTable(
  'transcript_chunks',
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
    chunkIndex: integer('chunk_index').notNull(),
    text: text('text').notNull(),
    tokenCount: integer('token_count'),
    timestampStart: integer('timestamp_start'), // seconds into video
    timestampEnd: integer('timestamp_end'), // seconds into video
    speakers: jsonb('speakers').$type<string[]>(), // speaker names if available
    // Embedding stored in pgvector format for similarity search
    embedding: vector('embedding', { dimensions: 1536 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('transcript_chunks_video_idx').on(table.videoId),
    index('transcript_chunks_org_idx').on(table.organizationId),
    unique('transcript_chunks_unique_index').on(table.videoId, table.chunkIndex),
  ],
);

// =============================================================================
// Type Exports
// =============================================================================

export type SearchHistory = typeof searchHistory.$inferSelect;
export type NewSearchHistory = typeof searchHistory.$inferInsert;
export type SavedSearch = typeof savedSearches.$inferSelect;
export type NewSavedSearch = typeof savedSearches.$inferInsert;
export type TranscriptChunk = typeof transcriptChunks.$inferSelect;
export type NewTranscriptChunk = typeof transcriptChunks.$inferInsert;

// =============================================================================
// Relations
// =============================================================================

export const searchHistoryRelations = relations(searchHistory, ({ one }) => ({
  user: one(users, {
    fields: [searchHistory.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [searchHistory.organizationId],
    references: [organizations.id],
  }),
}));

export const savedSearchesRelations = relations(savedSearches, ({ one }) => ({
  user: one(users, {
    fields: [savedSearches.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [savedSearches.organizationId],
    references: [organizations.id],
  }),
}));

export const transcriptChunksRelations = relations(transcriptChunks, ({ one }) => ({
  video: one(videos, {
    fields: [transcriptChunks.videoId],
    references: [videos.id],
  }),
  organization: one(organizations, {
    fields: [transcriptChunks.organizationId],
    references: [organizations.id],
  }),
}));
