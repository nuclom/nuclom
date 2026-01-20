/**
 * Content Repository Service
 *
 * Provides CRUD operations for content sources, items, relationships, and participants.
 * This is the data access layer for the unified content abstraction.
 */

import { and, count, desc, eq, gte, ilike, inArray, lte, or, sql } from 'drizzle-orm';
import { Context, Effect, Layer, Option } from 'effect';
import {
  type ContentChunk,
  type ContentSourceCredentials,
  contentChunks,
  contentItems,
  contentParticipants,
  contentRelationships,
  contentSources,
  type NewContentChunk,
} from '../../../db/schema';
import {
  ContentItemNotFoundError,
  ContentSourceNotFoundError,
  DatabaseError,
  type EncryptionError,
} from '../../errors';
import { Database, type DrizzleDB } from '../database';
import { EncryptionService, type EncryptionServiceImpl, EncryptionServiceLive } from '../encryption';
import type {
  ContentItem,
  ContentItemFilters,
  ContentItemSortOptions,
  ContentItemWithRelations,
  ContentParticipant,
  ContentRelationship,
  ContentSource,
  ContentSourceFilters,
  ContentSourceWithStats,
  CreateContentItemInput,
  CreateContentParticipantInput,
  CreateContentRelationshipInput,
  CreateContentSourceInput,
  PaginatedResult,
  PaginationOptions,
  UpdateContentItemInput,
  UpdateContentSourceInput,
} from './types';

// =============================================================================
// Service Interface
// =============================================================================

export interface ContentRepositoryService {
  // Content Sources (credentials are encrypted/decrypted automatically)
  createSource(input: CreateContentSourceInput): Effect.Effect<ContentSource, DatabaseError | EncryptionError>;
  getSource(id: string): Effect.Effect<ContentSource, ContentSourceNotFoundError | DatabaseError | EncryptionError>;
  getSourceOption(id: string): Effect.Effect<Option.Option<ContentSource>, DatabaseError | EncryptionError>;
  getSources(
    filters: ContentSourceFilters,
    pagination?: PaginationOptions,
  ): Effect.Effect<PaginatedResult<ContentSource>, DatabaseError | EncryptionError>;
  getSourcesWithStats(
    filters: ContentSourceFilters,
  ): Effect.Effect<ContentSourceWithStats[], DatabaseError | EncryptionError>;
  updateSource(
    id: string,
    input: UpdateContentSourceInput,
  ): Effect.Effect<ContentSource, ContentSourceNotFoundError | DatabaseError | EncryptionError>;
  deleteSource(id: string): Effect.Effect<void, ContentSourceNotFoundError | DatabaseError>;

  // Content Items
  createItem(input: CreateContentItemInput): Effect.Effect<ContentItem, DatabaseError>;
  upsertItem(input: CreateContentItemInput): Effect.Effect<ContentItem, DatabaseError>;
  getItem(id: string): Effect.Effect<ContentItem, ContentItemNotFoundError | DatabaseError>;
  getItemOption(id: string): Effect.Effect<Option.Option<ContentItem>, DatabaseError>;
  getItemByExternalId(sourceId: string, externalId: string): Effect.Effect<Option.Option<ContentItem>, DatabaseError>;
  getItems(
    filters: ContentItemFilters,
    pagination?: PaginationOptions,
    sort?: ContentItemSortOptions,
  ): Effect.Effect<PaginatedResult<ContentItem>, DatabaseError>;
  getItemWithRelations(id: string): Effect.Effect<ContentItemWithRelations, ContentItemNotFoundError | DatabaseError>;
  updateItem(
    id: string,
    input: UpdateContentItemInput,
  ): Effect.Effect<ContentItem, ContentItemNotFoundError | DatabaseError>;
  deleteItem(id: string): Effect.Effect<void, ContentItemNotFoundError | DatabaseError>;
  deleteItemsBySource(sourceId: string): Effect.Effect<number, DatabaseError>;

  // Content Relationships
  createRelationship(input: CreateContentRelationshipInput): Effect.Effect<ContentRelationship, DatabaseError>;
  getRelationships(
    itemId: string,
    direction?: 'outgoing' | 'incoming' | 'both',
  ): Effect.Effect<ContentRelationship[], DatabaseError>;
  deleteRelationship(id: string): Effect.Effect<void, DatabaseError>;

