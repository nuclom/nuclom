/**
 * Video Recommendations Service using Effect-TS
 *
 * Provides personalized video recommendations based on:
 * - User watch history
 * - Video similarity (tags, topics)
 * - Organization popularity
 * - Collaborative filtering patterns
 */

import { and, desc, eq, inArray, isNull, ne, notInArray, sql } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import { videoProgresses, videos, users, type Video } from "@/lib/db/schema";
import type { VideoWithAuthor } from "@/lib/types";
import { DatabaseError } from "../errors";
import { Database } from "./database";

// =============================================================================
// Types
// =============================================================================

export interface RecommendationOptions {
  /** Maximum number of recommendations to return */
  readonly limit?: number;
  /** Exclude these video IDs from recommendations */
  readonly excludeVideoIds?: ReadonlyArray<string>;
  /** Only include videos from specific channels */
  readonly channelIds?: ReadonlyArray<string>;
  /** Only include videos with these tags */
  readonly tags?: ReadonlyArray<string>;
}

export interface ContinueWatchingItem {
  readonly video: VideoWithAuthor;
  readonly progress: number; // 0-1
  readonly lastWatchedAt: Date;
  readonly remainingTime: string;
}

export interface TrendingVideo {
  readonly video: VideoWithAuthor;
  readonly viewCount: number;
  readonly trendingScore: number;
}

export interface RecommendationsServiceInterface {
  /**
   * Get personalized recommendations for a user
   */
  readonly getRecommendations: (
    userId: string,
    organizationId: string,
    options?: RecommendationOptions,
  ) => Effect.Effect<VideoWithAuthor[], DatabaseError>;

  /**
   * Get videos to continue watching
   */
  readonly getContinueWatching: (
    userId: string,
    organizationId: string,
    limit?: number,
  ) => Effect.Effect<ContinueWatchingItem[], DatabaseError>;

  /**
   * Get trending videos in an organization
   */
  readonly getTrending: (
    organizationId: string,
    limit?: number,
    timeframe?: "day" | "week" | "month",
  ) => Effect.Effect<TrendingVideo[], DatabaseError>;

  /**
   * Get similar videos based on tags and content
   */
  readonly getSimilarVideos: (videoId: string, limit?: number) => Effect.Effect<VideoWithAuthor[], DatabaseError>;

  /**
   * Get recently watched videos for a user
   */
  readonly getRecentlyWatched: (
    userId: string,
    organizationId: string,
    limit?: number,
  ) => Effect.Effect<VideoWithAuthor[], DatabaseError>;

  /**
   * Get videos from channels the user frequently watches
   */
  readonly getFromFavoriteChannels: (
    userId: string,
    organizationId: string,
    limit?: number,
  ) => Effect.Effect<VideoWithAuthor[], DatabaseError>;

  /**
   * Record a video view for recommendations
   */
  readonly recordView: (userId: string, videoId: string, progress: number) => Effect.Effect<void, DatabaseError>;
}

// =============================================================================
// Recommendations Service Tag
// =============================================================================

export class Recommendations extends Context.Tag("Recommendations")<
  Recommendations,
  RecommendationsServiceInterface
>() {}

// =============================================================================
// Helper Functions
// =============================================================================

const parseDuration = (duration: string): number => {
  const parts = duration.split(":").map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parts[0] || 0;
};

const formatDuration = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

// =============================================================================
// Recommendations Service Implementation
// =============================================================================

