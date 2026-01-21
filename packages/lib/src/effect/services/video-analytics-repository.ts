/**
 * Video Analytics Repository Service
 *
 * Provides analytics queries for video views, watch time,
 * and engagement metrics.
 */

import { and, count, desc, eq, gte, sql, sum } from 'drizzle-orm';
import { Context, Data, Effect, Layer } from 'effect';
import { videos, videoViews } from '../../db/schema';
import { Database } from './database';

// =============================================================================
// Error Types
// =============================================================================

export class VideoAnalyticsError extends Data.TaggedError('VideoAnalyticsError')<{
  readonly message: string;
  readonly operation?: string;
  readonly cause?: unknown;
}> {}

// =============================================================================
// Types
// =============================================================================

export interface VideoAnalyticsOverview {
  readonly totalViews: number;
  readonly uniqueViewers: number;
  readonly totalWatchTime: number; // in seconds
  readonly avgCompletionPercent: number;
  readonly totalVideos: number;
}

export interface TopVideo {
  readonly videoId: string;
  readonly viewCount: number;
  readonly totalWatchTime: number;
  readonly avgCompletion: number;
}

export interface VideoDetails {
  readonly id: string;
  readonly title: string;
  readonly thumbnailUrl: string | null;
  readonly duration: string;
}

export interface ViewsByDay {
  readonly date: string;
  readonly viewCount: number;
}

export interface VideoAnalyticsParams {
  readonly organizationId: string;
  readonly startDate: Date;
}

// =============================================================================
// Service Interface
// =============================================================================

export interface VideoAnalyticsRepositoryService {
  /**
   * Get total views in a period
   */
  readonly getTotalViews: (params: VideoAnalyticsParams) => Effect.Effect<number, VideoAnalyticsError>;

  /**
   * Get unique viewers in a period
   */
  readonly getUniqueViewers: (params: VideoAnalyticsParams) => Effect.Effect<number, VideoAnalyticsError>;

  /**
   * Get total watch time in a period (in seconds)
   */
  readonly getTotalWatchTime: (params: VideoAnalyticsParams) => Effect.Effect<number, VideoAnalyticsError>;

  /**
   * Get average completion percentage in a period
   */
  readonly getAvgCompletionPercent: (params: VideoAnalyticsParams) => Effect.Effect<number, VideoAnalyticsError>;

  /**
   * Get top videos by view count
   */
  readonly getTopVideos: (
    params: VideoAnalyticsParams & { readonly limit?: number },
  ) => Effect.Effect<TopVideo[], VideoAnalyticsError>;

  /**
   * Get views aggregated by day
   */
  readonly getViewsByDay: (params: VideoAnalyticsParams) => Effect.Effect<ViewsByDay[], VideoAnalyticsError>;

  /**
   * Get total video count for an organization
   */
  readonly getVideoCount: (organizationId: string) => Effect.Effect<number, VideoAnalyticsError>;

  /**
   * Get complete analytics overview
   */
  readonly getAnalyticsOverview: (
    params: VideoAnalyticsParams,
  ) => Effect.Effect<VideoAnalyticsOverview, VideoAnalyticsError>;

  /**
   * Get video details by IDs (for enriching top videos)
   */
  readonly getVideoDetailsByIds: (videoIds: string[]) => Effect.Effect<VideoDetails[], VideoAnalyticsError>;
}

// =============================================================================
// Service Tag
// =============================================================================

export class VideoAnalyticsRepository extends Context.Tag('VideoAnalyticsRepository')<
  VideoAnalyticsRepository,
  VideoAnalyticsRepositoryService
>() {}

// =============================================================================
// Service Implementation
// =============================================================================

