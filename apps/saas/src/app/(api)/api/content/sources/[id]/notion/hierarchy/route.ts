/**
 * Notion Page Hierarchy API Routes
 *
 * GET /api/content/sources/[id]/notion/hierarchy - Get Notion page tree structure
 * POST /api/content/sources/[id]/notion/hierarchy - Update selected pages configuration
 */

import { Auth, createFullLayer, handleEffectExit, resolveParams } from '@nuclom/lib/api-handler';
import { db } from '@nuclom/lib/db';
import { type NotionPageHierarchyRecord, notionPageHierarchy } from '@nuclom/lib/db/schema';
import { OrganizationRepository } from '@nuclom/lib/effect';
import { getContentSource, updateContentSource } from '@nuclom/lib/effect/services/content';
import { NotionContentAdapter } from '@nuclom/lib/effect/services/content/notion-content-adapter';
import { validateQueryParams, validateRequestBody } from '@nuclom/lib/validation';
import { asc, eq } from 'drizzle-orm';
import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// Types
// =============================================================================

/**
 * Tree node structure for Notion pages
 */
interface NotionPageTreeNode {
  id: string;
  pageId: string;
  title: string;
  type: 'page' | 'database';
  icon?: string;
  children?: NotionPageTreeNode[];
  isSelected: boolean;
  depth: number;
  isArchived: boolean;
}

// =============================================================================
// Schemas
// =============================================================================

const GetHierarchyQuerySchema = Schema.Struct({
  parentId: Schema.optional(Schema.String),
  depth: Schema.optional(Schema.NumberFromString),
  refresh: Schema.optional(Schema.Literal('true', 'false')),
});

const UpdateSelectionSchema = Schema.Struct({
  selectedPageIds: Schema.mutable(Schema.Array(Schema.String)),
  excludePageIds: Schema.optional(Schema.mutable(Schema.Array(Schema.String))),
});