const makeRecommendationsService = Effect.gen(function* () {
  const { db } = yield* Database;

  const getRecommendations = (
    userId: string,
    organizationId: string,
    options: RecommendationOptions = {},
  ): Effect.Effect<VideoWithAuthor[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const limit = options.limit ?? 10;
        const excludeIds = options.excludeVideoIds ?? [];

        // Get user's watch history to find preferences
        const watchHistory = await db
          .select({
            videoId: videoProgresses.videoId,
            tags: videos.aiTags,
            channelId: videos.channelId,
          })
          .from(videoProgresses)
          .innerJoin(videos, eq(videoProgresses.videoId, videos.id))
          .where(eq(videoProgresses.userId, userId))
          .orderBy(desc(videoProgresses.lastWatchedAt))
          .limit(20);

        // Extract preferred tags from watch history
        const tagCounts = new Map<string, number>();
        for (const item of watchHistory) {
          if (item.tags) {
            for (const tag of item.tags) {
              tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
            }
          }
        }

        // Get preferred channels
        const channelCounts = new Map<string, number>();
        for (const item of watchHistory) {
          if (item.channelId) {
            channelCounts.set(item.channelId, (channelCounts.get(item.channelId) || 0) + 1);
          }
        }

        // Get watched video IDs to exclude
        const watchedVideoIds = watchHistory.map((h) => h.videoId);
        const allExcludeIds = [...new Set([...excludeIds, ...watchedVideoIds])];

        // Build conditions
        const conditions = [
          eq(videos.organizationId, organizationId),
          isNull(videos.deletedAt),
          eq(videos.processingStatus, "completed"),
        ];

        if (allExcludeIds.length > 0) {
          conditions.push(notInArray(videos.id, allExcludeIds));
        }

        if (options.channelIds && options.channelIds.length > 0) {
          conditions.push(inArray(videos.channelId, [...options.channelIds]));
        }

        // Get recommendations with scoring
        const recommendations = await db
          .select({
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
            deletedAt: videos.deletedAt,
            retentionUntil: videos.retentionUntil,
            createdAt: videos.createdAt,
            updatedAt: videos.updatedAt,
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
          .from(videos)
          .innerJoin(users, eq(videos.authorId, users.id))
          .where(and(...conditions))
          .orderBy(desc(videos.createdAt))
          .limit(limit * 3); // Get more than needed to filter

        // Score and sort recommendations
        const scoredRecommendations = recommendations.map((video) => {
          let score = 0;

          // Score based on tag overlap
          if (video.aiTags) {
            for (const tag of video.aiTags) {
              score += (tagCounts.get(tag) || 0) * 10;
            }
          }

          // Score based on preferred channels
          if (video.channelId && channelCounts.has(video.channelId)) {
            score += (channelCounts.get(video.channelId) || 0) * 20;
          }

          // Boost newer videos
          const ageInDays = (Date.now() - video.createdAt.getTime()) / (1000 * 60 * 60 * 24);
          if (ageInDays < 7) score += 15;
          else if (ageInDays < 30) score += 10;
          else if (ageInDays < 90) score += 5;

          return { video, score };
        });

        // Sort by score and return top results
        scoredRecommendations.sort((a, b) => b.score - a.score);
        return scoredRecommendations.slice(0, limit).map((r) => r.video as VideoWithAuthor);
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to get recommendations",
          operation: "getRecommendations",
          cause: error,
        }),
    });

  const getContinueWatching = (
    userId: string,
    organizationId: string,
    limit = 10,
  ): Effect.Effect<ContinueWatchingItem[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const inProgressVideos = await db
          .select({
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
            deletedAt: videos.deletedAt,
            retentionUntil: videos.retentionUntil,
            createdAt: videos.createdAt,
            updatedAt: videos.updatedAt,
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
            currentTime: videoProgresses.currentTime,
            completed: videoProgresses.completed,
            lastWatchedAt: videoProgresses.lastWatchedAt,
          })
          .from(videoProgresses)
          .innerJoin(videos, eq(videoProgresses.videoId, videos.id))
          .innerJoin(users, eq(videos.authorId, users.id))
          .where(
            and(
              eq(videoProgresses.userId, userId),
              eq(videos.organizationId, organizationId),
              eq(videoProgresses.completed, false),
              isNull(videos.deletedAt),
            ),
          )
          .orderBy(desc(videoProgresses.lastWatchedAt))
          .limit(limit);

        return inProgressVideos.map((item) => {
          const totalSeconds = parseDuration(item.duration);
          const currentSeconds = parseDuration(item.currentTime);
          const progress = totalSeconds > 0 ? currentSeconds / totalSeconds : 0;
          const remainingSeconds = Math.max(0, totalSeconds - currentSeconds);

          return {
            video: {
              id: item.id,
              title: item.title,
              description: item.description,
              duration: item.duration,
              thumbnailUrl: item.thumbnailUrl,
              videoUrl: item.videoUrl,
              authorId: item.authorId,
              organizationId: item.organizationId,
              channelId: item.channelId,
              collectionId: item.collectionId,
              transcript: item.transcript,
              transcriptSegments: item.transcriptSegments,
              processingStatus: item.processingStatus,
              processingError: item.processingError,
              aiSummary: item.aiSummary,
              aiTags: item.aiTags,
              aiActionItems: item.aiActionItems,
              deletedAt: item.deletedAt,
              retentionUntil: item.retentionUntil,
              createdAt: item.createdAt,
              updatedAt: item.updatedAt,
              author: item.author,
            } as VideoWithAuthor,
            progress,
            lastWatchedAt: item.lastWatchedAt,
            remainingTime: formatDuration(remainingSeconds),
          };
        });
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to get continue watching",
          operation: "getContinueWatching",
          cause: error,
        }),
    });

  const getTrending = (
    organizationId: string,
    limit = 10,
    timeframe: "day" | "week" | "month" = "week",
  ): Effect.Effect<TrendingVideo[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        // Calculate timeframe date
        const now = new Date();
        const timeframeDays = timeframe === "day" ? 1 : timeframe === "week" ? 7 : 30;
        const sinceDate = new Date(now.getTime() - timeframeDays * 24 * 60 * 60 * 1000);

        // Get view counts for videos in timeframe
        const viewCounts = await db
          .select({
            videoId: videoProgresses.videoId,
            viewCount: sql<number>`count(*)::int`,
          })
          .from(videoProgresses)
          .where(and(sql`${videoProgresses.lastWatchedAt} >= ${sinceDate}`))
          .groupBy(videoProgresses.videoId)
          .orderBy(desc(sql`count(*)`))
          .limit(limit * 2);

        if (viewCounts.length === 0) {
          return [];
        }

        const videoIds = viewCounts.map((v) => v.videoId);
        const viewCountMap = new Map(viewCounts.map((v) => [v.videoId, v.viewCount]));

        // Get video details
        const trendingVideos = await db
          .select({
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
            deletedAt: videos.deletedAt,
            retentionUntil: videos.retentionUntil,
            createdAt: videos.createdAt,
            updatedAt: videos.updatedAt,
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
          .from(videos)
          .innerJoin(users, eq(videos.authorId, users.id))
          .where(
            and(eq(videos.organizationId, organizationId), inArray(videos.id, videoIds), isNull(videos.deletedAt)),
          );

        // Calculate trending score (views + recency boost)
        const results = trendingVideos.map((video) => {
          const viewCount = viewCountMap.get(video.id) || 0;
          const ageInDays = (Date.now() - video.createdAt.getTime()) / (1000 * 60 * 60 * 24);
          const recencyMultiplier = ageInDays < 1 ? 3 : ageInDays < 7 ? 2 : 1;
          const trendingScore = viewCount * recencyMultiplier;

          return {
            video: video as VideoWithAuthor,
            viewCount,
            trendingScore,
          };
        });

        // Sort by trending score
        results.sort((a, b) => b.trendingScore - a.trendingScore);
        return results.slice(0, limit);
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to get trending videos",
          operation: "getTrending",
          cause: error,
        }),
    });

  const getSimilarVideos = (videoId: string, limit = 6): Effect.Effect<VideoWithAuthor[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        // Get the source video's tags and details
        const sourceVideo = await db
          .select({
            organizationId: videos.organizationId,
            channelId: videos.channelId,
            aiTags: videos.aiTags,
          })
          .from(videos)
          .where(eq(videos.id, videoId))
          .limit(1);

        if (sourceVideo.length === 0) {
          return [];
        }

        const { organizationId, channelId, aiTags } = sourceVideo[0];

        // Find similar videos based on tags
        const conditions = [
          eq(videos.organizationId, organizationId),
          isNull(videos.deletedAt),
          ne(videos.id, videoId),
          eq(videos.processingStatus, "completed"),
        ];

        const similarVideos = await db
          .select({
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
            deletedAt: videos.deletedAt,
            retentionUntil: videos.retentionUntil,
            createdAt: videos.createdAt,
            updatedAt: videos.updatedAt,
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
          .from(videos)
          .innerJoin(users, eq(videos.authorId, users.id))
          .where(and(...conditions))
          .limit(limit * 3);

        // Score by tag similarity
        const sourceTags = new Set(aiTags || []);
        const scored = similarVideos.map((video) => {
          let score = 0;

          // Tag overlap
          if (video.aiTags) {
            for (const tag of video.aiTags) {
              if (sourceTags.has(tag)) {
                score += 10;
              }
            }
          }

          // Same channel bonus
          if (video.channelId === channelId) {
            score += 15;
          }

          return { video, score };
        });

        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, limit).map((s) => s.video as VideoWithAuthor);
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to get similar videos",
          operation: "getSimilarVideos",
          cause: error,
        }),
    });

  const getRecentlyWatched = (
    userId: string,
    organizationId: string,
    limit = 10,
  ): Effect.Effect<VideoWithAuthor[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const recentVideos = await db
          .select({
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
            deletedAt: videos.deletedAt,
            retentionUntil: videos.retentionUntil,
            createdAt: videos.createdAt,
            updatedAt: videos.updatedAt,
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
          .from(videoProgresses)
          .innerJoin(videos, eq(videoProgresses.videoId, videos.id))
          .innerJoin(users, eq(videos.authorId, users.id))
          .where(
            and(
              eq(videoProgresses.userId, userId),
              eq(videos.organizationId, organizationId),
              isNull(videos.deletedAt),
            ),
          )
          .orderBy(desc(videoProgresses.lastWatchedAt))
          .limit(limit);

        return recentVideos as VideoWithAuthor[];
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to get recently watched",
          operation: "getRecentlyWatched",
          cause: error,
        }),
    });

  const getFromFavoriteChannels = (
    userId: string,
    organizationId: string,
    limit = 10,
  ): Effect.Effect<VideoWithAuthor[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        // Get user's most watched channels
        const channelWatches = await db
          .select({
            channelId: videos.channelId,
            watchCount: sql<number>`count(*)::int`,
          })
          .from(videoProgresses)
          .innerJoin(videos, eq(videoProgresses.videoId, videos.id))
          .where(
            and(
              eq(videoProgresses.userId, userId),
              eq(videos.organizationId, organizationId),
              sql`${videos.channelId} IS NOT NULL`,
            ),
          )
          .groupBy(videos.channelId)
          .orderBy(desc(sql`count(*)`))
          .limit(5);

        if (channelWatches.length === 0) {
          return [];
        }

        const favoriteChannelIds = channelWatches.filter((c) => c.channelId !== null).map((c) => c.channelId as string);

        // Get unwatched videos from favorite channels
        const watchedVideoIds = await db
          .select({ videoId: videoProgresses.videoId })
          .from(videoProgresses)
          .where(eq(videoProgresses.userId, userId));

        const excludeIds = watchedVideoIds.map((w) => w.videoId);

        const conditions = [
          eq(videos.organizationId, organizationId),
          isNull(videos.deletedAt),
          inArray(videos.channelId, favoriteChannelIds),
          eq(videos.processingStatus, "completed"),
        ];

        if (excludeIds.length > 0) {
          conditions.push(notInArray(videos.id, excludeIds));
        }

        const channelVideos = await db
          .select({
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
            deletedAt: videos.deletedAt,
            retentionUntil: videos.retentionUntil,
            createdAt: videos.createdAt,
            updatedAt: videos.updatedAt,
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
          .from(videos)
          .innerJoin(users, eq(videos.authorId, users.id))
          .where(and(...conditions))
          .orderBy(desc(videos.createdAt))
          .limit(limit);

        return channelVideos as VideoWithAuthor[];
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to get videos from favorite channels",
          operation: "getFromFavoriteChannels",
          cause: error,
        }),
    });

  const recordView = (userId: string, videoId: string, progress: number): Effect.Effect<void, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        // Get video duration to calculate current time
        const video = await db
          .select({ duration: videos.duration })
          .from(videos)
          .where(eq(videos.id, videoId))
          .limit(1);

        if (video.length === 0) return;

        const totalSeconds = parseDuration(video[0].duration);
        const currentSeconds = Math.floor(totalSeconds * progress);
        const currentTime = formatDuration(currentSeconds);
        const completed = progress >= 0.9;

        await db
          .insert(videoProgresses)
          .values({
            userId,
            videoId,
            currentTime,
            completed,
            lastWatchedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [videoProgresses.userId, videoProgresses.videoId],
            set: {
              currentTime,
              completed,
              lastWatchedAt: new Date(),
            },
          });
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to record view",
          operation: "recordView",
          cause: error,
        }),
    });

  return {
    getRecommendations,
    getContinueWatching,
    getTrending,
    getSimilarVideos,
    getRecentlyWatched,
    getFromFavoriteChannels,
    recordView,
  } satisfies RecommendationsServiceInterface;
});