  // Content Participants
  createParticipant(input: CreateContentParticipantInput): Effect.Effect<ContentParticipant, DatabaseError>;
  createParticipantsBatch(inputs: CreateContentParticipantInput[]): Effect.Effect<ContentParticipant[], DatabaseError>;
  getParticipants(itemId: string): Effect.Effect<ContentParticipant[], DatabaseError>;
  deleteParticipant(id: string): Effect.Effect<void, DatabaseError>;

  // Content Chunks (for semantic search)
  createChunks(chunks: NewContentChunk[]): Effect.Effect<ContentChunk[], DatabaseError>;
  getChunks(itemId: string): Effect.Effect<ContentChunk[], DatabaseError>;
  deleteChunks(itemId: string): Effect.Effect<void, DatabaseError>;

  // Bulk operations
  updateProcessingStatus(
    itemIds: string[],
    status: ContentItem['processingStatus'],
    error?: string,
  ): Effect.Effect<void, DatabaseError>;
}

// =============================================================================
// Service Tag
// =============================================================================

export class ContentRepository extends Context.Tag('ContentRepository')<
  ContentRepository,
  ContentRepositoryService
>() {}

// =============================================================================
// Encryption Helpers
// =============================================================================

/**
 * Marker type for encrypted credentials stored in the database.
 * Credentials are stored as { _encrypted: "iv:authTag:ciphertext" }
 */
type EncryptedCredentials = {
  readonly _encrypted: string;
};

/**
 * Encrypt credentials for storage
 */
const encryptCredentials = (
  credentials: ContentSourceCredentials | null | undefined,
  encryption: EncryptionServiceImpl,
): Effect.Effect<EncryptedCredentials | null, EncryptionError> => {
  if (!credentials) {
    return Effect.succeed(null);
  }
  return Effect.gen(function* () {
    const encrypted = yield* encryption.encryptJson(credentials);
    return { _encrypted: encrypted } as EncryptedCredentials;
  });
};

/**
 * Decrypt credentials from storage.
 * Note: Database returns ContentSourceCredentials type but actual data is EncryptedCredentials.
 */
const decryptCredentials = (
  credentials: ContentSourceCredentials | null | undefined,
  encryption: EncryptionServiceImpl,
): Effect.Effect<ContentSourceCredentials | null, EncryptionError> => {
  if (!credentials) {
    return Effect.succeed(null);
  }

  // Cast to EncryptedCredentials - all credentials in database are encrypted
  const encrypted = credentials as unknown as EncryptedCredentials;
  return encryption.decryptJson<ContentSourceCredentials>(encrypted._encrypted);
};

// =============================================================================
// Service Implementation
// =============================================================================