const makeVideoAnalyticsRepositoryService = Effect.gen(function* () {
  const database = yield* Database;
  const db = database.db;

  const getTotalViews = (params: VideoAnalyticsParams): Effect.Effect<number, VideoAnalyticsError> =>
    Effect.tryPromise({
      try: async () => {
        const result = await db
          .select({ count: count() })
          .from(videoViews)
          .where(
            and(eq(videoViews.organizationId, params.organizationId), gte(videoViews.createdAt, params.startDate)),
          );
        return result[0]?.count || 0;
      },
      catch: (error) =>
        new VideoAnalyticsError({
          message: 'Failed to fetch total views',
          operation: 'getTotalViews',
          cause: error,
        }),
    });

  const getUniqueViewers = (params: VideoAnalyticsParams): Effect.Effect<number, VideoAnalyticsError> =>
    Effect.tryPromise({
      try: async () => {
        const result = await db
          .select({ count: sql<number>`COUNT(DISTINCT ${videoViews.userId})` })
          .from(videoViews)
          .where(
            and(
              eq(videoViews.organizationId, params.organizationId),
              gte(videoViews.createdAt, params.startDate),
              sql`${videoViews.userId} IS NOT NULL`,
            ),
          );
        return result[0]?.count || 0;
      },
      catch: (error) =>
        new VideoAnalyticsError({
          message: 'Failed to fetch unique viewers',
          operation: 'getUniqueViewers',
          cause: error,
        }),
    });

  const getTotalWatchTime = (params: VideoAnalyticsParams): Effect.Effect<number, VideoAnalyticsError> =>
    Effect.tryPromise({
      try: async () => {
        const result = await db
          .select({ total: sum(videoViews.watchDuration) })
          .from(videoViews)
          .where(
            and(eq(videoViews.organizationId, params.organizationId), gte(videoViews.createdAt, params.startDate)),
          );
        return Number(result[0]?.total) || 0;
      },
      catch: (error) =>
        new VideoAnalyticsError({
          message: 'Failed to fetch watch time',
          operation: 'getTotalWatchTime',
          cause: error,
        }),
    });

  const getAvgCompletionPercent = (params: VideoAnalyticsParams): Effect.Effect<number, VideoAnalyticsError> =>
    Effect.tryPromise({
      try: async () => {
        const result = await db
          .select({ avg: sql<number>`AVG(${videoViews.completionPercent})` })
          .from(videoViews)
          .where(
            and(eq(videoViews.organizationId, params.organizationId), gte(videoViews.createdAt, params.startDate)),
          );
        return Math.round(Number(result[0]?.avg) || 0);
      },
      catch: (error) =>
        new VideoAnalyticsError({
          message: 'Failed to fetch avg completion',
          operation: 'getAvgCompletionPercent',
          cause: error,
        }),
    });

  const getTopVideos = (
    params: VideoAnalyticsParams & { readonly limit?: number },
  ): Effect.Effect<TopVideo[], VideoAnalyticsError> =>
    Effect.tryPromise({
      try: async () => {
        const result = await db
          .select({
            videoId: videoViews.videoId,
            viewCount: count(),
            totalWatchTime: sum(videoViews.watchDuration),
            avgCompletion: sql<number>`AVG(${videoViews.completionPercent})`,
          })
          .from(videoViews)
          .where(and(eq(videoViews.organizationId, params.organizationId), gte(videoViews.createdAt, params.startDate)))
          .groupBy(videoViews.videoId)
          .orderBy(desc(count()))
          .limit(params.limit ?? 10);

        return result.map((v) => ({
          videoId: v.videoId,
          viewCount: v.viewCount,
          totalWatchTime: Number(v.totalWatchTime) || 0,
          avgCompletion: Math.round(Number(v.avgCompletion) || 0),
        }));
      },
      catch: (error) =>
        new VideoAnalyticsError({
          message: 'Failed to fetch top videos',
          operation: 'getTopVideos',
          cause: error,
        }),
    });

  const getViewsByDay = (params: VideoAnalyticsParams): Effect.Effect<ViewsByDay[], VideoAnalyticsError> =>
    Effect.tryPromise({
      try: async () => {
        const result = await db
          .select({
            date: sql<string>`DATE(${videoViews.createdAt})`,
            viewCount: count(),
          })
          .from(videoViews)
          .where(and(eq(videoViews.organizationId, params.organizationId), gte(videoViews.createdAt, params.startDate)))
          .groupBy(sql`DATE(${videoViews.createdAt})`)
          .orderBy(sql`DATE(${videoViews.createdAt})`);

        return result.map((v) => ({
          date: v.date,
          viewCount: v.viewCount,
        }));
      },
      catch: (error) =>
        new VideoAnalyticsError({
          message: 'Failed to fetch views by day',
          operation: 'getViewsByDay',
          cause: error,
        }),
    });

  const getVideoCount = (organizationId: string): Effect.Effect<number, VideoAnalyticsError> =>
    Effect.tryPromise({
      try: async () => {
        const result = await db
          .select({ count: count() })
          .from(videos)
          .where(eq(videos.organizationId, organizationId));
        return result[0]?.count || 0;
      },
      catch: (error) =>
        new VideoAnalyticsError({
          message: 'Failed to fetch video count',
          operation: 'getVideoCount',
          cause: error,
        }),
    });

  const getAnalyticsOverview = (
    params: VideoAnalyticsParams,
  ): Effect.Effect<VideoAnalyticsOverview, VideoAnalyticsError> =>
    Effect.all(
      {
        totalViews: getTotalViews(params),
        uniqueViewers: getUniqueViewers(params),
        totalWatchTime: getTotalWatchTime(params),
        avgCompletionPercent: getAvgCompletionPercent(params),
        totalVideos: getVideoCount(params.organizationId),
      },
      { concurrency: 5 },
    );

  const getVideoDetailsByIds = (videoIds: string[]): Effect.Effect<VideoDetails[], VideoAnalyticsError> =>
    Effect.tryPromise({
      try: async () => {
        if (videoIds.length === 0) return [];
        const result = await db.query.videos.findMany({
          where: (videos, { inArray }) => inArray(videos.id, videoIds),
          columns: { id: true, title: true, thumbnailUrl: true, duration: true },
        });
        return result.map((v) => ({
          id: v.id,
          title: v.title,
          thumbnailUrl: v.thumbnailUrl,
          duration: v.duration,
        }));
      },
      catch: (error) =>
        new VideoAnalyticsError({
          message: 'Failed to fetch video details',
          operation: 'getVideoDetailsByIds',
          cause: error,
        }),
    });

  return {
    getTotalViews,
    getUniqueViewers,
    getTotalWatchTime,
    getAvgCompletionPercent,
    getTopVideos,
    getViewsByDay,
    getVideoCount,
    getAnalyticsOverview,
    getVideoDetailsByIds,
  } satisfies VideoAnalyticsRepositoryService;
});

