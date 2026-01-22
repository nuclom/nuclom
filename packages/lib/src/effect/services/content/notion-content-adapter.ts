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

import type {
  BlockObjectResponse,
  CommentObjectResponse,
  DataSourceObjectResponse,
  ListBlockChildrenResponse,
  ListCommentsResponse,
  PageObjectResponse,
  PartialBlockObjectResponse,
  PartialDataSourceObjectResponse,
  PartialPageObjectResponse,
  QueryDataSourceResponse,
  RichTextItemResponse,
  SearchResponse,
  UserObjectResponse,
} from '@notionhq/client/build/src/api-endpoints';
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
import { NotionClient } from '../notion-client';
import type { ContentSourceAdapter, RawContentItem } from './types';

// =============================================================================
// Notion API Types
// =============================================================================

type NotionBlock = BlockObjectResponse;
type NotionBlockWithChildren = NotionBlock & { children?: NotionBlock[] };
type NotionRichText = RichTextItemResponse;
type NotionPage = PageObjectResponse;
type NotionDatabase = DataSourceObjectResponse;
type NotionProperty = PageObjectResponse['properties'][string];
type NotionApiUser = UserObjectResponse;
type NotionSearchResponse = SearchResponse;
type NotionSearchResult = NotionSearchResponse['results'][number];
type NotionBlocksResponse = ListBlockChildrenResponse;
type NotionDatabaseQueryResponse = QueryDataSourceResponse;
type NotionComment = CommentObjectResponse;
type NotionCommentsResponse = ListCommentsResponse;

// =============================================================================
// Constants
// =============================================================================

const NOTION_API_VERSION = '2022-06-28';

// =============================================================================
// Notion API Helpers
// =============================================================================

const notionFetch = <T>(
  endpoint: string,
  accessToken: string,
  options?: { method?: 'get' | 'post' | 'patch' | 'delete'; body?: unknown },
): Effect.Effect<T, Error, NotionClient> =>
  Effect.gen(function* () {
    const notionClient = yield* NotionClient;
    const notion = yield* notionClient.create(accessToken, NOTION_API_VERSION);
    return yield* Effect.tryPromise({
      try: async () => {
        const response = await notion.request({
          path: endpoint,
          method: options?.method ?? 'get',
          ...(options?.body ? { body: options.body as Record<string, unknown> } : {}),
        });

        return response as T;
      },
      catch: (error) => {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return new Error(`Notion API error: ${message}`);
      },
    });
  });

const isNotionPage = (result: NotionSearchResult): result is NotionPage =>
  result.object === 'page' && 'properties' in result;

const isNotionDatabase = (result: NotionSearchResult): result is NotionDatabase => {
  // The SDK types use 'data_source' but the actual API may return 'database'
  // Use type assertion to handle both cases for compatibility
  const objectType = result.object as string;
  return (objectType === 'database' || objectType === 'data_source') && 'title' in result;
};

const isNotionBlock = (block: NotionBlock | PartialBlockObjectResponse): block is NotionBlock =>
  block.object === 'block' && 'type' in block;