const makeContentRepository = (db: DrizzleDB, encryption: EncryptionServiceImpl): ContentRepositoryService => ({
  // -------------------------------------------------------------------------
  // Content Sources
  // -------------------------------------------------------------------------

  createSource: (input) =>
    Effect.gen(function* () {
      // Encrypt credentials before storing
      const encryptedCreds = yield* encryptCredentials(input.credentials, encryption);

      const result = yield* Effect.tryPromise({
        try: async () => {
          const [source] = await db
            .insert(contentSources)
            .values({
              organizationId: input.organizationId,
              type: input.type,
              name: input.name,
              config: input.config ?? {},
              // Store encrypted credentials (cast needed for JSONB compatibility)
              credentials: encryptedCreds as unknown as ContentSourceCredentials,
            })
            .returning();
          return source;
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to create content source',
            operation: 'insert',
            cause: error,
          }),
      });

      // Decrypt credentials for return value
      const decryptedCreds = yield* decryptCredentials(result.credentials, encryption);
      return { ...result, credentials: decryptedCreds };
    }),

  getSource: (id) =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: () =>
          db.query.contentSources.findFirst({
            where: eq(contentSources.id, id),
          }),
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to get content source',
            operation: 'select',
            cause: error,
          }),
      });

      if (!result) {
        return yield* Effect.fail(
          new ContentSourceNotFoundError({
            message: `Content source not found: ${id}`,
            sourceId: id,
          }),
        );
      }

      // Decrypt credentials before returning
      const decryptedCreds = yield* decryptCredentials(result.credentials, encryption);
      return { ...result, credentials: decryptedCreds };
    }),

  getSourceOption: (id) =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          const source = await db.query.contentSources.findFirst({
            where: eq(contentSources.id, id),
          });
          return source;
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to get content source',
            operation: 'select',
            cause: error,
          }),
      });

      if (!result) {
        return Option.none<ContentSource>();
      }

      // Decrypt credentials before returning
      const decryptedCreds = yield* decryptCredentials(result.credentials, encryption);
      return Option.some({ ...result, credentials: decryptedCreds });
    }),

  getSources: (filters, pagination = { limit: 50, offset: 0 }) =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          const conditions = [eq(contentSources.organizationId, filters.organizationId)];

          if (filters.type) {
            conditions.push(eq(contentSources.type, filters.type));
          }
          if (filters.syncStatus) {
            conditions.push(eq(contentSources.syncStatus, filters.syncStatus));
          }

          const limit = pagination.limit ?? 50;
          const offset = pagination.offset ?? 0;

          // Get total count
          const [{ total }] = await db
            .select({ total: count() })
            .from(contentSources)
            .where(and(...conditions));

          // Get items with pagination
          const items = await db.query.contentSources.findMany({
            where: and(...conditions),
            orderBy: desc(contentSources.createdAt),
            limit,
            offset,
          });

          return {
            items,
            total,
            limit,
            offset,
            hasMore: offset + items.length < total,
          };
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to get content sources',
            operation: 'select',
            cause: error,
          }),
      });

      // Decrypt credentials for each source
      const decryptedItems = yield* Effect.forEach(result.items, (source) =>
        Effect.gen(function* () {
          const decryptedCreds = yield* decryptCredentials(source.credentials, encryption);
          return { ...source, credentials: decryptedCreds };
        }),
      );

      return {
        ...result,
        items: decryptedItems,
      };
    }),

  getSourcesWithStats: (filters) =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          const conditions = [eq(contentSources.organizationId, filters.organizationId)];

          if (filters.type) {
            conditions.push(eq(contentSources.type, filters.type));
          }
          if (filters.syncStatus) {
            conditions.push(eq(contentSources.syncStatus, filters.syncStatus));
          }

          const sources = await db.query.contentSources.findMany({
            where: and(...conditions),
            orderBy: desc(contentSources.createdAt),
          });

          // Get stats for each source
          const stats = await db
            .select({
              sourceId: contentItems.sourceId,
              itemCount: count(),
              pendingCount: sql<number>`COUNT(*) FILTER (WHERE ${contentItems.processingStatus} = 'pending')`,
              failedCount: sql<number>`COUNT(*) FILTER (WHERE ${contentItems.processingStatus} = 'failed')`,
            })
            .from(contentItems)
            .where(
              inArray(
                contentItems.sourceId,
                sources.map((s) => s.id),
              ),
            )
            .groupBy(contentItems.sourceId);

          const statsMap = new Map(stats.map((s) => [s.sourceId, s]));

          return sources.map((source) => ({
            ...source,
            itemCount: statsMap.get(source.id)?.itemCount ?? 0,
            pendingCount: statsMap.get(source.id)?.pendingCount ?? 0,
            failedCount: statsMap.get(source.id)?.failedCount ?? 0,
          }));
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to get content sources with stats',
            operation: 'select',
            cause: error,
          }),
      });

      // Decrypt credentials for each source
      const decryptedItems = yield* Effect.forEach(result, (source) =>
        Effect.gen(function* () {
          const decryptedCreds = yield* decryptCredentials(source.credentials, encryption);
          return { ...source, credentials: decryptedCreds };
        }),
      );

      return decryptedItems;
    }),

  updateSource: (id, input) =>
    Effect.gen(function* () {
      // Encrypt credentials if provided in the update
      const encryptedCreds = input.credentials ? yield* encryptCredentials(input.credentials, encryption) : undefined;

      const updateData = {
        ...input,
        ...(encryptedCreds !== undefined && {
          credentials: encryptedCreds as unknown as ContentSourceCredentials,
        }),
        updatedAt: new Date(),
      };

      const result = yield* Effect.tryPromise({
        try: async () => {
          const [updated] = await db
            .update(contentSources)
            .set(updateData)
            .where(eq(contentSources.id, id))
            .returning();
          return updated;
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to update content source',
            operation: 'update',
            cause: error,
          }),
      });

      if (!result) {
        return yield* Effect.fail(
          new ContentSourceNotFoundError({
            message: `Content source not found: ${id}`,
            sourceId: id,
          }),
        );
      }

      // Decrypt credentials before returning
      const decryptedCreds = yield* decryptCredentials(result.credentials, encryption);
      return { ...result, credentials: decryptedCreds };
    }),

  deleteSource: (id) =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: () => db.delete(contentSources).where(eq(contentSources.id, id)).returning(),
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to delete content source',
            operation: 'delete',
            cause: error,
          }),
      });

      if (result.length === 0) {
        return yield* Effect.fail(
          new ContentSourceNotFoundError({
            message: `Content source not found: ${id}`,
            sourceId: id,
          }),
        );
      }
    }),

  // -------------------------------------------------------------------------
  // Content Items
  // -------------------------------------------------------------------------

  createItem: (input) =>
    Effect.tryPromise({
      try: async () => {
        const [item] = await db
          .insert(contentItems)
          .values({
            organizationId: input.organizationId,
            sourceId: input.sourceId,
            type: input.type,
            externalId: input.externalId,
            title: input.title,
            content: input.content,
            contentHtml: input.contentHtml,
            authorId: input.authorId,
            authorExternal: input.authorExternal,
            authorName: input.authorName,
            createdAtSource: input.createdAtSource,
            updatedAtSource: input.updatedAtSource,
            metadata: input.metadata ?? {},
            tags: input.tags ?? [],
          })
          .returning();
        return item;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to create content item',
          operation: 'insert',
          cause: error,
        }),
    }),

  upsertItem: (input) =>
    Effect.tryPromise({
      try: async () => {
        const [item] = await db
          .insert(contentItems)
          .values({
            organizationId: input.organizationId,
            sourceId: input.sourceId,
            type: input.type,
            externalId: input.externalId,
            title: input.title,
            content: input.content,
            contentHtml: input.contentHtml,
            authorId: input.authorId,
            authorExternal: input.authorExternal,
            authorName: input.authorName,
            createdAtSource: input.createdAtSource,
            updatedAtSource: input.updatedAtSource,
            metadata: input.metadata ?? {},
            tags: input.tags ?? [],
          })
          .onConflictDoUpdate({
            target: [contentItems.sourceId, contentItems.externalId],
            set: {
              title: input.title,
              content: input.content,
              contentHtml: input.contentHtml,
              authorId: input.authorId,
              authorExternal: input.authorExternal,
              authorName: input.authorName,
              updatedAtSource: input.updatedAtSource,
              metadata: input.metadata ?? {},
              tags: input.tags ?? [],
              updatedAt: new Date(),
            },
          })
          .returning();
        return item;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to upsert content item',
          operation: 'upsert',
          cause: error,
        }),
    }),

  getItem: (id) =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: () =>
          db.query.contentItems.findFirst({
            where: eq(contentItems.id, id),
          }),
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to get content item',
            operation: 'select',
            cause: error,
          }),
      });

      if (!result) {
        return yield* Effect.fail(
          new ContentItemNotFoundError({
            message: `Content item not found: ${id}`,
            itemId: id,
          }),
        );
      }

      return result;
    }),

  getItemOption: (id) =>
    Effect.tryPromise({
      try: async () => {
        const result = await db.query.contentItems.findFirst({
          where: eq(contentItems.id, id),
        });
        return Option.fromNullable(result);
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to get content item',
          operation: 'select',
          cause: error,
        }),
    }),

  getItemByExternalId: (sourceId, externalId) =>
    Effect.tryPromise({
      try: async () => {
        const result = await db.query.contentItems.findFirst({
          where: and(eq(contentItems.sourceId, sourceId), eq(contentItems.externalId, externalId)),
        });
        return Option.fromNullable(result);
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to get content item by external ID',
          operation: 'select',
          cause: error,
        }),
    }),

  getItems: (filters, pagination = { limit: 50, offset: 0 }, sort = { field: 'createdAt', direction: 'desc' }) =>
    Effect.tryPromise({
      try: async () => {
        const conditions = [eq(contentItems.organizationId, filters.organizationId)];

        if (filters.sourceId) {
          conditions.push(eq(contentItems.sourceId, filters.sourceId));
        }
        if (filters.type) {
          conditions.push(eq(contentItems.type, filters.type));
        }
        if (filters.processingStatus) {
          conditions.push(eq(contentItems.processingStatus, filters.processingStatus));
        }
        if (filters.authorId) {
          conditions.push(eq(contentItems.authorId, filters.authorId));
        }
        if (filters.createdAfter) {
          conditions.push(gte(contentItems.createdAtSource, filters.createdAfter));
        }
        if (filters.createdBefore) {
          conditions.push(lte(contentItems.createdAtSource, filters.createdBefore));
        }
        if (filters.searchQuery) {
          const searchCondition = or(
            ilike(contentItems.title, `%${filters.searchQuery}%`),
            ilike(contentItems.searchText, `%${filters.searchQuery}%`),
          );
          if (searchCondition) {
            conditions.push(searchCondition);
          }
        }
        if (filters.tags && filters.tags.length > 0) {
          // Check if any of the filter tags are present in the item's tags
          conditions.push(
            sql`${contentItems.tags} ?| array[${sql.join(
              filters.tags.map((t) => sql`${t}`),
              sql`, `,
            )}]`,
          );
        }

        const limit = pagination.limit ?? 50;
        const offset = pagination.offset ?? 0;

        // Get total count
        const [{ total }] = await db
          .select({ total: count() })
          .from(contentItems)
          .where(and(...conditions));

        // Get items with sorting
        const orderColumn =
          sort.field === 'createdAtSource'
            ? contentItems.createdAtSource
            : sort.field === 'updatedAt'
              ? contentItems.updatedAt
              : sort.field === 'title'
                ? contentItems.title
                : contentItems.createdAt;

        const items = await db.query.contentItems.findMany({
          where: and(...conditions),
          limit,
          offset,
          orderBy: sort.direction === 'asc' ? orderColumn : desc(orderColumn),
        });

        return {
          items,
          total,
          limit,
          offset,
          hasMore: offset + items.length < total,
        };
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to get content items',
          operation: 'select',
          cause: error,
        }),
    }),

  getItemWithRelations: (id) =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: () =>
          db.query.contentItems.findFirst({
            where: eq(contentItems.id, id),
            with: {
              source: true,
              participants: true,
              outgoingRelationships: true,
              incomingRelationships: true,
            },
          }),
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to get content item with relations',
            operation: 'select',
            cause: error,
          }),
      });

      if (!result) {
        return yield* Effect.fail(
          new ContentItemNotFoundError({
            message: `Content item not found: ${id}`,
            itemId: id,
          }),
        );
      }

      return result;
    }),

  updateItem: (id, input) =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          const [updated] = await db
            .update(contentItems)
            .set({
              ...input,
              updatedAt: new Date(),
            })
            .where(eq(contentItems.id, id))
            .returning();
          return updated;
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to update content item',
            operation: 'update',
            cause: error,
          }),
      });

      if (!result) {
        return yield* Effect.fail(
          new ContentItemNotFoundError({
            message: `Content item not found: ${id}`,
            itemId: id,
          }),
        );
      }

      return result;
    }),

  deleteItem: (id) =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: () => db.delete(contentItems).where(eq(contentItems.id, id)).returning(),
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to delete content item',
            operation: 'delete',
            cause: error,
          }),
      });

      if (result.length === 0) {
        return yield* Effect.fail(
          new ContentItemNotFoundError({
            message: `Content item not found: ${id}`,
            itemId: id,
          }),
        );
      }
    }),

  deleteItemsBySource: (sourceId) =>
    Effect.tryPromise({
      try: async () => {
        const result = await db.delete(contentItems).where(eq(contentItems.sourceId, sourceId)).returning();
        return result.length;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to delete content items by source',
          operation: 'delete',
          cause: error,
        }),
    }),

  // -------------------------------------------------------------------------
  // Content Relationships
  // -------------------------------------------------------------------------

  createRelationship: (input) =>
    Effect.tryPromise({
      try: async () => {
        const [relationship] = await db
          .insert(contentRelationships)
          .values({
            sourceItemId: input.sourceItemId,
            targetItemId: input.targetItemId,
            relationshipType: input.relationshipType,
            confidence: input.confidence ?? 1.0,
            metadata: input.metadata ?? {},
          })
          .onConflictDoUpdate({
            target: [
              contentRelationships.sourceItemId,
              contentRelationships.targetItemId,
              contentRelationships.relationshipType,
            ],
            set: {
              confidence: input.confidence ?? 1.0,
              metadata: input.metadata ?? {},
            },
          })
          .returning();
        return relationship;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to create content relationship',
          operation: 'insert',
          cause: error,
        }),
    }),

  getRelationships: (itemId, direction = 'both') =>
    Effect.tryPromise({
      try: async () => {
        if (direction === 'outgoing') {
          return db.query.contentRelationships.findMany({
            where: eq(contentRelationships.sourceItemId, itemId),
          });
        } else if (direction === 'incoming') {
          return db.query.contentRelationships.findMany({
            where: eq(contentRelationships.targetItemId, itemId),
          });
        } else {
          return db.query.contentRelationships.findMany({
            where: or(eq(contentRelationships.sourceItemId, itemId), eq(contentRelationships.targetItemId, itemId)),
          });
        }
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to get content relationships',
          operation: 'select',
          cause: error,
        }),
    }),

  deleteRelationship: (id) =>
    Effect.tryPromise({
      try: () => db.delete(contentRelationships).where(eq(contentRelationships.id, id)),
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to delete content relationship',
          operation: 'delete',
          cause: error,
        }),
    }).pipe(Effect.asVoid),

  // -------------------------------------------------------------------------
  // Content Participants
  // -------------------------------------------------------------------------

  createParticipant: (input) =>
    Effect.tryPromise({
      try: async () => {
        const [participant] = await db
          .insert(contentParticipants)
          .values({
            contentItemId: input.contentItemId,
            userId: input.userId,
            externalId: input.externalId,
            name: input.name,
            email: input.email,
            role: input.role ?? 'participant',
          })
          .returning();
        return participant;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to create content participant',
          operation: 'insert',
          cause: error,
        }),
    }),

  createParticipantsBatch: (inputs) =>
    Effect.tryPromise({
      try: async () => {
        if (inputs.length === 0) return [];

        return db
          .insert(contentParticipants)
          .values(
            inputs.map((input) => ({
              contentItemId: input.contentItemId,
              userId: input.userId,
              externalId: input.externalId,
              name: input.name,
              email: input.email,
              role: input.role ?? 'participant',
            })),
          )
          .returning();
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to create content participants batch',
          operation: 'insert',
          cause: error,
        }),
    }),

  getParticipants: (itemId) =>
    Effect.tryPromise({
      try: () =>
        db.query.contentParticipants.findMany({
          where: eq(contentParticipants.contentItemId, itemId),
        }),
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to get content participants',
          operation: 'select',
          cause: error,
        }),
    }),

  deleteParticipant: (id) =>
    Effect.tryPromise({
      try: () => db.delete(contentParticipants).where(eq(contentParticipants.id, id)),
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to delete content participant',
          operation: 'delete',
          cause: error,
        }),
    }).pipe(Effect.asVoid),

  // -------------------------------------------------------------------------
  // Content Chunks
  // -------------------------------------------------------------------------

  createChunks: (chunks) =>
    Effect.tryPromise({
      try: async () => {
        if (chunks.length === 0) return [];
        return db.insert(contentChunks).values(chunks).returning();
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to create content chunks',
          operation: 'insert',
          cause: error,
        }),
    }),

  getChunks: (itemId) =>
    Effect.tryPromise({
      try: () =>
        db.query.contentChunks.findMany({
          where: eq(contentChunks.contentItemId, itemId),
          orderBy: contentChunks.chunkIndex,
        }),
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to get content chunks',
          operation: 'select',
          cause: error,
        }),
    }),

  deleteChunks: (itemId) =>
    Effect.tryPromise({
      try: () => db.delete(contentChunks).where(eq(contentChunks.contentItemId, itemId)),
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to delete content chunks',
          operation: 'delete',
          cause: error,
        }),
    }).pipe(Effect.asVoid),

  // -------------------------------------------------------------------------
  // Bulk Operations
  // -------------------------------------------------------------------------

  updateProcessingStatus: (itemIds, status, error) =>
    Effect.tryPromise({
      try: () =>
        db
          .update(contentItems)
          .set({
            processingStatus: status,
            processingError: error ?? null,
            processedAt: status === 'completed' || status === 'failed' ? new Date() : undefined,
            updatedAt: new Date(),
          })
          .where(inArray(contentItems.id, itemIds)),
      catch: (err) =>
        new DatabaseError({
          message: 'Failed to update processing status',
          operation: 'update',
          cause: err,
        }),
    }).pipe(Effect.asVoid),
});

