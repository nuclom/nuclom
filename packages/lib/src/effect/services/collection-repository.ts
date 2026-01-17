/**
 * Collection Repository Service using Effect-TS
 *
 * Provides type-safe database operations for collections.
 * Collections are unified video groupings that can be:
 * - 'folder': Simple grouping without ordering or progress
 * - 'playlist': Ordered videos with progress tracking
 */

import { and, asc, count, desc, eq, sql } from 'drizzle-orm';
import { Context, Effect, Layer } from 'effect';
import {
  type Collection,
  type CollectionType,
  type CollectionVideo,
  collectionProgress,
  collections,
  collectionVideos,
  users,
  videos,
} from '../../db/schema';
import type {
  CollectionProgressWithDetails,
  CollectionVideoWithDetails,
  CollectionWithProgress,
  CollectionWithVideoCount,
  CollectionWithVideos,
  PaginatedResponse,
} from '../../types';
import { DatabaseError, NotFoundError } from '../errors';
import { Database } from './database';

// =============================================================================
// Types
// =============================================================================

export interface CreateCollectionInput {
  readonly name: string;
  readonly description?: string;
  readonly thumbnailUrl?: string;
  readonly organizationId: string;
  readonly createdById?: string;
  readonly type?: CollectionType;
  readonly isPublic?: boolean;
}

export interface UpdateCollectionInput {
  readonly name?: string;
  readonly description?: string | null;
  readonly thumbnailUrl?: string | null;
  readonly type?: CollectionType;
  readonly isPublic?: boolean;
}

export interface CollectionRepositoryService {
  // ==========================================================================
  // Core CRUD Operations
  // ==========================================================================

  /**
   * Get paginated collections for an organization
   */
  readonly getCollections: (
    organizationId: string,
    options?: {
      type?: CollectionType;
      page?: number;
      limit?: number;
    },
  ) => Effect.Effect<PaginatedResponse<CollectionWithVideoCount>, DatabaseError>;

  /**
   * Get a single collection with its videos
   */
  readonly getCollectionWithVideos: (id: string) => Effect.Effect<CollectionWithVideos, DatabaseError | NotFoundError>;

  /**
   * Get a single collection by ID (without videos)
   */
  readonly getCollection: (id: string) => Effect.Effect<Collection, DatabaseError | NotFoundError>;

  /**
   * Create a new collection
   */
  readonly createCollection: (data: CreateCollectionInput) => Effect.Effect<Collection, DatabaseError>;

  /**
   * Update a collection
   */
  readonly updateCollection: (
    id: string,
    data: UpdateCollectionInput,
  ) => Effect.Effect<Collection, DatabaseError | NotFoundError>;

  /**
   * Delete a collection
   */
  readonly deleteCollection: (id: string) => Effect.Effect<void, DatabaseError | NotFoundError>;

  // ==========================================================================
  // Video Management
  // ==========================================================================

  /**
   * Add a video to a collection
   */
  readonly addVideoToCollection: (
    collectionId: string,
    videoId: string,
    position?: number,
  ) => Effect.Effect<CollectionVideo, DatabaseError>;

  /**
   * Remove a video from a collection
   */
  readonly removeVideoFromCollection: (
    collectionId: string,
    videoId: string,
  ) => Effect.Effect<void, DatabaseError | NotFoundError>;

  /**
   * Reorder videos in a collection (for playlists)
   */
  readonly reorderVideos: (collectionId: string, videoIds: readonly string[]) => Effect.Effect<void, DatabaseError>;

  /**
   * Get videos not in a collection (for picker)
   */
  readonly getAvailableVideos: (
    organizationId: string,
    collectionId: string,
  ) => Effect.Effect<(typeof videos.$inferSelect)[], DatabaseError>;

  // ==========================================================================
  // Progress Tracking (for playlists)
  // ==========================================================================

  /**
   * Get user's progress for a collection
   */
  readonly getCollectionProgress: (
    userId: string,
    collectionId: string,
  ) => Effect.Effect<CollectionProgressWithDetails | null, DatabaseError>;

  /**
   * Update user's progress for a collection
   */
  readonly updateCollectionProgress: (
    userId: string,
    collectionId: string,
    lastVideoId: string,
    lastPosition: number,
  ) => Effect.Effect<typeof collectionProgress.$inferSelect, DatabaseError>;

  /**
   * Mark a video as completed in a collection
   */
  readonly markVideoCompleted: (
    userId: string,
    collectionId: string,
    videoId: string,
  ) => Effect.Effect<typeof collectionProgress.$inferSelect, DatabaseError>;

