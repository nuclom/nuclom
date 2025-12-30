/**
 * Series Repository Service using Effect-TS
 *
 * Provides type-safe database operations for series (collections).
 */

import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import { collections, seriesProgress, seriesVideos, users, videos } from "@/lib/db/schema";
import type {
  PaginatedResponse,
  SeriesProgressWithDetails,
  SeriesVideoWithDetails,
  SeriesWithVideoCount,
  SeriesWithVideos,
} from "@/lib/types";
import { DatabaseError, NotFoundError } from "../errors";
import { Database } from "./database";

// =============================================================================
// Types
// =============================================================================

export interface CreateSeriesInput {
  readonly name: string;
  readonly description?: string;
  readonly thumbnailUrl?: string;
  readonly organizationId: string;
  readonly createdById?: string;
  readonly isPublic?: boolean;
}

export interface UpdateSeriesInput {
  readonly name?: string;
  readonly description?: string | null;
  readonly thumbnailUrl?: string | null;
  readonly isPublic?: boolean;
}

export interface SeriesRepositoryService {
  /**
   * Get paginated series for an organization
   */
  readonly getSeries: (
    organizationId: string,
    page?: number,
    limit?: number,
  ) => Effect.Effect<PaginatedResponse<SeriesWithVideoCount>, DatabaseError>;

  /**
   * Get a single series with its videos
   */
  readonly getSeriesWithVideos: (id: string) => Effect.Effect<SeriesWithVideos, DatabaseError | NotFoundError>;

  /**
   * Create a new series
   */
  readonly createSeries: (data: CreateSeriesInput) => Effect.Effect<typeof collections.$inferSelect, DatabaseError>;

  /**
   * Update a series
   */
  readonly updateSeries: (
    id: string,
    data: UpdateSeriesInput,
  ) => Effect.Effect<typeof collections.$inferSelect, DatabaseError | NotFoundError>;

  /**
   * Delete a series
   */
  readonly deleteSeries: (id: string) => Effect.Effect<void, DatabaseError | NotFoundError>;

  /**
   * Add a video to a series
   */
  readonly addVideoToSeries: (
    seriesId: string,
    videoId: string,
    position?: number,
  ) => Effect.Effect<typeof seriesVideos.$inferSelect, DatabaseError>;

  /**
   * Remove a video from a series
   */
  readonly removeVideoFromSeries: (
    seriesId: string,
    videoId: string,
  ) => Effect.Effect<void, DatabaseError | NotFoundError>;

  /**
   * Reorder videos in a series
   */
  readonly reorderVideos: (seriesId: string, videoIds: string[]) => Effect.Effect<void, DatabaseError>;

  /**
   * Get user's progress for a series
   */
  readonly getSeriesProgress: (
    userId: string,
    seriesId: string,
  ) => Effect.Effect<SeriesProgressWithDetails | null, DatabaseError>;

  /**
   * Update user's progress for a series
   */
  readonly updateSeriesProgress: (
    userId: string,
    seriesId: string,
    lastVideoId: string,
    lastPosition: number,
  ) => Effect.Effect<typeof seriesProgress.$inferSelect, DatabaseError>;

  /**
   * Mark a video as completed in a series
   */
  readonly markVideoCompleted: (
    userId: string,
    seriesId: string,
    videoId: string,
  ) => Effect.Effect<typeof seriesProgress.$inferSelect, DatabaseError>;

  /**
   * Get all series with user's progress
   */
  readonly getSeriesWithProgress: (
    organizationId: string,
    userId: string,
  ) => Effect.Effect<(SeriesWithVideoCount & { progress?: SeriesProgressWithDetails })[], DatabaseError>;

  /**
   * Get videos not in a series (for picker)
   */
  readonly getAvailableVideos: (
    organizationId: string,
    seriesId: string,
  ) => Effect.Effect<(typeof videos.$inferSelect)[], DatabaseError>;
}

// =============================================================================
// Series Repository Tag
// =============================================================================

export class SeriesRepository extends Context.Tag("SeriesRepository")<SeriesRepository, SeriesRepositoryService>() {}

// =============================================================================
// Series Repository Implementation
// =============================================================================