// =============================================================================
// Layer
// =============================================================================

export const ContentRepositoryLive = Layer.effect(
  ContentRepository,
  Effect.gen(function* () {
    const { db } = yield* Database;
    const encryption = yield* EncryptionService;
    return makeContentRepository(db, encryption);
  }),
).pipe(Layer.provide(EncryptionServiceLive));

// =============================================================================
// Convenience Functions
// =============================================================================

// Content Sources
export const createContentSource = (input: CreateContentSourceInput) =>
  Effect.gen(function* () {
    const repo = yield* ContentRepository;
    return yield* repo.createSource(input);
  });

export const getContentSource = (id: string) =>
  Effect.gen(function* () {
    const repo = yield* ContentRepository;
    return yield* repo.getSource(id);
  });

export const getContentSources = (filters: ContentSourceFilters, pagination?: PaginationOptions) =>
  Effect.gen(function* () {
    const repo = yield* ContentRepository;
    return yield* repo.getSources(filters, pagination);
  });

export const getContentSourcesWithStats = (filters: ContentSourceFilters) =>
  Effect.gen(function* () {
    const repo = yield* ContentRepository;
    return yield* repo.getSourcesWithStats(filters);
  });

export const updateContentSource = (id: string, input: UpdateContentSourceInput) =>
  Effect.gen(function* () {
    const repo = yield* ContentRepository;
    return yield* repo.updateSource(id, input);
  });