  /**
   * Get all collections with user's progress
   */
  readonly getCollectionsWithProgress: (
    organizationId: string,
    userId: string,
    type?: CollectionType,
  ) => Effect.Effect<CollectionWithProgress[], DatabaseError>;
}

// =============================================================================
// Collection Repository Tag
// =============================================================================

export class CollectionRepository extends Context.Tag('CollectionRepository')<
  CollectionRepository,
  CollectionRepositoryService
>() {}

// =============================================================================
// Collection Repository Implementation
// =============================================================================

const makeCollectionRepositoryService = Effect.gen(function* () {
  const { db } = yield* Database;

  const getCollections = (
    organizationId: string,
    options?: {
      type?: CollectionType;
      page?: number;
      limit?: number;
    },
  ): Effect.Effect<PaginatedResponse<CollectionWithVideoCount>, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const page = options?.page ?? 1;
        const limit = options?.limit ?? 20;
        const offset = (page - 1) * limit;

        // Build where conditions
        const conditions = [eq(collections.organizationId, organizationId)];
        if (options?.type) {
          conditions.push(eq(collections.type, options.type));
        }

        // Get collections with video counts
        const collectionsData = await db
          .select({
            id: collections.id,
            name: collections.name,
            description: collections.description,
            thumbnailUrl: collections.thumbnailUrl,
            organizationId: collections.organizationId,
            type: collections.type,
            isPublic: collections.isPublic,
            createdById: collections.createdById,
            createdAt: collections.createdAt,
            updatedAt: collections.updatedAt,
            videoCount: sql<number>`(
              SELECT COUNT(*)::int FROM ${collectionVideos}
              WHERE ${collectionVideos.collectionId} = ${collections.id}
            )`.as('video_count'),
            createdBy: {
              id: users.id,
              email: users.email,
              name: users.name,
              image: users.image,
              createdAt: users.createdAt,
              updatedAt: users.updatedAt,
              emailVerified: users.emailVerified,
              role: users.role,
              banned: users.banned,
              banReason: users.banReason,
              banExpires: users.banExpires,
              twoFactorEnabled: users.twoFactorEnabled,
            },
          })
          .from(collections)
          .leftJoin(users, eq(collections.createdById, users.id))
          .where(and(...conditions))
          .orderBy(desc(collections.createdAt))
          .offset(offset)
          .limit(limit);

        const totalCount = await db
          .select({ count: count() })
          .from(collections)
          .where(and(...conditions));

        return {
          data: collectionsData.map((c) => ({
            ...c,
            createdBy: c.createdBy?.id ? c.createdBy : null,
          })) as CollectionWithVideoCount[],
          pagination: {
            page,
            limit,
            total: totalCount[0].count,
            totalPages: Math.ceil(totalCount[0].count / limit),
          },
        };
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch collections',
          operation: 'getCollections',
          cause: error,
        }),
    });

  const getCollectionWithVideos = (id: string): Effect.Effect<CollectionWithVideos, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      // Get the collection
      const collectionData = yield* Effect.tryPromise({
        try: async () => {
          return await db
            .select({
              id: collections.id,
              name: collections.name,
              description: collections.description,
              thumbnailUrl: collections.thumbnailUrl,
              organizationId: collections.organizationId,
              type: collections.type,
              isPublic: collections.isPublic,
              createdById: collections.createdById,
              createdAt: collections.createdAt,
              updatedAt: collections.updatedAt,
              createdBy: {
                id: users.id,
                email: users.email,
                name: users.name,
                image: users.image,
                createdAt: users.createdAt,
                updatedAt: users.updatedAt,
                emailVerified: users.emailVerified,
                role: users.role,
                banned: users.banned,
                banReason: users.banReason,
                banExpires: users.banExpires,
                twoFactorEnabled: users.twoFactorEnabled,
              },
            })
            .from(collections)
            .leftJoin(users, eq(collections.createdById, users.id))
            .where(eq(collections.id, id))
            .limit(1);
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to fetch collection',
            operation: 'getCollectionWithVideos',
            cause: error,
          }),
      });

      if (!collectionData.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Collection not found',
            entity: 'Collection',
            id,
          }),
        );
      }

      // Get videos in this collection with ordering
      const collectionVideosData = yield* Effect.tryPromise({
        try: async () => {
          const result = await db
            .select({
              id: collectionVideos.id,
              collectionId: collectionVideos.collectionId,
              videoId: collectionVideos.videoId,
              position: collectionVideos.position,
              createdAt: collectionVideos.createdAt,
              video: {
                id: videos.id,
                title: videos.title,
                description: videos.description,
                duration: videos.duration,
                thumbnailUrl: videos.thumbnailUrl,
                videoUrl: videos.videoUrl,
                authorId: videos.authorId,
                organizationId: videos.organizationId,
                transcript: videos.transcript,
                transcriptSegments: videos.transcriptSegments,
                processingStatus: videos.processingStatus,
                processingError: videos.processingError,
                aiSummary: videos.aiSummary,
                aiTags: videos.aiTags,
                aiActionItems: videos.aiActionItems,
                createdAt: videos.createdAt,
                updatedAt: videos.updatedAt,
              },
              author: {
                id: users.id,
                email: users.email,
                name: users.name,
                image: users.image,
                createdAt: users.createdAt,
                updatedAt: users.updatedAt,
                emailVerified: users.emailVerified,
                role: users.role,
                banned: users.banned,
                banReason: users.banReason,
                banExpires: users.banExpires,
                twoFactorEnabled: users.twoFactorEnabled,
              },
            })
            .from(collectionVideos)
            .innerJoin(videos, eq(collectionVideos.videoId, videos.id))
            .innerJoin(users, eq(videos.authorId, users.id))
            .where(eq(collectionVideos.collectionId, id))
            .orderBy(asc(collectionVideos.position));

          return result.map((cv) => ({
            id: cv.id,
            collectionId: cv.collectionId,
            videoId: cv.videoId,
            position: cv.position,
            createdAt: cv.createdAt,
            video: {
              ...cv.video,
              author: cv.author,
            },
          })) as CollectionVideoWithDetails[];
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to fetch collection videos',
            operation: 'getCollectionWithVideos.videos',
            cause: error,
          }),
      });

      const collection = collectionData[0];
      return {
        id: collection.id,
        name: collection.name,
        description: collection.description,
        thumbnailUrl: collection.thumbnailUrl,
        organizationId: collection.organizationId,
        type: collection.type,
        isPublic: collection.isPublic,
        createdById: collection.createdById,
        createdAt: collection.createdAt,
        updatedAt: collection.updatedAt,
        createdBy: collection.createdBy?.id ? collection.createdBy : null,
        videos: collectionVideosData,
        videoCount: collectionVideosData.length,
      } as CollectionWithVideos;
    });

  const getCollection = (id: string): Effect.Effect<Collection, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: () => db.select().from(collections).where(eq(collections.id, id)).limit(1),
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to fetch collection',
            operation: 'getCollection',
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Collection not found',
            entity: 'Collection',
            id,
          }),
        );
      }

      return result[0];
    });

  const createCollection = (data: CreateCollectionInput): Effect.Effect<Collection, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const [newCollection] = await db
          .insert(collections)
          .values({
            name: data.name,
            description: data.description,
            thumbnailUrl: data.thumbnailUrl,
            organizationId: data.organizationId,
            createdById: data.createdById,
            type: data.type ?? 'folder',
            isPublic: data.isPublic ?? false,
          })
          .returning();
        return newCollection;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to create collection',
          operation: 'createCollection',
          cause: error,
        }),
    });

  const updateCollection = (
    id: string,
    data: UpdateCollectionInput,
  ): Effect.Effect<Collection, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          return await db
            .update(collections)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(collections.id, id))
            .returning();
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to update collection',
            operation: 'updateCollection',
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Collection not found',
            entity: 'Collection',
            id,
          }),
        );
      }

      return result[0];
    });

  const deleteCollection = (id: string): Effect.Effect<void, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          return await db.delete(collections).where(eq(collections.id, id)).returning();
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to delete collection',
            operation: 'deleteCollection',
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Collection not found',
            entity: 'Collection',
            id,
          }),
        );
      }
    });

  const addVideoToCollection = (
    collectionId: string,
    videoId: string,
    position?: number,
  ): Effect.Effect<CollectionVideo, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        // If no position specified, add at the end
        let finalPosition = position;
        if (finalPosition === undefined) {
          const maxPosition = await db
            .select({ max: sql<number>`COALESCE(MAX(${collectionVideos.position}), -1)` })
            .from(collectionVideos)
            .where(eq(collectionVideos.collectionId, collectionId));
          finalPosition = (maxPosition[0].max ?? -1) + 1;
        }

        const [newCollectionVideo] = await db
          .insert(collectionVideos)
          .values({
            collectionId,
            videoId,
            position: finalPosition,
          })
          .returning();
        return newCollectionVideo;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to add video to collection',
          operation: 'addVideoToCollection',
          cause: error,
        }),
    });

  const removeVideoFromCollection = (
    collectionId: string,
    videoId: string,
  ): Effect.Effect<void, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          return await db
            .delete(collectionVideos)
            .where(and(eq(collectionVideos.collectionId, collectionId), eq(collectionVideos.videoId, videoId)))
            .returning();
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to remove video from collection',
            operation: 'removeVideoFromCollection',
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Video not found in collection',
            entity: 'CollectionVideo',
            id: `${collectionId}/${videoId}`,
          }),
        );
      }
    });

  const reorderVideos = (collectionId: string, videoIds: readonly string[]): Effect.Effect<void, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        // Update each video's position
        await Promise.all(
          videoIds.map((videoId, index) =>
            db
              .update(collectionVideos)
              .set({ position: index })
              .where(and(eq(collectionVideos.collectionId, collectionId), eq(collectionVideos.videoId, videoId))),
          ),
        );
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to reorder videos',
          operation: 'reorderVideos',
          cause: error,
        }),
    });

  const getAvailableVideos = (
    organizationId: string,
    collectionId: string,
  ): Effect.Effect<(typeof videos.$inferSelect)[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        // Get videos that are not already in this collection
        const videosInCollection = await db
          .select({ videoId: collectionVideos.videoId })
          .from(collectionVideos)
          .where(eq(collectionVideos.collectionId, collectionId));

        const excludeIds = videosInCollection.map((v) => v.videoId);

        if (excludeIds.length === 0) {
          return await db
            .select()
            .from(videos)
            .where(eq(videos.organizationId, organizationId))
            .orderBy(desc(videos.createdAt));
        }

        return await db
          .select()
          .from(videos)
          .where(
            and(
              eq(videos.organizationId, organizationId),
              sql`${videos.id} NOT IN (${sql.join(
                excludeIds.map((id) => sql`${id}`),
                sql`, `,
              )})`,
            ),
          )
          .orderBy(desc(videos.createdAt));
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch available videos',
          operation: 'getAvailableVideos',
          cause: error,
        }),
    });

  const getCollectionProgress = (
    userId: string,
    collectionId: string,
  ): Effect.Effect<CollectionProgressWithDetails | null, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const progressData = await db
          .select({
            id: collectionProgress.id,
            userId: collectionProgress.userId,
            collectionId: collectionProgress.collectionId,
            lastVideoId: collectionProgress.lastVideoId,
            lastPosition: collectionProgress.lastPosition,
            completedVideoIds: collectionProgress.completedVideoIds,
            updatedAt: collectionProgress.updatedAt,
            collection: {
              id: collections.id,
              name: collections.name,
              description: collections.description,
              thumbnailUrl: collections.thumbnailUrl,
              organizationId: collections.organizationId,
              type: collections.type,
              isPublic: collections.isPublic,
              createdById: collections.createdById,
              createdAt: collections.createdAt,
              updatedAt: collections.updatedAt,
            },
            lastVideo: {
              id: videos.id,
              title: videos.title,
              description: videos.description,
              duration: videos.duration,
              thumbnailUrl: videos.thumbnailUrl,
              videoUrl: videos.videoUrl,
              authorId: videos.authorId,
              organizationId: videos.organizationId,
              transcript: videos.transcript,
              transcriptSegments: videos.transcriptSegments,
              processingStatus: videos.processingStatus,
              processingError: videos.processingError,
              aiSummary: videos.aiSummary,
              aiTags: videos.aiTags,
              aiActionItems: videos.aiActionItems,
              createdAt: videos.createdAt,
              updatedAt: videos.updatedAt,
            },
          })
          .from(collectionProgress)
          .innerJoin(collections, eq(collectionProgress.collectionId, collections.id))
          .leftJoin(videos, eq(collectionProgress.lastVideoId, videos.id))
          .where(and(eq(collectionProgress.userId, userId), eq(collectionProgress.collectionId, collectionId)))
          .limit(1);

        if (!progressData.length) {
          return null;
        }

        // Get total video count in collection
        const totalCount = await db
          .select({ count: count() })
          .from(collectionVideos)
          .where(eq(collectionVideos.collectionId, collectionId));

        const progress = progressData[0];
        const completedCount = (progress.completedVideoIds as string[]).length;
        const total = totalCount[0].count;

        return {
          ...progress,
          lastVideo: progress.lastVideo?.id ? progress.lastVideo : null,
          completedCount,
          totalCount: total,
          progressPercentage: total > 0 ? Math.round((completedCount / total) * 100) : 0,
        } as CollectionProgressWithDetails;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch collection progress',
          operation: 'getCollectionProgress',
          cause: error,
        }),
    });

  const updateCollectionProgress = (
    userId: string,
    collectionId: string,
    lastVideoId: string,
    lastPosition: number,
  ): Effect.Effect<typeof collectionProgress.$inferSelect, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        // Upsert the progress
        const existing = await db
          .select()
          .from(collectionProgress)
          .where(and(eq(collectionProgress.userId, userId), eq(collectionProgress.collectionId, collectionId)))
          .limit(1);

        if (existing.length) {
          const [updated] = await db
            .update(collectionProgress)
            .set({
              lastVideoId,
              lastPosition,
              updatedAt: new Date(),
            })
            .where(eq(collectionProgress.id, existing[0].id))
            .returning();
          return updated;
        }

        const [created] = await db
          .insert(collectionProgress)
          .values({
            userId,
            collectionId,
            lastVideoId,
            lastPosition,
            completedVideoIds: [],
          })
          .returning();
        return created;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to update collection progress',
          operation: 'updateCollectionProgress',
          cause: error,
        }),
    });

  const markVideoCompleted = (
    userId: string,
    collectionId: string,
    videoId: string,
  ): Effect.Effect<typeof collectionProgress.$inferSelect, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        // Get or create progress record
        const existing = await db
          .select()
          .from(collectionProgress)
          .where(and(eq(collectionProgress.userId, userId), eq(collectionProgress.collectionId, collectionId)))
          .limit(1);

        if (existing.length) {
          const completedVideoIds = existing[0].completedVideoIds as string[];
          if (!completedVideoIds.includes(videoId)) {
            completedVideoIds.push(videoId);
          }

          const [updated] = await db
            .update(collectionProgress)
            .set({
              completedVideoIds,
              updatedAt: new Date(),
            })
            .where(eq(collectionProgress.id, existing[0].id))
            .returning();
          return updated;
        }

        const [created] = await db
          .insert(collectionProgress)
          .values({
            userId,
            collectionId,
            lastVideoId: videoId,
            lastPosition: 0,
            completedVideoIds: [videoId],
          })
          .returning();
        return created;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to mark video as completed',
          operation: 'markVideoCompleted',
          cause: error,
        }),
    });

  const getCollectionsWithProgress = (
    organizationId: string,
    userId: string,
    type?: CollectionType,
  ): Effect.Effect<CollectionWithProgress[], DatabaseError> =>
    Effect.gen(function* () {
      // Get all collections for the organization
      const collectionsResult = yield* getCollections(organizationId, { type, page: 1, limit: 100 });

      // Get all progress for this user
      const progressData = yield* Effect.tryPromise({
        try: async () => {
          return await db.select().from(collectionProgress).where(eq(collectionProgress.userId, userId));
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to fetch user progress',
            operation: 'getCollectionsWithProgress',
            cause: error,
          }),
      });

      const progressMap = new Map(progressData.map((p) => [p.collectionId, p]));

      return collectionsResult.data.map((collection) => {
        const progress = progressMap.get(collection.id);
        if (!progress) {
          return collection;
        }

        const completedCount = (progress.completedVideoIds as string[]).length;
        return {
          ...collection,
          progress: {
            ...progress,
            collection: collection,
            lastVideo: null,
            completedCount,
            totalCount: collection.videoCount,
            progressPercentage:
              collection.videoCount > 0 ? Math.round((completedCount / collection.videoCount) * 100) : 0,
          } as CollectionProgressWithDetails,
        };
      });
    });

  return {
    getCollections,
    getCollectionWithVideos,
    getCollection,
    createCollection,
    updateCollection,
    deleteCollection,
    addVideoToCollection,
    removeVideoFromCollection,
    reorderVideos,
    getAvailableVideos,
    getCollectionProgress,
    updateCollectionProgress,
    markVideoCompleted,
    getCollectionsWithProgress,
  } satisfies CollectionRepositoryService;
});