const makeSeriesRepositoryService = Effect.gen(function* () {
  const { db } = yield* Database;

  const getSeries = (
    organizationId: string,
    page = 1,
    limit = 20,
  ): Effect.Effect<PaginatedResponse<SeriesWithVideoCount>, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const offset = (page - 1) * limit;

        // Get series with video counts
        const seriesData = await db
          .select({
            id: collections.id,
            name: collections.name,
            description: collections.description,
            thumbnailUrl: collections.thumbnailUrl,
            organizationId: collections.organizationId,
            isPublic: collections.isPublic,
            createdById: collections.createdById,
            createdAt: collections.createdAt,
            updatedAt: collections.updatedAt,
            videoCount: sql<number>`(
              SELECT COUNT(*)::int FROM ${seriesVideos}
              WHERE ${seriesVideos.seriesId} = ${collections.id}
            )`.as("video_count"),
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
            },
          })
          .from(collections)
          .leftJoin(users, eq(collections.createdById, users.id))
          .where(eq(collections.organizationId, organizationId))
          .orderBy(desc(collections.createdAt))
          .offset(offset)
          .limit(limit);

        const totalCount = await db
          .select({ count: count() })
          .from(collections)
          .where(eq(collections.organizationId, organizationId));

        return {
          data: seriesData.map((s) => ({
            ...s,
            createdBy: s.createdBy?.id ? s.createdBy : null,
          })) as SeriesWithVideoCount[],
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
          message: "Failed to fetch series",
          operation: "getSeries",
          cause: error,
        }),
    });

  const getSeriesWithVideos = (id: string): Effect.Effect<SeriesWithVideos, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      // Get the series
      const seriesData = yield* Effect.tryPromise({
        try: async () => {
          return await db
            .select({
              id: collections.id,
              name: collections.name,
              description: collections.description,
              thumbnailUrl: collections.thumbnailUrl,
              organizationId: collections.organizationId,
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
              },
            })
            .from(collections)
            .leftJoin(users, eq(collections.createdById, users.id))
            .where(eq(collections.id, id))
            .limit(1);
        },
        catch: (error) =>
          new DatabaseError({
            message: "Failed to fetch series",
            operation: "getSeriesWithVideos",
            cause: error,
          }),
      });

      if (!seriesData.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: "Series not found",
            entity: "Series",
            id,
          }),
        );
      }

      // Get videos in this series with ordering
      const seriesVideosData = yield* Effect.tryPromise({
        try: async () => {
          const result = await db
            .select({
              id: seriesVideos.id,
              seriesId: seriesVideos.seriesId,
              videoId: seriesVideos.videoId,
              position: seriesVideos.position,
              createdAt: seriesVideos.createdAt,
              video: {
                id: videos.id,
                title: videos.title,
                description: videos.description,
                duration: videos.duration,
                thumbnailUrl: videos.thumbnailUrl,
                videoUrl: videos.videoUrl,
                authorId: videos.authorId,
                organizationId: videos.organizationId,
                channelId: videos.channelId,
                collectionId: videos.collectionId,
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
              },
            })
            .from(seriesVideos)
            .innerJoin(videos, eq(seriesVideos.videoId, videos.id))
            .innerJoin(users, eq(videos.authorId, users.id))
            .where(eq(seriesVideos.seriesId, id))
            .orderBy(asc(seriesVideos.position));

          return result.map((sv) => ({
            id: sv.id,
            seriesId: sv.seriesId,
            videoId: sv.videoId,
            position: sv.position,
            createdAt: sv.createdAt,
            video: {
              ...sv.video,
              author: sv.author,
            },
          })) as SeriesVideoWithDetails[];
        },
        catch: (error) =>
          new DatabaseError({
            message: "Failed to fetch series videos",
            operation: "getSeriesWithVideos.videos",
            cause: error,
          }),
      });

      const series = seriesData[0];
      return {
        id: series.id,
        name: series.name,
        description: series.description,
        thumbnailUrl: series.thumbnailUrl,
        organizationId: series.organizationId,
        isPublic: series.isPublic,
        createdById: series.createdById,
        createdAt: series.createdAt,
        updatedAt: series.updatedAt,
        createdBy: series.createdBy?.id ? series.createdBy : null,
        videos: seriesVideosData,
        videoCount: seriesVideosData.length,
      } as SeriesWithVideos;
    });

  const createSeries = (data: CreateSeriesInput): Effect.Effect<typeof collections.$inferSelect, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const [newSeries] = await db.insert(collections).values(data).returning();
        return newSeries;
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to create series",
          operation: "createSeries",
          cause: error,
        }),
    });

  const updateSeries = (
    id: string,
    data: UpdateSeriesInput,
  ): Effect.Effect<typeof collections.$inferSelect, DatabaseError | NotFoundError> =>
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
            message: "Failed to update series",
            operation: "updateSeries",
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: "Series not found",
            entity: "Series",
            id,
          }),
        );
      }

      return result[0];
    });

  const deleteSeries = (id: string): Effect.Effect<void, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          return await db.delete(collections).where(eq(collections.id, id)).returning();
        },
        catch: (error) =>
          new DatabaseError({
            message: "Failed to delete series",
            operation: "deleteSeries",
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: "Series not found",
            entity: "Series",
            id,
          }),
        );
      }
    });

  const addVideoToSeries = (
    seriesId: string,
    videoId: string,
    position?: number,
  ): Effect.Effect<typeof seriesVideos.$inferSelect, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        // If no position specified, add at the end
        let finalPosition = position;
        if (finalPosition === undefined) {
          const maxPosition = await db
            .select({ max: sql<number>`COALESCE(MAX(${seriesVideos.position}), -1)` })
            .from(seriesVideos)
            .where(eq(seriesVideos.seriesId, seriesId));
          finalPosition = (maxPosition[0].max ?? -1) + 1;
        }

        const [newSeriesVideo] = await db
          .insert(seriesVideos)
          .values({
            seriesId,
            videoId,
            position: finalPosition,
          })
          .returning();
        return newSeriesVideo;
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to add video to series",
          operation: "addVideoToSeries",
          cause: error,
        }),
    });

  const removeVideoFromSeries = (
    seriesId: string,
    videoId: string,
  ): Effect.Effect<void, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          return await db
            .delete(seriesVideos)
            .where(and(eq(seriesVideos.seriesId, seriesId), eq(seriesVideos.videoId, videoId)))
            .returning();
        },
        catch: (error) =>
          new DatabaseError({
            message: "Failed to remove video from series",
            operation: "removeVideoFromSeries",
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: "Video not found in series",
            entity: "SeriesVideo",
            id: `${seriesId}/${videoId}`,
          }),
        );
      }
    });

  const reorderVideos = (seriesId: string, videoIds: string[]): Effect.Effect<void, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        // Update each video's position in a transaction-like manner
        await Promise.all(
          videoIds.map((videoId, index) =>
            db
              .update(seriesVideos)
              .set({ position: index })
              .where(and(eq(seriesVideos.seriesId, seriesId), eq(seriesVideos.videoId, videoId))),
          ),
        );
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to reorder videos",
          operation: "reorderVideos",
          cause: error,
        }),
    });

  const getSeriesProgress = (
    userId: string,
    seriesId: string,
  ): Effect.Effect<SeriesProgressWithDetails | null, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const progressData = await db
          .select({
            id: seriesProgress.id,
            userId: seriesProgress.userId,
            seriesId: seriesProgress.seriesId,
            lastVideoId: seriesProgress.lastVideoId,
            lastPosition: seriesProgress.lastPosition,
            completedVideoIds: seriesProgress.completedVideoIds,
            updatedAt: seriesProgress.updatedAt,
            series: {
              id: collections.id,
              name: collections.name,
              description: collections.description,
              thumbnailUrl: collections.thumbnailUrl,
              organizationId: collections.organizationId,
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
              channelId: videos.channelId,
              collectionId: videos.collectionId,
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
          .from(seriesProgress)
          .innerJoin(collections, eq(seriesProgress.seriesId, collections.id))
          .leftJoin(videos, eq(seriesProgress.lastVideoId, videos.id))
          .where(and(eq(seriesProgress.userId, userId), eq(seriesProgress.seriesId, seriesId)))
          .limit(1);

        if (!progressData.length) {
          return null;
        }

        // Get total video count in series
        const totalCount = await db
          .select({ count: count() })
          .from(seriesVideos)
          .where(eq(seriesVideos.seriesId, seriesId));

        const progress = progressData[0];
        const completedCount = (progress.completedVideoIds as string[]).length;
        const total = totalCount[0].count;

        return {
          ...progress,
          lastVideo: progress.lastVideo?.id ? progress.lastVideo : null,
          completedCount,
          totalCount: total,
          progressPercentage: total > 0 ? Math.round((completedCount / total) * 100) : 0,
        } as SeriesProgressWithDetails;
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch series progress",
          operation: "getSeriesProgress",
          cause: error,
        }),
    });

  const updateSeriesProgress = (
    userId: string,
    seriesId: string,
    lastVideoId: string,
    lastPosition: number,
  ): Effect.Effect<typeof seriesProgress.$inferSelect, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        // Upsert the progress
        const existing = await db
          .select()
          .from(seriesProgress)
          .where(and(eq(seriesProgress.userId, userId), eq(seriesProgress.seriesId, seriesId)))
          .limit(1);

        if (existing.length) {
          const [updated] = await db
            .update(seriesProgress)
            .set({
              lastVideoId,
              lastPosition,
              updatedAt: new Date(),
            })
            .where(eq(seriesProgress.id, existing[0].id))
            .returning();
          return updated;
        }

        const [created] = await db
          .insert(seriesProgress)
          .values({
            userId,
            seriesId,
            lastVideoId,
            lastPosition,
            completedVideoIds: [],
          })
          .returning();
        return created;
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to update series progress",
          operation: "updateSeriesProgress",
          cause: error,
        }),
    });

  const markVideoCompleted = (
    userId: string,
    seriesId: string,
    videoId: string,
  ): Effect.Effect<typeof seriesProgress.$inferSelect, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        // Get or create progress record
        const existing = await db
          .select()
          .from(seriesProgress)
          .where(and(eq(seriesProgress.userId, userId), eq(seriesProgress.seriesId, seriesId)))
          .limit(1);

        if (existing.length) {
          const completedVideoIds = existing[0].completedVideoIds as string[];
          if (!completedVideoIds.includes(videoId)) {
            completedVideoIds.push(videoId);
          }

          const [updated] = await db
            .update(seriesProgress)
            .set({
              completedVideoIds,
              updatedAt: new Date(),
            })
            .where(eq(seriesProgress.id, existing[0].id))
            .returning();
          return updated;
        }

        const [created] = await db
          .insert(seriesProgress)
          .values({
            userId,
            seriesId,
            lastVideoId: videoId,
            lastPosition: 0,
            completedVideoIds: [videoId],
          })
          .returning();
        return created;
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to mark video as completed",
          operation: "markVideoCompleted",
          cause: error,
        }),
    });

  const getSeriesWithProgress = (
    organizationId: string,
    userId: string,
  ): Effect.Effect<(SeriesWithVideoCount & { progress?: SeriesProgressWithDetails })[], DatabaseError> =>
    Effect.gen(function* () {
      // Get all series for the organization
      const seriesResult = yield* getSeries(organizationId, 1, 100);

      // Get all progress for this user
      const progressData = yield* Effect.tryPromise({
        try: async () => {
          return await db.select().from(seriesProgress).where(eq(seriesProgress.userId, userId));
        },
        catch: (error) =>
          new DatabaseError({
            message: "Failed to fetch user progress",
            operation: "getSeriesWithProgress",
            cause: error,
          }),
      });

      const progressMap = new Map(progressData.map((p) => [p.seriesId, p]));

      return seriesResult.data.map((series) => {
        const progress = progressMap.get(series.id);
        if (!progress) {
          return series;
        }

        const completedCount = (progress.completedVideoIds as string[]).length;
        return {
          ...series,
          progress: {
            ...progress,
            series: series,
            lastVideo: null,
            completedCount,
            totalCount: series.videoCount,
            progressPercentage: series.videoCount > 0 ? Math.round((completedCount / series.videoCount) * 100) : 0,
          } as SeriesProgressWithDetails,
        };
      });
    });

  const getAvailableVideos = (
    organizationId: string,
    seriesId: string,
  ): Effect.Effect<(typeof videos.$inferSelect)[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        // Get videos that are not already in this series
        const videosInSeries = await db
          .select({ videoId: seriesVideos.videoId })
          .from(seriesVideos)
          .where(eq(seriesVideos.seriesId, seriesId));

        const excludeIds = videosInSeries.map((v) => v.videoId);

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
          message: "Failed to fetch available videos",
          operation: "getAvailableVideos",
          cause: error,
        }),
    });

  return {
    getSeries,
    getSeriesWithVideos,
    createSeries,
    updateSeries,
    deleteSeries,
    addVideoToSeries,
    removeVideoFromSeries,
    reorderVideos,
    getSeriesProgress,
    updateSeriesProgress,
    markVideoCompleted,
    getSeriesWithProgress,
    getAvailableVideos,
  } satisfies SeriesRepositoryService;
});