// =============================================================================
// Recommendations Layer
// =============================================================================

export const RecommendationsLive = Layer.effect(Recommendations, makeRecommendationsService);

// =============================================================================
// Helper Functions
// =============================================================================

export const getRecommendations = (
  userId: string,
  organizationId: string,
  options?: RecommendationOptions,
): Effect.Effect<VideoWithAuthor[], DatabaseError, Recommendations> =>
  Effect.gen(function* () {
    const service = yield* Recommendations;
    return yield* service.getRecommendations(userId, organizationId, options);
  });

export const getContinueWatching = (
  userId: string,
  organizationId: string,
  limit?: number,
): Effect.Effect<ContinueWatchingItem[], DatabaseError, Recommendations> =>
  Effect.gen(function* () {
    const service = yield* Recommendations;
    return yield* service.getContinueWatching(userId, organizationId, limit);
  });

export const getTrending = (
  organizationId: string,
  limit?: number,
  timeframe?: "day" | "week" | "month",
): Effect.Effect<TrendingVideo[], DatabaseError, Recommendations> =>
  Effect.gen(function* () {
    const service = yield* Recommendations;
    return yield* service.getTrending(organizationId, limit, timeframe);
  });

export const getSimilarVideos = (
  videoId: string,
  limit?: number,
): Effect.Effect<VideoWithAuthor[], DatabaseError, Recommendations> =>
  Effect.gen(function* () {
    const service = yield* Recommendations;
    return yield* service.getSimilarVideos(videoId, limit);
  });