// =============================================================================
// Collection Repository Layer
// =============================================================================

export const CollectionRepositoryLive = Layer.effect(CollectionRepository, makeCollectionRepositoryService);

// =============================================================================
// Collection Repository Helper Functions
// =============================================================================

export const getCollections = (
  organizationId: string,
  options?: {
    type?: CollectionType;
    page?: number;
    limit?: number;
  },
): Effect.Effect<PaginatedResponse<CollectionWithVideoCount>, DatabaseError, CollectionRepository> =>
  Effect.gen(function* () {
    const repo = yield* CollectionRepository;
    return yield* repo.getCollections(organizationId, options);
  });

export const getCollectionWithVideos = (
  id: string,
): Effect.Effect<CollectionWithVideos, DatabaseError | NotFoundError, CollectionRepository> =>
  Effect.gen(function* () {
    const repo = yield* CollectionRepository;
    return yield* repo.getCollectionWithVideos(id);
  });

export const getCollection = (
  id: string,
): Effect.Effect<Collection, DatabaseError | NotFoundError, CollectionRepository> =>
  Effect.gen(function* () {
    const repo = yield* CollectionRepository;
    return yield* repo.getCollection(id);
  });

export const createCollection = (
  data: CreateCollectionInput,
): Effect.Effect<Collection, DatabaseError, CollectionRepository> =>
  Effect.gen(function* () {
    const repo = yield* CollectionRepository;
    return yield* repo.createCollection(data);
  });

