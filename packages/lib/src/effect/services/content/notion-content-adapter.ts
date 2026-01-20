/**
 * Notion Content Adapter
 *
 * Adapter that ingests Notion pages, databases, and wikis as content items.
 * Implements the ContentSourceAdapter interface with Notion-specific features:
 * - OAuth integration
 * - Page hierarchy preservation
 * - Block-to-text conversion
 * - Database entry processing
 * - Incremental polling (webhooks limited)
 */

import { and, eq } from 'drizzle-orm';
import { Context, Effect, Layer } from 'effect';
import type { ContentSource } from '../../../db/schema';
import {
  type NewNotionDatabaseSchemaRecord,
  type NewNotionPageHierarchyRecord,
  type NewNotionUser,
  type NotionContentConfig,
  type NotionDatabaseSchemaRecord,
  type NotionPageHierarchyRecord,
  type NotionPageMetadata,
  type NotionPropertySchema,
  type NotionUser,
  notionDatabaseSchemas,
  notionPageHierarchy,
  notionUsers,
} from '../../../db/schema';
import { ContentSourceAuthError, ContentSourceSyncError, DatabaseError } from '../../errors';
import { Database } from '../database';
import type { ContentSourceAdapter, RawContentItem } from './types';

// =============================================================================
// Notion API Types
// =============================================================================

interface NotionBlock {
  id: string;
  type: string;
  has_children: boolean;
  [key: string]: unknown;
}

interface NotionRichText {
  type: 'text' | 'mention' | 'equation';
  plain_text: string;
  href: string | null;
  annotations: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
    color: string;
  };
}

interface NotionPage {
  id: string;
  object: 'page';
  parent: { type: string; page_id?: string; database_id?: string; workspace?: boolean };
  created_time: string;
  last_edited_time: string;
  created_by: { id: string };
  last_edited_by: { id: string };
  archived: boolean;
  url: string;
  icon?: { type: 'emoji'; emoji: string } | { type: 'external'; external: { url: string } };
  cover?: { type: 'external'; external: { url: string } };
  properties: Record<string, NotionProperty>;
}

interface NotionDatabase {
  id: string;
  object: 'database';
  title: NotionRichText[];
  description: NotionRichText[];
  parent: { type: string; page_id?: string; workspace?: boolean };
  created_time: string;
  last_edited_time: string;
  url: string;
  properties: Record<string, NotionPropertyDefinition>;
}

interface NotionProperty {
  id: string;
  type: string;
  [key: string]: unknown;
}

interface NotionPropertyDefinition {
  id: string;
  name: string;
  type: string;
  [key: string]: unknown;
}

interface NotionApiUser {
  id: string;
  object: 'user';
  type?: 'person' | 'bot';
  name?: string;
  avatar_url?: string;
  person?: { email: string };
}

interface NotionSearchResponse {
  results: Array<NotionPage | NotionDatabase>;
  has_more: boolean;
  next_cursor: string | null;
}

interface NotionBlocksResponse {
  results: NotionBlock[];
  has_more: boolean;
  next_cursor: string | null;
}

interface NotionDatabaseQueryResponse {
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
}

interface NotionComment {
  id: string;
  parent: { type: 'page_id' | 'block_id'; page_id?: string; block_id?: string };
  discussion_id: string;
  created_time: string;
  last_edited_time: string;
  created_by: { id: string };
  rich_text: NotionRichText[];
}

interface NotionCommentsResponse {
  results: NotionComment[];
  has_more: boolean;
  next_cursor: string | null;
}

// =============================================================================
// Constants
// =============================================================================

const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_API_VERSION = '2022-06-28';

// =============================================================================
// Notion API Helpers
// =============================================================================