export const deleteContentSource = (id: string) =>
  Effect.gen(function* () {
    const repo = yield* ContentRepository;
    return yield* repo.deleteSource(id);
  });

// Content Items
export const createContentItem = (input: CreateContentItemInput) =>
  Effect.gen(function* () {
    const repo = yield* ContentRepository;
    return yield* repo.createItem(input);
  });

export const upsertContentItem = (input: CreateContentItemInput) =>
  Effect.gen(function* () {
    const repo = yield* ContentRepository;
    return yield* repo.upsertItem(input);
  });

export const getContentItem = (id: string) =>
  Effect.gen(function* () {
    const repo = yield* ContentRepository;
    return yield* repo.getItem(id);
  });

export const getContentItemByExternalId = (sourceId: string, externalId: string) =>
  Effect.gen(function* () {
    const repo = yield* ContentRepository;
    return yield* repo.getItemByExternalId(sourceId, externalId);
  });

export const getContentItems = (
  filters: ContentItemFilters,
  pagination?: PaginationOptions,
  sort?: ContentItemSortOptions,
) =>
  Effect.gen(function* () {
    const repo = yield* ContentRepository;
    return yield* repo.getItems(filters, pagination, sort);
  });

export const getContentItemWithRelations = (id: string) =>
  Effect.gen(function* () {
    const repo = yield* ContentRepository;
    return yield* repo.getItemWithRelations(id);
  });

export const updateContentItem = (id: string, input: UpdateContentItemInput) =>
  Effect.gen(function* () {
    const repo = yield* ContentRepository;
    return yield* repo.updateItem(id, input);
  });

export const deleteContentItem = (id: string) =>
  Effect.gen(function* () {
    const repo = yield* ContentRepository;
    return yield* repo.deleteItem(id);
  });