// =============================================================================
// Series Repository Layer
// =============================================================================

export const SeriesRepositoryLive = Layer.effect(SeriesRepository, makeSeriesRepositoryService);

// =============================================================================
// Series Repository Helper Functions
// =============================================================================

export const getSeries = (
  organizationId: string,
  page?: number,
  limit?: number,
): Effect.Effect<PaginatedResponse<SeriesWithVideoCount>, DatabaseError, SeriesRepository> =>
  Effect.gen(function* () {
    const repo = yield* SeriesRepository;
    return yield* repo.getSeries(organizationId, page, limit);
  });

export const getSeriesWithVideos = (
  id: string,
): Effect.Effect<SeriesWithVideos, DatabaseError | NotFoundError, SeriesRepository> =>
  Effect.gen(function* () {
    const repo = yield* SeriesRepository;
    return yield* repo.getSeriesWithVideos(id);
  });

export const createSeries = (
  data: CreateSeriesInput,
): Effect.Effect<typeof collections.$inferSelect, DatabaseError, SeriesRepository> =>
  Effect.gen(function* () {
    const repo = yield* SeriesRepository;
    return yield* repo.createSeries(data);
  });

export const updateSeries = (
  id: string,
  data: UpdateSeriesInput,
): Effect.Effect<typeof collections.$inferSelect, DatabaseError | NotFoundError, SeriesRepository> =>
  Effect.gen(function* () {
    const repo = yield* SeriesRepository;
    return yield* repo.updateSeries(id, data);
  });