const notionFetch = async <T>(
  endpoint: string,
  accessToken: string,
  options?: { method?: string; body?: unknown },
): Promise<T> => {
  const response = await fetch(`${NOTION_API_BASE}${endpoint}`, {
    method: options?.method || 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Notion-Version': NOTION_API_VERSION,
      'Content-Type': 'application/json',
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Notion API error: ${response.status} - ${error}`);
  }

  return (await response.json()) as T;
};

// =============================================================================
// Block-to-Text Conversion
// =============================================================================

/**
 * Convert Notion rich text array to plain text
 */
function richTextToPlain(richText: NotionRichText[]): string {
  return richText
    .map((item) => {
      let text = item.plain_text;

      // Preserve some formatting hints
      if (item.annotations.bold) text = `**${text}**`;
      if (item.annotations.italic) text = `_${text}_`;
      if (item.annotations.code) text = `\`${text}\``;
      if (item.annotations.strikethrough) text = `~~${text}~~`;

      // Handle links
      if (item.href) text = `[${text}](${item.href})`;

      return text;
    })
    .join('');
}

/**
 * Convert a single Notion block to text
 */
function convertBlock(block: NotionBlock): string {
  const type = block.type;
  const data = block[type] as Record<string, unknown> | undefined;

  if (!data) return '';

  switch (type) {
    case 'paragraph':
      return richTextToPlain((data.rich_text as NotionRichText[]) || []);

    case 'heading_1':
      return `# ${richTextToPlain((data.rich_text as NotionRichText[]) || [])}`;
    case 'heading_2':
      return `## ${richTextToPlain((data.rich_text as NotionRichText[]) || [])}`;
    case 'heading_3':
      return `### ${richTextToPlain((data.rich_text as NotionRichText[]) || [])}`;

    case 'bulleted_list_item':
      return `• ${richTextToPlain((data.rich_text as NotionRichText[]) || [])}`;
    case 'numbered_list_item':
      return `1. ${richTextToPlain((data.rich_text as NotionRichText[]) || [])}`;
    case 'to_do': {
      const checked = (data.checked as boolean) ? '[x]' : '[ ]';
      return `${checked} ${richTextToPlain((data.rich_text as NotionRichText[]) || [])}`;
    }

    case 'code': {
      const language = (data.language as string) || '';
      return `\`\`\`${language}\n${richTextToPlain((data.rich_text as NotionRichText[]) || [])}\n\`\`\``;
    }

    case 'quote':
      return `> ${richTextToPlain((data.rich_text as NotionRichText[]) || [])}`;

    case 'callout': {
      const icon = (data.icon as { emoji?: string })?.emoji || 'i';
      return `[${icon}] ${richTextToPlain((data.rich_text as NotionRichText[]) || [])}`;
    }

    case 'toggle':
      return richTextToPlain((data.rich_text as NotionRichText[]) || []);

    case 'divider':
      return '---';

    case 'child_page':
      return `[${(data.title as string) || 'Page'}]`;

    case 'child_database':
      return `[${(data.title as string) || 'Database'}]`;

    case 'image': {
      const caption = (data.caption as NotionRichText[])?.length
        ? richTextToPlain(data.caption as NotionRichText[])
        : 'Image';
      return `[Image: ${caption}]`;
    }

    case 'bookmark':
      return `[${(data.url as string) || 'Bookmark'}]`;

    case 'equation':
      return `$$${(data.expression as string) || ''}$$`;

    case 'table_of_contents':
      return '[Table of Contents]';

    case 'breadcrumb':
      return '[Breadcrumb]';

    case 'column_list':
    case 'column':
      return ''; // Container blocks, content comes from children

    case 'synced_block':
      return ''; // Content comes from children

    case 'template':
      return ''; // Template blocks

    case 'link_preview':
      return `[${(data.url as string) || 'Link'}]`;

    case 'file':
    case 'pdf': {
      const file = data.file as { url: string } | undefined;
      const external = data.external as { url: string } | undefined;
      const url = file?.url || external?.url || '';
      const name = (data.name as string) || 'File';
      return `[${name}](${url})`;
    }

    case 'video':
    case 'audio':
    case 'embed': {
      const url = (data.external as { url: string })?.url || '';
      return `[${type}: ${url}]`;
    }

    default:
      return '';
  }
}

/**
 * Convert all Notion blocks to text
 */