export const updateCollection = (
  id: string,
  data: UpdateCollectionInput,
): Effect.Effect<Collection, DatabaseError | NotFoundError, CollectionRepository> =>
  Effect.gen(function* () {
    const repo = yield* CollectionRepository;
    return yield* repo.updateCollection(id, data);
  });

export const deleteCollection = (
  id: string,
): Effect.Effect<void, DatabaseError | NotFoundError, CollectionRepository> =>
  Effect.gen(function* () {
    const repo = yield* CollectionRepository;
    return yield* repo.deleteCollection(id);
  });

export const addVideoToCollection = (
  collectionId: string,
  videoId: string,
  position?: number,
): Effect.Effect<CollectionVideo, DatabaseError, CollectionRepository> =>
  Effect.gen(function* () {
    const repo = yield* CollectionRepository;
    return yield* repo.addVideoToCollection(collectionId, videoId, position);
  });

export const removeVideoFromCollection = (
  collectionId: string,
  videoId: string,
): Effect.Effect<void, DatabaseError | NotFoundError, CollectionRepository> =>
  Effect.gen(function* () {
    const repo = yield* CollectionRepository;
    return yield* repo.removeVideoFromCollection(collectionId, videoId);
  });

export const reorderCollectionVideos = (
  collectionId: string,
  videoIds: readonly string[],
): Effect.Effect<void, DatabaseError, CollectionRepository> =>
  Effect.gen(function* () {
    const repo = yield* CollectionRepository;
    return yield* repo.reorderVideos(collectionId, videoIds);
  });