// =============================================================================
// GET - Get Page Hierarchy
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Resolve params
    const { id } = yield* resolveParams(params);
    const query = yield* validateQueryParams(GetHierarchyQuerySchema, request.url);

    // Get content source
    const source = yield* getContentSource(id);

    // Verify user has access to the organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, source.organizationId);

    // Check if this is a Notion source
    if (source.type !== 'notion') {
      return yield* Effect.fail(new Error('Source is not a Notion source'));
    }

    // If refresh is requested, fetch fresh data from Notion API
    if (query.refresh === 'true') {
      const notionAdapter = yield* NotionContentAdapter;

      // Fetch all pages from Notion
      const pages = yield* notionAdapter.listRootPages(source);
      const databases = yield* notionAdapter.listDatabases(source);

      // Update hierarchy in database
      for (const page of pages) {
        const parentType =
          page.parent.type === 'workspace' ? 'workspace' : page.parent.type === 'database' ? 'database' : 'page';
        const parentId = page.parent.page_id || page.parent.database_id || null;

        // Extract title from properties
        let title = 'Untitled';
        for (const prop of Object.values(page.properties)) {
          if (prop.type === 'title') {
            const titleValue = prop.title as Array<{ plain_text: string }> | undefined;
            if (titleValue) {
              title = titleValue.map((t) => t.plain_text).join('');
            }
          }
        }

        yield* notionAdapter.updatePageHierarchy(source.id, page.id, {
          parentId,
          parentType,
          depth: parentId ? 1 : 0,
          path: parentId ? [parentId] : [],
          titlePath: [title],
          isDatabase: false,
          isArchived: page.archived,
          lastEditedTime: new Date(page.last_edited_time),
        });
      }

      // Update databases in hierarchy
      for (const database of databases) {
        const parentType = database.parent.type === 'workspace' ? 'workspace' : 'page';
        const parentId = database.parent.page_id || null;
        const title = database.title.map((t) => t.plain_text).join('') || 'Untitled Database';

        yield* notionAdapter.updatePageHierarchy(source.id, database.id, {
          parentId,
          parentType,
          depth: parentId ? 1 : 0,
          path: parentId ? [parentId] : [],
          titlePath: [title],
          isDatabase: true,
          isArchived: false,
          lastEditedTime: new Date(database.last_edited_time),
        });
      }
    }

    // Get hierarchy from database
    const hierarchyRecords: NotionPageHierarchyRecord[] = yield* Effect.tryPromise({
      try: () =>
        db.query.notionPageHierarchy.findMany({
          where: eq(notionPageHierarchy.sourceId, id),
          orderBy: [asc(notionPageHierarchy.depth), asc(notionPageHierarchy.titlePath)],
        }),
      catch: (e) => new Error(`Failed to fetch hierarchy: ${e}`),
    });

    // Get current config to check which pages are selected
    // Check both the settings field (new format) and direct fields (legacy format)
    const config = source.config || {};
    const settings = (config.settings || {}) as Record<string, unknown>;
    const rootPages = (settings.rootPages as string[]) || [];
    const databasesConfig = (settings.databases as string[]) || [];
    const selectedPageIds = new Set([...rootPages, ...databasesConfig]);

    // Build tree structure
    const nodeMap = new Map<string, NotionPageTreeNode>();
    const rootNodes: NotionPageTreeNode[] = [];

    // First pass: create all nodes
    for (const record of hierarchyRecords) {
      const title = record.titlePath?.[record.titlePath.length - 1] || 'Untitled';
      const node: NotionPageTreeNode = {
        id: record.id,
        pageId: record.pageId,
        title,
        type: record.isDatabase ? 'database' : 'page',
        isSelected: selectedPageIds.size === 0 || selectedPageIds.has(record.pageId),
        depth: record.depth,
        isArchived: record.isArchived,
        children: [],
      };
      nodeMap.set(record.pageId, node);
    }

    // Second pass: build tree
    for (const record of hierarchyRecords) {
      const node = nodeMap.get(record.pageId);
      if (!node) continue;

      if (!record.parentId || record.parentType === 'workspace') {
        rootNodes.push(node);
      } else {
        const parent = nodeMap.get(record.parentId);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(node);
        } else {
          // Parent not found, treat as root
          rootNodes.push(node);
        }
      }
    }

    // Clean up empty children arrays
    const cleanNode = (node: NotionPageTreeNode): NotionPageTreeNode => {
      if (node.children && node.children.length === 0) {
        const { children: _, ...rest } = node;
        return rest;
      }
      if (node.children) {
        return { ...node, children: node.children.map(cleanNode) };
      }
      return node;
    };

    return {
      tree: rootNodes.map(cleanNode),
      totalCount: hierarchyRecords.length,
      selectedCount: selectedPageIds.size || hierarchyRecords.length,
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}

// =============================================================================
// POST - Update Selected Pages
// =============================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Resolve params
    const { id } = yield* resolveParams(params);

    // Validate request body
    const data = yield* validateRequestBody(UpdateSelectionSchema, request);

    // Get content source
    const source = yield* getContentSource(id);

    // Verify user has access to the organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, source.organizationId);

    // Check if this is a Notion source
    if (source.type !== 'notion') {
      return yield* Effect.fail(new Error('Source is not a Notion source'));
    }

    // Get hierarchy to separate pages from databases
    const hierarchyRecords: NotionPageHierarchyRecord[] = yield* Effect.tryPromise({
      try: () =>
        db.query.notionPageHierarchy.findMany({
          where: eq(notionPageHierarchy.sourceId, id),
        }),
      catch: (e) => new Error(`Failed to fetch hierarchy: ${e}`),
    });

    // Separate selected IDs into pages and databases
    const selectedSet = new Set(data.selectedPageIds);
    const rootPages: string[] = [];
    const databases: string[] = [];

    for (const record of hierarchyRecords) {
      if (selectedSet.has(record.pageId)) {
        if (record.isDatabase) {
          databases.push(record.pageId);
        } else {
          rootPages.push(record.pageId);
        }
      }
    }

    // Update content source config - store Notion-specific settings in the settings field
    const currentConfig = source.config || {};
    const currentSettings = (currentConfig.settings || {}) as Record<string, unknown>;
    const updatedSettings = {
      ...currentSettings,
      rootPages: rootPages.length > 0 ? rootPages : undefined,
      databases: databases.length > 0 ? databases : undefined,
    };

    yield* updateContentSource(id, {
      config: {
        ...currentConfig,
        settings: updatedSettings,
      },
    });

    return {
      success: true,
      selectedPages: rootPages.length,
      selectedDatabases: databases.length,
      settings: updatedSettings,
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