function notionBlocksToText(blocks: NotionBlock[]): string {
  return blocks
    .map((block) => convertBlock(block))
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Extract page title from properties
 */
function extractPageTitle(properties: Record<string, NotionProperty>): string {
  // Find the title property
  for (const prop of Object.values(properties)) {
    if (prop.type === 'title') {
      const titleValue = prop.title as NotionRichText[] | undefined;
      if (titleValue) {
        return richTextToPlain(titleValue);
      }
    }
  }
  return 'Untitled';
}

/**
 * Extract property value from Notion property
 */
function extractPropertyValue(prop: NotionProperty): unknown {
  const type = prop.type;
  const data = prop[type];

  switch (type) {
    case 'title':
    case 'rich_text':
      return richTextToPlain((data as NotionRichText[]) || []);
    case 'number':
      return data;
    case 'select':
      return (data as { name: string } | null)?.name;
    case 'multi_select':
      return (data as Array<{ name: string }>)?.map((s) => s.name);
    case 'date':
      return (data as { start: string } | null)?.start;
    case 'checkbox':
      return data;
    case 'url':
    case 'email':
    case 'phone_number':
      return data;
    case 'people':
      return (data as Array<{ name?: string; id: string }>)?.map((p) => p.name || p.id);
    case 'files':
      return (data as Array<{ name: string }>)?.map((f) => f.name);
    case 'relation':
      return (data as Array<{ id: string }>)?.map((r) => r.id);
    case 'status':
      return (data as { name: string } | null)?.name;
    case 'formula':
      return (data as { string?: string; number?: number })?.string ?? (data as { number?: number })?.number;
    case 'rollup':
      return (data as { string?: string; number?: number })?.string ?? (data as { number?: number })?.number;
    case 'created_time':
    case 'last_edited_time':
      return data;
    case 'created_by':
    case 'last_edited_by':
      return (data as { name?: string; id: string })?.name || (data as { id: string })?.id;
    default:
      return null;
  }
}

// =============================================================================
// Content Conversion
// =============================================================================

/**
 * Convert a Notion page to a RawContentItem
 */
function pageToRawContentItem(page: NotionPage, content: string, breadcrumb: string[], depth: number): RawContentItem {
  const title = extractPageTitle(page.properties);

  const metadata: NotionPageMetadata = {
    page_id: page.id,
    parent_type: page.parent.type as 'workspace' | 'page' | 'database',
    parent_id: page.parent.page_id || page.parent.database_id || null,
    icon: page.icon
      ? page.icon.type === 'emoji'
        ? { type: 'emoji', emoji: page.icon.emoji }
        : { type: 'external', url: page.icon.external.url }
      : null,
    cover: page.cover ? { type: 'external', url: page.cover.external.url } : null,
    created_time: page.created_time,
    last_edited_time: page.last_edited_time,
    created_by: { id: page.created_by.id, name: '' },
    last_edited_by: { id: page.last_edited_by.id, name: '' },
    url: page.url,
    breadcrumb,
    depth,
    is_database_entry: page.parent.type === 'database',
    database_id: page.parent.database_id,
  };

  return {
    externalId: page.id,
    type: 'document',
    title,
    content,
    authorExternal: page.created_by.id,
    createdAtSource: new Date(page.created_time),
    updatedAtSource: new Date(page.last_edited_time),
    metadata,
  };
}

/**
 * Convert a Notion database entry to a RawContentItem
 */
function databaseEntryToRawContentItem(
  entry: NotionPage,
  databaseTitle: string,
  _schema: Record<string, NotionPropertySchema>,
): RawContentItem {
  const properties: Record<string, unknown> = {};
  let title = '';

  // Extract property values
  for (const [key, prop] of Object.entries(entry.properties)) {
    const value = extractPropertyValue(prop);
    properties[key] = value;

    // Identify title property
    if (prop.type === 'title') {
      title = value as string;
    }
  }

  // Generate searchable content from properties
  const content = Object.entries(properties)
    .filter(([_, v]) => v != null && v !== '')
    .map(([k, v]) => {
      if (Array.isArray(v)) return `${k}: ${v.join(', ')}`;
      return `${k}: ${v}`;
    })
    .join('\n');

  const metadata: NotionPageMetadata = {
    page_id: entry.id,
    parent_type: 'database',
    parent_id: entry.parent.database_id || null,
    properties,
    created_time: entry.created_time,
    last_edited_time: entry.last_edited_time,
    created_by: { id: entry.created_by.id, name: '' },
    last_edited_by: { id: entry.last_edited_by.id, name: '' },
    url: entry.url,
    is_database_entry: true,
    database_id: entry.parent.database_id,
  };

  return {
    externalId: entry.id,
    type: 'document',
    title: title || `${databaseTitle} entry`,
    content,
    authorExternal: entry.created_by.id,
    createdAtSource: new Date(entry.created_time),
    updatedAtSource: new Date(entry.last_edited_time),
    metadata,
  };
}

// =============================================================================
// Notion Content Adapter Service
// =============================================================================

export interface NotionContentAdapterService extends ContentSourceAdapter {
  /**
   * List root pages from Notion workspace
   */
  listRootPages(source: ContentSource): Effect.Effect<NotionPage[], ContentSourceSyncError>;

  /**
   * List databases from Notion workspace
   */
  listDatabases(source: ContentSource): Effect.Effect<NotionDatabase[], ContentSourceSyncError>;

  /**
   * Get page blocks (content)
   */
  getPageBlocks(source: ContentSource, pageId: string): Effect.Effect<NotionBlock[], ContentSourceSyncError>;

  /**
   * Get page hierarchy
   */
  getPageHierarchy(sourceId: string, pageId: string): Effect.Effect<NotionPageHierarchyRecord | null, DatabaseError>;

  /**
   * Update page hierarchy
   */
  updatePageHierarchy(
    sourceId: string,
    pageId: string,
    update: Partial<NewNotionPageHierarchyRecord>,
  ): Effect.Effect<NotionPageHierarchyRecord, DatabaseError>;

  /**
   * Get database schema
   */
  getDatabaseSchema(
    sourceId: string,
    databaseId: string,
  ): Effect.Effect<NotionDatabaseSchemaRecord | null, DatabaseError>;

  /**
   * Update database schema
   */
  updateDatabaseSchema(
    sourceId: string,
    databaseId: string,
    update: Partial<NewNotionDatabaseSchemaRecord>,
  ): Effect.Effect<NotionDatabaseSchemaRecord, DatabaseError>;

  /**
   * Query database entries
   */
  queryDatabase(
    source: ContentSource,
    databaseId: string,
    cursor?: string,
  ): Effect.Effect<{ entries: NotionPage[]; hasMore: boolean; nextCursor: string | null }, ContentSourceSyncError>;

  /**
   * Sync users from Notion workspace
   */
  syncUsers(source: ContentSource): Effect.Effect<NotionUser[], ContentSourceSyncError>;

  /**
   * Get comments for a page or block
   */
  getPageComments(source: ContentSource, pageId: string): Effect.Effect<NotionComment[], ContentSourceSyncError>;
}

export class NotionContentAdapter extends Context.Tag('NotionContentAdapter')<
  NotionContentAdapter,
  NotionContentAdapterService
>() {}

// =============================================================================
// Service Implementation
// =============================================================================

const makeNotionContentAdapter = Effect.gen(function* () {
  const { db } = yield* Database;

  const getAccessToken = (source: ContentSource): string => {
    const credentials = source.credentials;
    if (!credentials?.accessToken) {
      throw new Error('No access token found for Notion source');
    }
    return credentials.accessToken;
  };

  const service: NotionContentAdapterService = {
    sourceType: 'notion',

    validateCredentials: (source) =>
      Effect.tryPromise({
        try: async () => {
          const accessToken = getAccessToken(source);
          // Try to call a simple API endpoint to verify credentials
          await notionFetch<{ bot: { owner: { type: string } } }>('/users/me', accessToken);
          return true;
        },
        catch: () => false,
      }).pipe(Effect.catchAll(() => Effect.succeed(false))),

    fetchContent: (source, options) =>
      Effect.gen(function* () {
        const accessToken = getAccessToken(source);
        const config = source.config as NotionContentConfig | undefined;
        const items: RawContentItem[] = [];

        // Get selected pages/databases from config
        // Check both direct config fields (legacy) and settings field (new format)
        const settings = (config as Record<string, unknown> | undefined)?.settings as
          | Record<string, unknown>
          | undefined;
        const rootPagesConfig = config?.rootPages || (settings?.rootPages as string[] | undefined) || [];
        const databasesConfig = config?.databases || (settings?.databases as string[] | undefined) || [];
        const selectedPages = new Set(rootPagesConfig);
        const selectedDatabases = new Set(databasesConfig);
        const hasSelection = selectedPages.size > 0 || selectedDatabases.size > 0;

        // Use Notion's search API to find recently edited content
        const searchBody: Record<string, unknown> = {
          sort: {
            direction: 'descending',
            timestamp: 'last_edited_time',
          },
          page_size: options?.limit || 50,
        };

        if (options?.cursor) {
          searchBody.start_cursor = options.cursor;
        }

        // Filter by date if provided
        if (options?.since) {
          searchBody.filter = {
            property: 'object',
            value: 'page',
          };
        }

        const searchResult = yield* Effect.tryPromise({
          try: () =>
            notionFetch<NotionSearchResponse>('/search', accessToken, {
              method: 'POST',
              body: searchBody,
            }),
          catch: (e) =>
            new ContentSourceSyncError({
              message: `Failed to search Notion: ${e instanceof Error ? e.message : 'Unknown'}`,
              sourceId: source.id,
              sourceType: 'notion',
              cause: e,
            }),
        });

        // Process each result
        for (const result of searchResult.results) {
          if (result.object === 'page') {
            const page = result as NotionPage;

            // Skip archived pages
            if (page.archived) continue;

            // Check if page is in selection (if selection is configured)
            if (hasSelection) {
              // Check if page itself is selected
              const isDirectlySelected = selectedPages.has(page.id);

              // Check if page's parent database is selected
              const isFromSelectedDatabase =
                page.parent.type === 'database' &&
                page.parent.database_id &&
                selectedDatabases.has(page.parent.database_id);

              // Check if page is a child of a selected page (by checking hierarchy)
              const hierarchy = yield* service
                .getPageHierarchy(source.id, page.id)
                .pipe(Effect.catchTag('DatabaseError', () => Effect.succeed(null)));
              const isChildOfSelected = hierarchy?.path?.some((ancestorId) => selectedPages.has(ancestorId)) || false;

              // Skip if not in selection
              if (!isDirectlySelected && !isFromSelectedDatabase && !isChildOfSelected) {
                continue;
              }
            }

            // Check max depth
            const depth = 0; // Would need to calculate from hierarchy
            if (config?.maxDepth !== undefined && depth > config.maxDepth) continue;

            // Fetch page content
            const blocks = yield* service.getPageBlocks(source, page.id);
            let content = notionBlocksToText(blocks);

            // Fetch comments if enabled (defaults to true)
            if (config?.syncComments !== false) {
              const comments = yield* service.getPageComments(source, page.id).pipe(
                Effect.catchAll(() => Effect.succeed([] as NotionComment[])),
              );

              if (comments.length > 0) {
                const commentsText = comments
                  .map((c) => {
                    const commentText = richTextToPlain(c.rich_text);
                    return `> ${commentText}`;
                  })
                  .join('\n\n');
                content = `${content}\n\n---\n\n## Comments\n\n${commentsText}`;
              }
            }

            // Get breadcrumb (simplified - would need hierarchy traversal)
            const breadcrumb: string[] = [];

            const item = pageToRawContentItem(page, content, breadcrumb, depth);
            items.push(item);
          } else if (result.object === 'database') {
            // For databases, fetch entries
            const database = result as NotionDatabase;

            // Check if database is in selection (if selection is configured)
            if (hasSelection && !selectedDatabases.has(database.id)) {
              // Also check if database is a child of a selected page
              const hierarchy = yield* service
                .getPageHierarchy(source.id, database.id)
                .pipe(Effect.catchTag('DatabaseError', () => Effect.succeed(null)));
              const isChildOfSelected = hierarchy?.path?.some((ancestorId) => selectedPages.has(ancestorId)) || false;

              if (!isChildOfSelected) {
                continue;
              }
            }

            const databaseTitle = richTextToPlain(database.title);

            // Convert property definitions to schema
            const schema: Record<string, NotionPropertySchema> = {};
            for (const [key, prop] of Object.entries(database.properties)) {
              schema[key] = {
                id: prop.id,
                name: prop.name,
                type: prop.type,
              };
            }

            // Query database entries
            const queryResult = yield* service.queryDatabase(source, database.id);

            for (const entry of queryResult.entries) {
              if (entry.archived) continue;
              const item = databaseEntryToRawContentItem(entry, databaseTitle, schema);
              items.push(item);
            }
          }
        }

        return {
          items,
          hasMore: searchResult.has_more,
          nextCursor: searchResult.next_cursor || undefined,
        };
      }),

    fetchItem: (source, externalId) =>
      Effect.gen(function* () {
        const accessToken = getAccessToken(source);

        try {
          // Fetch the page
          const page = yield* Effect.tryPromise({
            try: () => notionFetch<NotionPage>(`/pages/${externalId}`, accessToken),
            catch: () => null,
          });

          if (!page) return null;

          // Fetch blocks
          const blocks = yield* service.getPageBlocks(source, externalId);
          const content = notionBlocksToText(blocks);

          // Get hierarchy info from database
          const hierarchy = yield* service.getPageHierarchy(source.id, externalId);
          const breadcrumb = hierarchy?.titlePath || [];
          const depth = hierarchy?.depth || 0;

          return pageToRawContentItem(page, content, breadcrumb, depth);
        } catch {
          return null;
        }
      }).pipe(
        Effect.mapError(
          (e) =>
            new ContentSourceSyncError({
              message: e instanceof Error ? e.message : 'Unknown error',
              sourceId: source.id,
              sourceType: 'notion',
              cause: e,
            }),
        ),
      ),

    refreshAuth: (source) =>
      Effect.gen(function* () {
        // Notion OAuth tokens don't expire for internal integrations
        // For OAuth apps, we'd need to implement refresh
        const credentials = source.credentials;
        if (!credentials?.accessToken) {
          return yield* Effect.fail(
            new ContentSourceAuthError({
              message: 'No access token found',
              sourceId: source.id,
              sourceType: 'notion',
            }),
          );
        }
        return {
          accessToken: credentials.accessToken,
          refreshToken: credentials.refreshToken,
          expiresAt: credentials.expiresAt,
        };
      }),

    // Notion-specific methods
    listRootPages: (source) =>
      Effect.gen(function* () {
        const accessToken = getAccessToken(source);
        const pages: NotionPage[] = [];
        let cursor: string | undefined;

        do {
          const body: Record<string, unknown> = {
            filter: { property: 'object', value: 'page' },
            page_size: 100,
          };
          if (cursor) body.start_cursor = cursor;

          const response = yield* Effect.tryPromise({
            try: () =>
              notionFetch<NotionSearchResponse>('/search', accessToken, {
                method: 'POST',
                body,
              }),
            catch: (e) =>
              new ContentSourceSyncError({
                message: `Failed to list pages: ${e instanceof Error ? e.message : 'Unknown'}`,
                sourceId: source.id,
                sourceType: 'notion',
                cause: e,
              }),
          });

          pages.push(...(response.results.filter((r) => r.object === 'page') as NotionPage[]));
          cursor = response.next_cursor || undefined;
        } while (cursor);

        return pages;
      }),

    listDatabases: (source) =>
      Effect.gen(function* () {
        const accessToken = getAccessToken(source);
        const databases: NotionDatabase[] = [];
        let cursor: string | undefined;

        do {
          const body: Record<string, unknown> = {
            filter: { property: 'object', value: 'database' },
            page_size: 100,
          };
          if (cursor) body.start_cursor = cursor;

          const response = yield* Effect.tryPromise({
            try: () =>
              notionFetch<NotionSearchResponse>('/search', accessToken, {
                method: 'POST',
                body,
              }),
            catch: (e) =>
              new ContentSourceSyncError({
                message: `Failed to list databases: ${e instanceof Error ? e.message : 'Unknown'}`,
                sourceId: source.id,
                sourceType: 'notion',
                cause: e,
              }),
          });

          databases.push(...(response.results.filter((r) => r.object === 'database') as NotionDatabase[]));
          cursor = response.next_cursor || undefined;
        } while (cursor);

        return databases;
      }),

    getPageBlocks: (source, pageId) =>
      Effect.gen(function* () {
        const accessToken = getAccessToken(source);
        const blocks: NotionBlock[] = [];
        let cursor: string | undefined;

        do {
          const endpoint = `/blocks/${pageId}/children${cursor ? `?start_cursor=${cursor}` : ''}`;

          const response = yield* Effect.tryPromise({
            try: () => notionFetch<NotionBlocksResponse>(endpoint, accessToken),
            catch: (e) =>
              new ContentSourceSyncError({
                message: `Failed to get page blocks: ${e instanceof Error ? e.message : 'Unknown'}`,
                sourceId: source.id,
                sourceType: 'notion',
                cause: e,
              }),
          });

          blocks.push(...response.results);
          cursor = response.next_cursor || undefined;
        } while (cursor);

        // Recursively fetch children for blocks that have them
        for (const block of blocks) {
          if (block.has_children) {
            const children = yield* service.getPageBlocks(source, block.id);
            (block as Record<string, unknown>).children = children;
          }
        }

        return blocks;
      }),

    getPageHierarchy: (sourceId, pageId) =>
      Effect.tryPromise({
        try: async () => {
          const record = await db.query.notionPageHierarchy.findFirst({
            where: and(eq(notionPageHierarchy.sourceId, sourceId), eq(notionPageHierarchy.pageId, pageId)),
          });
          return record || null;
        },
        catch: (e) =>
          new DatabaseError({
            message: `Failed to get page hierarchy: ${e instanceof Error ? e.message : 'Unknown'}`,
            cause: e,
          }),
      }),

    updatePageHierarchy: (sourceId, pageId, update) =>
      Effect.tryPromise({
        try: async () => {
          const existing = await db.query.notionPageHierarchy.findFirst({
            where: and(eq(notionPageHierarchy.sourceId, sourceId), eq(notionPageHierarchy.pageId, pageId)),
          });

          if (existing) {
            const [updated] = await db
              .update(notionPageHierarchy)
              .set({ ...update, updatedAt: new Date() })
              .where(eq(notionPageHierarchy.id, existing.id))
              .returning();
            return updated;
          } else {
            const [inserted] = await db
              .insert(notionPageHierarchy)
              .values({
                sourceId,
                pageId,
                parentType: update.parentType || 'workspace',
                ...update,
              })
              .returning();
            return inserted;
          }
        },
        catch: (e) =>
          new DatabaseError({
            message: `Failed to update page hierarchy: ${e instanceof Error ? e.message : 'Unknown'}`,
            cause: e,
          }),
      }),

    getDatabaseSchema: (sourceId, databaseId) =>
      Effect.tryPromise({
        try: async () => {
          const record = await db.query.notionDatabaseSchemas.findFirst({
            where: and(eq(notionDatabaseSchemas.sourceId, sourceId), eq(notionDatabaseSchemas.databaseId, databaseId)),
          });
          return record || null;
        },
        catch: (e) =>
          new DatabaseError({
            message: `Failed to get database schema: ${e instanceof Error ? e.message : 'Unknown'}`,
            cause: e,
          }),
      }),

    updateDatabaseSchema: (sourceId, databaseId, update) =>
      Effect.tryPromise({
        try: async () => {
          const existing = await db.query.notionDatabaseSchemas.findFirst({
            where: and(eq(notionDatabaseSchemas.sourceId, sourceId), eq(notionDatabaseSchemas.databaseId, databaseId)),
          });

          if (existing) {
            const [updated] = await db
              .update(notionDatabaseSchemas)
              .set({ ...update, updatedAt: new Date() })
              .where(eq(notionDatabaseSchemas.id, existing.id))
              .returning();
            return updated;
          } else {
            const [inserted] = await db
              .insert(notionDatabaseSchemas)
              .values({
                sourceId,
                databaseId,
                title: update.title || 'Database',
                schema: update.schema || {},
                ...update,
              })
              .returning();
            return inserted;
          }
        },
        catch: (e) =>
          new DatabaseError({
            message: `Failed to update database schema: ${e instanceof Error ? e.message : 'Unknown'}`,
            cause: e,
          }),
      }),

    queryDatabase: (source, databaseId, cursor) =>
      Effect.gen(function* () {
        const accessToken = getAccessToken(source);

        const body: Record<string, unknown> = {
          page_size: 100,
        };
        if (cursor) body.start_cursor = cursor;

        const response = yield* Effect.tryPromise({
          try: () =>
            notionFetch<NotionDatabaseQueryResponse>(`/databases/${databaseId}/query`, accessToken, {
              method: 'POST',
              body,
            }),
          catch: (e) =>
            new ContentSourceSyncError({
              message: `Failed to query database: ${e instanceof Error ? e.message : 'Unknown'}`,
              sourceId: source.id,
              sourceType: 'notion',
              cause: e,
            }),
        });

        return {
          entries: response.results,
          hasMore: response.has_more,
          nextCursor: response.next_cursor,
        };
      }),

    syncUsers: (source) =>
      Effect.gen(function* () {
        const accessToken = getAccessToken(source);
        const users: NotionApiUser[] = [];
        let cursor: string | undefined;

        do {
          const endpoint = `/users${cursor ? `?start_cursor=${cursor}` : ''}`;

          const response = yield* Effect.tryPromise({
            try: () =>
              notionFetch<{ results: NotionApiUser[]; has_more: boolean; next_cursor: string | null }>(
                endpoint,
                accessToken,
              ),
            catch: (e) =>
              new ContentSourceSyncError({
                message: `Failed to list users: ${e instanceof Error ? e.message : 'Unknown'}`,
                sourceId: source.id,
                sourceType: 'notion',
                cause: e,
              }),
          });

          users.push(...response.results);
          cursor = response.next_cursor || undefined;
        } while (cursor);

        // Save users to database
        const savedUsers: NotionUser[] = [];
        for (const user of users) {
          const userData: NewNotionUser = {
            sourceId: source.id,
            notionUserId: user.id,
            name: user.name,
            avatarUrl: user.avatar_url,
            email: user.person?.email,
            type: user.type,
          };

          yield* Effect.tryPromise({
            try: async () => {
              const existing = await db.query.notionUsers.findFirst({
                where: and(eq(notionUsers.sourceId, source.id), eq(notionUsers.notionUserId, user.id)),
              });

              if (existing) {
                await db.update(notionUsers).set(userData).where(eq(notionUsers.id, existing.id));
              } else {
                await db.insert(notionUsers).values(userData);
              }
            },
            catch: (e) =>
              new ContentSourceSyncError({
                message: `Failed to save user: ${e instanceof Error ? e.message : 'Unknown'}`,
                sourceId: source.id,
                sourceType: 'notion',
                cause: e,
              }),
          });
        }

        return savedUsers;
      }),

    getPageComments: (source, pageId) =>
      Effect.gen(function* () {
        const accessToken = getAccessToken(source);
        const comments: NotionComment[] = [];
        let cursor: string | undefined;

        do {
          const params = new URLSearchParams({ block_id: pageId });
          if (cursor) params.append('start_cursor', cursor);

          const response = yield* Effect.tryPromise({
            try: () => notionFetch<NotionCommentsResponse>(`/comments?${params.toString()}`, accessToken),
            catch: (e) =>
              new ContentSourceSyncError({
                message: `Failed to fetch comments: ${e instanceof Error ? e.message : 'Unknown'}`,
                sourceId: source.id,
                sourceType: 'notion',
                cause: e,
              }),
          });

          comments.push(...response.results);
          cursor = response.next_cursor || undefined;
        } while (cursor);

        return comments;
      }),
  };

  return service;
});

// =============================================================================
// Layer
// =============================================================================

export const NotionContentAdapterLive = Layer.effect(NotionContentAdapter, makeNotionContentAdapter);

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a Notion content adapter instance
 */
export const createNotionContentAdapter = () =>
  Effect.gen(function* () {
    const adapter = yield* NotionContentAdapter;
    return adapter as ContentSourceAdapter;
  });

/**
 * Get Notion OAuth URL
 */
export const getNotionAuthUrl = (clientId: string, redirectUri: string, state: string): string => {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    owner: 'user',
    state,
  });
  return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
};

/**
 * Exchange Notion OAuth code for access token
 */
export const exchangeNotionCode = async (
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
): Promise<{ access_token: string; workspace_id: string; workspace_name?: string }> => {
  const response = await fetch('https://api.notion.com/v1/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Notion OAuth error: ${error}`);
  }

  return (await response.json()) as { access_token: string; workspace_id: string; workspace_name?: string };
};