export const getCollectionProgress = (
  userId: string,
  collectionId: string,
): Effect.Effect<CollectionProgressWithDetails | null, DatabaseError, CollectionRepository> =>
  Effect.gen(function* () {
    const repo = yield* CollectionRepository;
    return yield* repo.getCollectionProgress(userId, collectionId);
  });

export const updateCollectionProgress = (
  userId: string,
  collectionId: string,
  lastVideoId: string,
  lastPosition: number,
): Effect.Effect<typeof collectionProgress.$inferSelect, DatabaseError, CollectionRepository> =>
  Effect.gen(function* () {
    const repo = yield* CollectionRepository;
    return yield* repo.updateCollectionProgress(userId, collectionId, lastVideoId, lastPosition);
  });

export const markCollectionVideoCompleted = (
  userId: string,
  collectionId: string,
  videoId: string,
): Effect.Effect<typeof collectionProgress.$inferSelect, DatabaseError, CollectionRepository> =>
  Effect.gen(function* () {
    const repo = yield* CollectionRepository;
    return yield* repo.markVideoCompleted(userId, collectionId, videoId);
  });

export const getCollectionsWithProgress = (
  organizationId: string,
  userId: string,
  type?: CollectionType,
): Effect.Effect<CollectionWithProgress[], DatabaseError, CollectionRepository> =>
  Effect.gen(function* () {
    const repo = yield* CollectionRepository;
    return yield* repo.getCollectionsWithProgress(organizationId, userId, type);
  });

export const getAvailableVideosForCollection = (
  organizationId: string,
  collectionId: string,
): Effect.Effect<(typeof videos.$inferSelect)[], DatabaseError, CollectionRepository> =>
  Effect.gen(function* () {
    const repo = yield* CollectionRepository;
    return yield* repo.getAvailableVideos(organizationId, collectionId);
  });
