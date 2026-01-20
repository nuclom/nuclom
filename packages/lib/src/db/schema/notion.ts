/**
 * Notion Integration Schema
 *
 * Tables for Notion content source integration:
 * - notionPageHierarchy: Track page hierarchy for navigation
 * - notionDatabaseSchemas: Store database schemas for structured queries
 * - notionUsers: Notion user mapping
 */

import { relations } from 'drizzle-orm';
import { boolean, index, integer, jsonb, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { contentSources } from './content';

// =============================================================================
// Types
// =============================================================================

/**
 * Notion content configuration stored in content_sources.config
 */
export type NotionContentConfig = {
  readonly workspaceId?: string;
  readonly rootPages?: string[]; // Top-level pages to sync recursively
  readonly databases?: string[]; // Specific databases to sync
  readonly syncComments?: boolean;
  readonly syncPrivate?: boolean; // Include private pages user has access to
  readonly maxDepth?: number; // Max hierarchy depth to follow
  readonly excludePatterns?: string[]; // Title patterns to skip
  readonly pollIntervalMinutes?: number; // Since webhooks are limited
};

/**
 * Notion page metadata stored in content_items.metadata
 */
export type NotionPageMetadata = {
  readonly page_id: string;
  readonly workspace_id?: string;
  readonly parent_type: 'workspace' | 'page' | 'database';
  readonly parent_id: string | null;
  readonly icon?: { type: 'emoji'; emoji: string } | { type: 'external'; url: string } | null;
  readonly cover?: { type: 'external'; url: string } | null;
  readonly properties?: Record<string, unknown>; // For database entries
  readonly created_by?: { id: string; name: string };
  readonly last_edited_by?: { id: string; name: string };
  readonly created_time?: string;
  readonly last_edited_time?: string;
  readonly url?: string;
  readonly breadcrumb?: string[]; // Title path for display
  readonly depth?: number;
  readonly is_database_entry?: boolean;
  readonly database_id?: string;
};

/**
 * Notion database metadata stored in content_items.metadata
 */
export type NotionDatabaseMetadata = {
  readonly database_id: string;
  readonly workspace_id?: string;
  readonly parent_type: 'workspace' | 'page';
  readonly parent_id: string | null;
  readonly schema?: Record<string, NotionPropertySchema>;
  readonly entry_count?: number;
  readonly url?: string;
};

/**
 * Notion property schema definition
 */
export type NotionPropertySchema = {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly options?: Array<{ id: string; name: string; color?: string }>;
};

// =============================================================================
// Notion Page Hierarchy
// =============================================================================

export const notionPageHierarchy = pgTable(
  'notion_page_hierarchy',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sourceId: text('source_id')
      .notNull()
      .references(() => contentSources.id, { onDelete: 'cascade' }),
    pageId: text('page_id').notNull(), // Notion page UUID
    parentId: text('parent_id'), // Parent page UUID (NULL for root)
    parentType: text('parent_type').notNull(), // 'workspace', 'page', 'database'
    depth: integer('depth').default(0).notNull(),
    path: jsonb('path').$type<string[]>().default([]).notNull(), // Array of ancestor IDs
    titlePath: jsonb('title_path').$type<string[]>().default([]).notNull(), // Array of ancestor titles (breadcrumb)
    isDatabase: boolean('is_database').default(false).notNull(),
    isArchived: boolean('is_archived').default(false).notNull(),
    lastEditedTime: timestamp('last_edited_time'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    sourceIdx: index('notion_page_hierarchy_source_idx').on(table.sourceId),
    pageIdIdx: index('notion_page_hierarchy_page_id_idx').on(table.pageId),
    parentIdx: index('notion_page_hierarchy_parent_idx').on(table.parentId),
    uniqueSourcePage: unique('notion_page_hierarchy_source_page_unique').on(table.sourceId, table.pageId),
  }),
);

// =============================================================================
// Notion Database Schemas
// =============================================================================

export const notionDatabaseSchemas = pgTable(
  'notion_database_schemas',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sourceId: text('source_id')
      .notNull()
      .references(() => contentSources.id, { onDelete: 'cascade' }),
    databaseId: text('database_id').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    schema: jsonb('schema').$type<Record<string, NotionPropertySchema>>().notNull(),
    propertyCount: integer('property_count'),
    entryCount: integer('entry_count'),
    lastSyncedAt: timestamp('last_synced_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    sourceIdx: index('notion_database_schemas_source_idx').on(table.sourceId),
    databaseIdIdx: index('notion_database_schemas_database_id_idx').on(table.databaseId),
    uniqueSourceDatabase: unique('notion_database_schemas_source_database_unique').on(table.sourceId, table.databaseId),
  }),
);

// =============================================================================
// Notion Users
// =============================================================================

export const notionUsers = pgTable(
  'notion_users',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sourceId: text('source_id')
      .notNull()
      .references(() => contentSources.id, { onDelete: 'cascade' }),
    notionUserId: text('notion_user_id').notNull(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    name: text('name'),
    avatarUrl: text('avatar_url'),
    email: text('email'),
    type: text('type'), // 'person', 'bot'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    sourceIdx: index('notion_users_source_idx').on(table.sourceId),
    notionUserIdIdx: index('notion_users_notion_user_id_idx').on(table.notionUserId),
    uniqueSourceNotionUser: unique('notion_users_source_notion_user_unique').on(table.sourceId, table.notionUserId),
  }),
);

// =============================================================================
// Type Exports
// =============================================================================

export type NotionPageHierarchyRecord = typeof notionPageHierarchy.$inferSelect;
export type NewNotionPageHierarchyRecord = typeof notionPageHierarchy.$inferInsert;

export type NotionDatabaseSchemaRecord = typeof notionDatabaseSchemas.$inferSelect;
export type NewNotionDatabaseSchemaRecord = typeof notionDatabaseSchemas.$inferInsert;

export type NotionUser = typeof notionUsers.$inferSelect;
export type NewNotionUser = typeof notionUsers.$inferInsert;

// =============================================================================
// Relations
// =============================================================================

export const notionPageHierarchyRelations = relations(notionPageHierarchy, ({ one }) => ({
  source: one(contentSources, {
    fields: [notionPageHierarchy.sourceId],
    references: [contentSources.id],
  }),
}));

export const notionDatabaseSchemasRelations = relations(notionDatabaseSchemas, ({ one }) => ({
  source: one(contentSources, {
    fields: [notionDatabaseSchemas.sourceId],
    references: [contentSources.id],
  }),
}));

export const notionUsersRelations = relations(notionUsers, ({ one }) => ({
  source: one(contentSources, {
    fields: [notionUsers.sourceId],
    references: [contentSources.id],
  }),
  user: one(users, {
    fields: [notionUsers.userId],
    references: [users.id],
  }),
}));