export const deleteSeries = (id: string): Effect.Effect<void, DatabaseError | NotFoundError, SeriesRepository> =>
  Effect.gen(function* () {
    const repo = yield* SeriesRepository;
    return yield* repo.deleteSeries(id);
  });

export const addVideoToSeries = (
  seriesId: string,
  videoId: string,
  position?: number,
): Effect.Effect<typeof seriesVideos.$inferSelect, DatabaseError, SeriesRepository> =>
  Effect.gen(function* () {
    const repo = yield* SeriesRepository;
    return yield* repo.addVideoToSeries(seriesId, videoId, position);
  });

export const removeVideoFromSeries = (
  seriesId: string,
  videoId: string,
): Effect.Effect<void, DatabaseError | NotFoundError, SeriesRepository> =>
  Effect.gen(function* () {
    const repo = yield* SeriesRepository;
    return yield* repo.removeVideoFromSeries(seriesId, videoId);
  });

export const reorderSeriesVideos = (
  seriesId: string,
  videoIds: string[],
): Effect.Effect<void, DatabaseError, SeriesRepository> =>
  Effect.gen(function* () {
    const repo = yield* SeriesRepository;
    return yield* repo.reorderVideos(seriesId, videoIds);
  });

export const getSeriesProgress = (
  userId: string,
  seriesId: string,
): Effect.Effect<SeriesProgressWithDetails | null, DatabaseError, SeriesRepository> =>
  Effect.gen(function* () {
    const repo = yield* SeriesRepository;
    return yield* repo.getSeriesProgress(userId, seriesId);
  });