const isFullPage = (
  page: PageObjectResponse | PartialPageObjectResponse | DataSourceObjectResponse | PartialDataSourceObjectResponse,
): page is PageObjectResponse => page.object === 'page' && 'properties' in page;

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
  switch (block.type) {
    case 'paragraph':
      return richTextToPlain(block.paragraph.rich_text);
    case 'heading_1':
      return `# ${richTextToPlain(block.heading_1.rich_text)}`;
    case 'heading_2':
      return `## ${richTextToPlain(block.heading_2.rich_text)}`;
    case 'heading_3':
      return `### ${richTextToPlain(block.heading_3.rich_text)}`;
    case 'bulleted_list_item':
      return `• ${richTextToPlain(block.bulleted_list_item.rich_text)}`;
    case 'numbered_list_item':
      return `1. ${richTextToPlain(block.numbered_list_item.rich_text)}`;
    case 'to_do': {
      const checked = block.to_do.checked ? '[x]' : '[ ]';
      return `${checked} ${richTextToPlain(block.to_do.rich_text)}`;
    }
    case 'code': {
      const language = block.code.language ?? '';
      return `\`\`\`${language}\n${richTextToPlain(block.code.rich_text)}\n\`\`\``;
    }
    case 'quote':
      return `> ${richTextToPlain(block.quote.rich_text)}`;
    case 'callout': {
      const icon = block.callout.icon?.type === 'emoji' ? block.callout.icon.emoji : 'i';
      return `[${icon}] ${richTextToPlain(block.callout.rich_text)}`;
    }
    case 'toggle':
      return richTextToPlain(block.toggle.rich_text);
    case 'divider':
      return '---';
    case 'child_page':
      return `[${block.child_page.title ?? 'Page'}]`;
    case 'child_database':
      return `[${block.child_database.title ?? 'Database'}]`;
    case 'image': {
      const caption = block.image.caption.length ? richTextToPlain(block.image.caption) : 'Image';
      return `[Image: ${caption}]`;
    }
    case 'bookmark':
      return `[${block.bookmark.url ?? 'Bookmark'}]`;
    case 'equation':
      return `$$${block.equation.expression ?? ''}$$`;
    case 'table_of_contents':
      return '[Table of Contents]';
    case 'breadcrumb':
      return '[Breadcrumb]';
    case 'column_list':
    case 'column':
      return '';
    case 'synced_block':
      return '';
    case 'template':
      return '';
    case 'link_preview':
      return `[${block.link_preview.url ?? 'Link'}]`;
    case 'file': {
      const url = block.file.type === 'external' ? block.file.external.url : block.file.file.url;
      const name = block.file.name || 'File';
      return `[${name}](${url})`;
    }
    case 'pdf': {
      const url = block.pdf.type === 'external' ? block.pdf.external.url : block.pdf.file.url;
      const caption = block.pdf.caption.length ? richTextToPlain(block.pdf.caption) : 'PDF';
      return `[${caption}](${url})`;
    }
    case 'video': {
      const url = block.video.type === 'external' ? block.video.external.url : block.video.file.url;
      return `[video: ${url}]`;
    }
    case 'audio': {
      const url = block.audio.type === 'external' ? block.audio.external.url : block.audio.file.url;
      return `[audio: ${url}]`;
    }
    case 'embed':
      return `[embed: ${block.embed.url ?? ''}]`;
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
      return richTextToPlain(prop.title);
    }
  }
  return 'Untitled';
}

/**
 * Extract property value from Notion property
 */