// =============================================================================
// Service Layer
// =============================================================================

export const VideoAnalyticsRepositoryLive = Layer.effect(VideoAnalyticsRepository, makeVideoAnalyticsRepositoryService);

// =============================================================================
// Helper Functions (for convenience)
// =============================================================================

export const getTotalViews = (params: VideoAnalyticsParams) =>
  Effect.flatMap(VideoAnalyticsRepository, (repo) => repo.getTotalViews(params));

export const getUniqueViewers = (params: VideoAnalyticsParams) =>
  Effect.flatMap(VideoAnalyticsRepository, (repo) => repo.getUniqueViewers(params));

export const getTotalWatchTime = (params: VideoAnalyticsParams) =>
  Effect.flatMap(VideoAnalyticsRepository, (repo) => repo.getTotalWatchTime(params));

export const getAvgCompletionPercent = (params: VideoAnalyticsParams) =>
  Effect.flatMap(VideoAnalyticsRepository, (repo) => repo.getAvgCompletionPercent(params));

export const getTopVideos = (params: VideoAnalyticsParams & { readonly limit?: number }) =>
  Effect.flatMap(VideoAnalyticsRepository, (repo) => repo.getTopVideos(params));

export const getViewsByDay = (params: VideoAnalyticsParams) =>
  Effect.flatMap(VideoAnalyticsRepository, (repo) => repo.getViewsByDay(params));

export const getAnalyticsVideoCount = (organizationId: string) =>
  Effect.flatMap(VideoAnalyticsRepository, (repo) => repo.getVideoCount(organizationId));

export const getAnalyticsOverview = (params: VideoAnalyticsParams) =>
  Effect.flatMap(VideoAnalyticsRepository, (repo) => repo.getAnalyticsOverview(params));

export const getVideoDetailsByIds = (videoIds: string[]) =>
  Effect.flatMap(VideoAnalyticsRepository, (repo) => repo.getVideoDetailsByIds(videoIds));