export const updateSeriesProgress = (
  userId: string,
  seriesId: string,
  lastVideoId: string,
  lastPosition: number,
): Effect.Effect<typeof seriesProgress.$inferSelect, DatabaseError, SeriesRepository> =>
  Effect.gen(function* () {
    const repo = yield* SeriesRepository;
    return yield* repo.updateSeriesProgress(userId, seriesId, lastVideoId, lastPosition);
  });

export const markSeriesVideoCompleted = (
  userId: string,
  seriesId: string,
  videoId: string,
): Effect.Effect<typeof seriesProgress.$inferSelect, DatabaseError, SeriesRepository> =>
  Effect.gen(function* () {
    const repo = yield* SeriesRepository;
    return yield* repo.markVideoCompleted(userId, seriesId, videoId);
  });

export const getSeriesWithProgress = (
  organizationId: string,
  userId: string,
): Effect.Effect<
  (SeriesWithVideoCount & { progress?: SeriesProgressWithDetails })[],
  DatabaseError,
  SeriesRepository
> =>
  Effect.gen(function* () {
    const repo = yield* SeriesRepository;
    return yield* repo.getSeriesWithProgress(organizationId, userId);
  });

export const getAvailableVideosForSeries = (
  organizationId: string,
  seriesId: string,
): Effect.Effect<(typeof videos.$inferSelect)[], DatabaseError, SeriesRepository> =>
  Effect.gen(function* () {
    const repo = yield* SeriesRepository;
    return yield* repo.getAvailableVideos(organizationId, seriesId);
  });