function extractPropertyValue(prop: NotionProperty): unknown {
  switch (prop.type) {
    case 'title':
    case 'rich_text':
      return richTextToPlain(prop.type === 'title' ? prop.title : prop.rich_text);
    case 'number':
      return prop.number;
    case 'select':
      return prop.select?.name ?? null;
    case 'multi_select':
      return prop.multi_select.map((s) => s.name);
    case 'date':
      return prop.date?.start ?? null;
    case 'checkbox':
      return prop.checkbox;
    case 'url':
      return prop.url;
    case 'email':
      return prop.email;
    case 'phone_number':
      return prop.phone_number;
    case 'people':
      return prop.people.map((p) => {
        if ('name' in p && p.name) {
          return p.name;
        }
        return p.id;
      });
    case 'files':
      return prop.files.map((f) => f.name);
    case 'relation':
      return prop.relation.map((r) => r.id);
    case 'status':
      return prop.status?.name ?? null;
    case 'formula':
      return prop.formula.type === 'string'
        ? prop.formula.string
        : prop.formula.type === 'number'
          ? prop.formula.number
          : prop.formula.type === 'boolean'
            ? prop.formula.boolean
            : (prop.formula.date?.start ?? null);
    case 'rollup':
      switch (prop.rollup.type) {
        case 'array':
          return prop.rollup.array.map((item) => item.type);
        case 'number':
          return prop.rollup.number;
        case 'date':
          return prop.rollup.date?.start ?? null;
        default:
          return null;
      }
    case 'created_time':
      return prop.created_time;
    case 'last_edited_time':
      return prop.last_edited_time;
    case 'created_by':
      return prop.created_by.id ?? null;
    case 'last_edited_by':
      return prop.last_edited_by.id ?? null;
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
  const parentType =
    page.parent.type === 'data_source_id' || page.parent.type === 'database_id'
      ? 'database'
      : page.parent.type === 'page_id' || page.parent.type === 'block_id'
        ? 'page'
        : 'workspace';
  const parentId =
    page.parent.type === 'data_source_id'
      ? page.parent.data_source_id
      : page.parent.type === 'database_id'
        ? page.parent.database_id
        : page.parent.type === 'page_id'
          ? page.parent.page_id
          : page.parent.type === 'block_id'
            ? page.parent.block_id
            : null;

  const metadata: NotionPageMetadata = {
    page_id: page.id,
    parent_type: parentType,
    parent_id: parentId,
    icon: page.icon
      ? page.icon.type === 'emoji'
        ? { type: 'emoji', emoji: page.icon.emoji }
        : page.icon.type === 'external'
          ? { type: 'external', url: page.icon.external.url }
          : page.icon.type === 'file'
            ? { type: 'external', url: page.icon.file.url }
            : null
      : null,
    cover: page.cover
      ? page.cover.type === 'external'
        ? { type: 'external', url: page.cover.external.url }
        : { type: 'external', url: page.cover.file.url }
      : null,
    created_time: page.created_time,
    last_edited_time: page.last_edited_time,
    created_by: { id: page.created_by.id, name: '' },
    last_edited_by: { id: page.last_edited_by.id, name: '' },
    url: page.url,
    breadcrumb,
    depth,
    is_database_entry: page.parent.type === 'data_source_id' || page.parent.type === 'database_id',
    database_id:
      page.parent.type === 'data_source_id'
        ? page.parent.data_source_id
        : page.parent.type === 'database_id'
          ? page.parent.database_id
          : undefined,
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
    if (prop.type === 'title' && typeof value === 'string') {
      title = value;
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
    parent_id:
      entry.parent.type === 'data_source_id'
        ? entry.parent.data_source_id
        : entry.parent.type === 'database_id'
          ? entry.parent.database_id
          : null,
    properties,
    created_time: entry.created_time,
    last_edited_time: entry.last_edited_time,
    created_by: { id: entry.created_by.id, name: '' },
    last_edited_by: { id: entry.last_edited_by.id, name: '' },
    url: entry.url,
    is_database_entry: true,
    database_id:
      entry.parent.type === 'data_source_id'
        ? entry.parent.data_source_id
        : entry.parent.type === 'database_id'
          ? entry.parent.database_id
          : undefined,
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
  const notionClient = yield* NotionClient;
  const notionFetchWithClient = <T>(
    endpoint: string,
    accessToken: string,
    options?: { method?: 'get' | 'post' | 'patch' | 'delete'; body?: unknown },
  ) => notionFetch<T>(endpoint, accessToken, options).pipe(Effect.provideService(NotionClient, notionClient));

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
      Effect.gen(function* () {
        const accessToken = getAccessToken(source);
        // Try to call a simple API endpoint to verify credentials
        yield* notionFetchWithClient<{ bot: { owner: { type: string } } }>('/users/me', accessToken);
        return true;
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

        const searchResult = yield* notionFetchWithClient<NotionSearchResponse>('/search', accessToken, {
          method: 'post',
          body: searchBody,
        }).pipe(
          Effect.mapError(
            (e) =>
              new ContentSourceSyncError({
                message: `Failed to search Notion: ${e instanceof Error ? e.message : 'Unknown'}`,
                sourceId: source.id,
                sourceType: 'notion',
                cause: e,
              }),
          ),
        );

        // Process each result
        for (const result of searchResult.results) {
          if (isNotionPage(result)) {
            const page = result;

            // Skip archived pages
            if (page.archived) continue;

            // Check if page is in selection (if selection is configured)
            if (hasSelection) {
              // Check if page itself is selected
              const isDirectlySelected = selectedPages.has(page.id);

              // Check if page's parent database is selected
              const isFromSelectedDatabase =
                (page.parent.type === 'data_source_id' && selectedDatabases.has(page.parent.data_source_id)) ||
                (page.parent.type === 'database_id' && selectedDatabases.has(page.parent.database_id));

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
              const comments = yield* service
                .getPageComments(source, page.id)
                .pipe(Effect.catchAll(() => Effect.succeed<NotionComment[]>([])));

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
          } else if (isNotionDatabase(result)) {
            // For databases, fetch entries
            const database = result;

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
          const page = yield* notionFetchWithClient<NotionPage>(`/pages/${externalId}`, accessToken).pipe(
            Effect.catchAll(() => Effect.succeed(null)),
          );

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

          const response = yield* notionFetchWithClient<NotionSearchResponse>('/search', accessToken, {
            method: 'post',
            body,
          }).pipe(
            Effect.mapError(
              (e) =>
                new ContentSourceSyncError({
                  message: `Failed to list pages: ${e instanceof Error ? e.message : 'Unknown'}`,
                  sourceId: source.id,
                  sourceType: 'notion',
                  cause: e,
                }),
            ),
          );

          pages.push(...response.results.filter(isNotionPage));
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
            // The Notion REST API uses 'database' as the filter value
            filter: { property: 'object', value: 'database' },
            page_size: 100,
          };
          if (cursor) body.start_cursor = cursor;

          const response = yield* notionFetchWithClient<NotionSearchResponse>('/search', accessToken, {
            method: 'post',
            body,
          }).pipe(
            Effect.mapError(
              (e) =>
                new ContentSourceSyncError({
                  message: `Failed to list databases: ${e instanceof Error ? e.message : 'Unknown'}`,
                  sourceId: source.id,
                  sourceType: 'notion',
                  cause: e,
                }),
            ),
          );

          databases.push(...response.results.filter(isNotionDatabase));
          cursor = response.next_cursor || undefined;
        } while (cursor);

        return databases;
      }),

    getPageBlocks: (source, pageId) =>
      Effect.gen(function* () {
        const accessToken = getAccessToken(source);
        const blocks: NotionBlockWithChildren[] = [];
        let cursor: string | undefined;

        do {
          const endpoint = `/blocks/${pageId}/children${cursor ? `?start_cursor=${cursor}` : ''}`;

          const response = yield* notionFetchWithClient<NotionBlocksResponse>(endpoint, accessToken).pipe(
            Effect.mapError(
              (e) =>
                new ContentSourceSyncError({
                  message: `Failed to get page blocks: ${e instanceof Error ? e.message : 'Unknown'}`,
                  sourceId: source.id,
                  sourceType: 'notion',
                  cause: e,
                }),
            ),
          );

          blocks.push(...response.results.filter(isNotionBlock));
          cursor = response.next_cursor || undefined;
        } while (cursor);

        // Recursively fetch children for blocks that have them
        for (const block of blocks) {
          if (block.has_children) {
            const children = yield* service.getPageBlocks(source, block.id);
            block.children = children;
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

        // The Notion REST API uses /databases/ endpoint
        const response = yield* notionFetchWithClient<NotionDatabaseQueryResponse>(
          `/databases/${databaseId}/query`,
          accessToken,
          {
            method: 'post',
            body,
          },
        ).pipe(
          Effect.mapError(
            (e) =>
              new ContentSourceSyncError({
                message: `Failed to query database: ${e instanceof Error ? e.message : 'Unknown'}`,
                sourceId: source.id,
                sourceType: 'notion',
                cause: e,
              }),
          ),
        );

        return {
          entries: response.results.filter(isFullPage),
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

          const response = yield* notionFetchWithClient<{
            results: NotionApiUser[];
            has_more: boolean;
            next_cursor: string | null;
          }>(endpoint, accessToken).pipe(
            Effect.mapError(
              (e) =>
                new ContentSourceSyncError({
                  message: `Failed to list users: ${e instanceof Error ? e.message : 'Unknown'}`,
                  sourceId: source.id,
                  sourceType: 'notion',
                  cause: e,
                }),
            ),
          );

          users.push(...response.results);
          cursor = response.next_cursor || undefined;
        } while (cursor);

        // Save users to database
        const savedUsers: NotionUser[] = [];
        for (const user of users) {
          const userData: NewNotionUser = {
            sourceId: source.id,
            notionUserId: user.id,
            name: user.name ?? null,
            avatarUrl: user.avatar_url,
            email: user.type === 'person' ? user.person?.email : undefined,
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

          const response = yield* notionFetchWithClient<NotionCommentsResponse>(
            `/comments?${params.toString()}`,
            accessToken,
          ).pipe(
            Effect.mapError(
              (e) =>
                new ContentSourceSyncError({
                  message: `Failed to fetch comments: ${e instanceof Error ? e.message : 'Unknown'}`,
                  sourceId: source.id,
                  sourceType: 'notion',
                  cause: e,
                }),
            ),
          );

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
export const exchangeNotionCode = (
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
): Effect.Effect<{ access_token: string; workspace_id: string; workspace_name?: string }, Error, NotionClient> =>
  Effect.gen(function* () {
    const notionClient = yield* NotionClient;
    const notion = yield* notionClient.create(undefined, NOTION_API_VERSION);
    return yield* Effect.tryPromise({
      try: async () => {
        const response = await notion.oauth.token({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        });

        return response as { access_token: string; workspace_id: string; workspace_name?: string };
      },
      catch: (error) => {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return new Error(`Notion OAuth error: ${message}`);
      },
    });
  });
