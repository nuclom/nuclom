/**
 * Video Repository Service using Effect-TS
 *
 * Provides type-safe database operations for videos.
 */

import { and, asc, desc, eq, gte, ilike, isNotNull, isNull, lt, lte, or, sql } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import {
  type ActionItem,
  channels,
  collections,
  comments,
  organizations,
  type ProcessingStatus,
  type TranscriptSegment,
  users,
  videoChapters,
  videoCodeSnippets,
  videos,
} from "@/lib/db/schema";
import type { PaginatedResponse, VideoWithAuthor, VideoWithDetails } from "@/lib/types";
import { DatabaseError, DeleteError, NotFoundError } from "../errors";
import { Database } from "./database";
import { Storage } from "./storage";

// =============================================================================
// Types
// =============================================================================

export interface CreateVideoInput {
  readonly title: string;
  readonly description?: string;
  readonly duration: string;
  readonly thumbnailUrl?: string;
  readonly videoUrl?: string;
  readonly authorId: string;
  readonly organizationId: string;
  readonly channelId?: string;
  readonly collectionId?: string;
  readonly transcript?: string;
  readonly transcriptSegments?: TranscriptSegment[];
  readonly processingStatus?: ProcessingStatus;
  readonly aiSummary?: string;
  readonly aiTags?: string[];
  readonly aiActionItems?: ActionItem[];
}

export interface UpdateVideoInput {
  readonly title?: string;
  readonly description?: string | null;
  readonly duration?: string;
  readonly thumbnailUrl?: string | null;
  readonly videoUrl?: string | null;
  readonly channelId?: string | null;
  readonly collectionId?: string | null;
  readonly transcript?: string | null;
  readonly transcriptSegments?: TranscriptSegment[] | null;
  readonly processingStatus?: ProcessingStatus;
  readonly processingError?: string | null;
  readonly aiSummary?: string | null;
  readonly aiTags?: string[] | null;
  readonly aiActionItems?: ActionItem[] | null;
  readonly deletedAt?: Date | null;
  readonly retentionUntil?: Date | null;
}

export interface SoftDeleteOptions {
  /** Number of days to retain the video before permanent deletion. Default is 30 days. */
  readonly retentionDays?: number;
}

export interface VideoSearchInput {
  readonly query: string;
  readonly organizationId: string;
  readonly channelId?: string;
  readonly authorId?: string;
  readonly dateFrom?: Date;
  readonly dateTo?: Date;
  readonly page?: number;
  readonly limit?: number;
}

export interface VideoRepositoryService {
  /**
   * Get paginated videos for an organization (excludes soft-deleted videos)
   */
  readonly getVideos: (
    organizationId: string,
    page?: number,
    limit?: number,
  ) => Effect.Effect<PaginatedResponse<VideoWithAuthor>, DatabaseError>;

  /**
   * Get paginated deleted videos for an organization (only soft-deleted videos)
   */
  readonly getDeletedVideos: (
    organizationId: string,
    page?: number,
    limit?: number,
  ) => Effect.Effect<PaginatedResponse<VideoWithAuthor>, DatabaseError>;

  /**
   * Get a single video with full details
   */
  readonly getVideo: (id: string) => Effect.Effect<VideoWithDetails, DatabaseError | NotFoundError>;

  /**
   * Create a new video
   */
  readonly createVideo: (data: CreateVideoInput) => Effect.Effect<typeof videos.$inferSelect, DatabaseError>;

  /**
   * Update a video
   */
  readonly updateVideo: (
    id: string,
    data: UpdateVideoInput,
  ) => Effect.Effect<typeof videos.$inferSelect, DatabaseError | NotFoundError>;

  /**
   * Soft delete a video (marks as deleted with retention period)
   */
  readonly softDeleteVideo: (
    id: string,
    options?: SoftDeleteOptions,
  ) => Effect.Effect<typeof videos.$inferSelect, DatabaseError | NotFoundError>;

  /**
   * Restore a soft-deleted video
   */
  readonly restoreVideo: (id: string) => Effect.Effect<typeof videos.$inferSelect, DatabaseError | NotFoundError>;

  /**
   * Permanently delete a video and clean up R2 storage
   */
  readonly deleteVideo: (id: string) => Effect.Effect<void, DatabaseError | NotFoundError | DeleteError>;

  /**
   * Permanently delete all videos past their retention period
   */
  readonly cleanupExpiredVideos: () => Effect.Effect<number, DatabaseError | DeleteError>;

  /**
   * Get video chapters
   */
  readonly getVideoChapters: (videoId: string) => Effect.Effect<(typeof videoChapters.$inferSelect)[], DatabaseError>;

  /**
   * Get video code snippets
   */
  readonly getVideoCodeSnippets: (
    videoId: string,
  ) => Effect.Effect<(typeof videoCodeSnippets.$inferSelect)[], DatabaseError>;

  /**
   * Search videos with full-text search and filters
   */
  readonly searchVideos: (input: VideoSearchInput) => Effect.Effect<PaginatedResponse<VideoWithAuthor>, DatabaseError>;
}

// =============================================================================
// Video Repository Tag
// =============================================================================

export class VideoRepository extends Context.Tag("VideoRepository")<VideoRepository, VideoRepositoryService>() {}

// =============================================================================
// Video Repository Implementation
// =============================================================================

const makeVideoRepositoryService = Effect.gen(function* () {
  const { db } = yield* Database;
  const storage = yield* Storage;

  // Helper function to extract file key from URL
  const extractFileKeyFromUrl = (url: string | null): string | null => {
    if (!url) return null;
    try {
      const urlObj = new URL(url);
      // Remove leading slash from pathname
      return urlObj.pathname.slice(1);
    } catch {
      return null;
    }
  };

  // Helper to delete R2 files for a video
  const deleteVideoFiles = (video: { videoUrl: string | null; thumbnailUrl: string | null }) =>
    Effect.gen(function* () {
      const videoKey = extractFileKeyFromUrl(video.videoUrl);
      const thumbnailKey = extractFileKeyFromUrl(video.thumbnailUrl);

      if (videoKey) {
        yield* storage.deleteFile(videoKey).pipe(
          Effect.catchAll((error) => {
            console.error(`Failed to delete video file ${videoKey}:`, error);
            return Effect.void;
          }),
        );
      }

      if (thumbnailKey) {
        yield* storage.deleteFile(thumbnailKey).pipe(
          Effect.catchAll((error) => {
            console.error(`Failed to delete thumbnail file ${thumbnailKey}:`, error);
            return Effect.void;
          }),
        );
      }
    });

  const getVideos = (
    organizationId: string,
    page = 1,
    limit = 20,
  ): Effect.Effect<PaginatedResponse<VideoWithAuthor>, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const offset = (page - 1) * limit;

        // Exclude soft-deleted videos
        const videosData = await db
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
          .where(and(eq(videos.organizationId, organizationId), isNull(videos.deletedAt)))
          .orderBy(desc(videos.createdAt))
          .offset(offset)
          .limit(limit);

        const totalCount = await db
          .select()
          .from(videos)
          .where(and(eq(videos.organizationId, organizationId), isNull(videos.deletedAt)));

        return {
          data: videosData as VideoWithAuthor[],
          pagination: {
            page,
            limit,
            total: totalCount.length,
            totalPages: Math.ceil(totalCount.length / limit),
          },
        };
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch videos",
          operation: "getVideos",
          cause: error,
        }),
    });

  const getDeletedVideos = (
    organizationId: string,
    page = 1,
    limit = 20,
  ): Effect.Effect<PaginatedResponse<VideoWithAuthor>, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const offset = (page - 1) * limit;

        // Only get soft-deleted videos
        const videosData = await db
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
          .where(and(eq(videos.organizationId, organizationId), isNotNull(videos.deletedAt)))
          .orderBy(desc(videos.deletedAt))
          .offset(offset)
          .limit(limit);

        const totalCount = await db
          .select()
          .from(videos)
          .where(and(eq(videos.organizationId, organizationId), isNotNull(videos.deletedAt)));

        return {
          data: videosData as VideoWithAuthor[],
          pagination: {
            page,
            limit,
            total: totalCount.length,
            totalPages: Math.ceil(totalCount.length / limit),
          },
        };
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch deleted videos",
          operation: "getDeletedVideos",
          cause: error,
        }),
    });

  const getVideo = (id: string): Effect.Effect<VideoWithDetails, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const videoData = yield* Effect.tryPromise({
        try: async () => {
          return await db
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
              organization: {
                id: organizations.id,
                name: organizations.name,
                slug: organizations.slug,
                logo: organizations.logo,
                createdAt: organizations.createdAt,
                metadata: organizations.metadata,
              },
            })
            .from(videos)
            .innerJoin(users, eq(videos.authorId, users.id))
            .innerJoin(organizations, eq(videos.organizationId, organizations.id))
            .where(eq(videos.id, id))
            .limit(1);
        },
        catch: (error) =>
          new DatabaseError({
            message: "Failed to fetch video",
            operation: "getVideo",
            cause: error,
          }),
      });

      if (!videoData.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: "Video not found",
            entity: "Video",
            id,
          }),
        );
      }

      // Get channel if exists
      let channel = null;
      const videoChannelId = videoData[0].channelId;
      if (videoChannelId) {
        const channelData = yield* Effect.tryPromise({
          try: () => db.select().from(channels).where(eq(channels.id, videoChannelId)).limit(1),
          catch: (error) =>
            new DatabaseError({
              message: "Failed to fetch channel",
              operation: "getVideo.channel",
              cause: error,
            }),
        });
        channel = channelData[0] || null;
      }

      // Get collection if exists
      let collection = null;
      const videoCollectionId = videoData[0].collectionId;
      if (videoCollectionId) {
        const collectionData = yield* Effect.tryPromise({
          try: () => db.select().from(collections).where(eq(collections.id, videoCollectionId)).limit(1),
          catch: (error) =>
            new DatabaseError({
              message: "Failed to fetch collection",
              operation: "getVideo.collection",
              cause: error,
            }),
        });
        collection = collectionData[0] || null;
      }

      // Get comments
      const commentsData = yield* Effect.tryPromise({
        try: () =>
          db
            .select({
              id: comments.id,
              content: comments.content,
              timestamp: comments.timestamp,
              authorId: comments.authorId,
              videoId: comments.videoId,
              parentId: comments.parentId,
              createdAt: comments.createdAt,
              updatedAt: comments.updatedAt,
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
            .from(comments)
            .innerJoin(users, eq(comments.authorId, users.id))
            .where(eq(comments.videoId, id))
            .orderBy(desc(comments.createdAt)),
        catch: (error) =>
          new DatabaseError({
            message: "Failed to fetch comments",
            operation: "getVideo.comments",
            cause: error,
          }),
      });

      return {
        ...videoData[0],
        channel,
        collection,
        comments: commentsData,
      } as VideoWithDetails;
    });

  const createVideo = (data: CreateVideoInput): Effect.Effect<typeof videos.$inferSelect, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const [newVideo] = await db.insert(videos).values(data).returning();
        return newVideo;
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to create video",
          operation: "createVideo",
          cause: error,
        }),
    });

  const updateVideo = (
    id: string,
    data: UpdateVideoInput,
  ): Effect.Effect<typeof videos.$inferSelect, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          return await db
            .update(videos)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(videos.id, id))
            .returning();
        },
        catch: (error) =>
          new DatabaseError({
            message: "Failed to update video",
            operation: "updateVideo",
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: "Video not found",
            entity: "Video",
            id,
          }),
        );
      }

      return result[0];
    });

  const softDeleteVideo = (
    id: string,
    options: SoftDeleteOptions = {},
  ): Effect.Effect<typeof videos.$inferSelect, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const retentionDays = options.retentionDays ?? 30;
      const deletedAt = new Date();
      const retentionUntil = new Date(deletedAt.getTime() + retentionDays * 24 * 60 * 60 * 1000);

      const result = yield* Effect.tryPromise({
        try: async () => {
          return await db
            .update(videos)
            .set({ deletedAt, retentionUntil, updatedAt: new Date() })
            .where(eq(videos.id, id))
            .returning();
        },
        catch: (error) =>
          new DatabaseError({
            message: "Failed to soft delete video",
            operation: "softDeleteVideo",
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: "Video not found",
            entity: "Video",
            id,
          }),
        );
      }

      return result[0];
    });

  const restoreVideo = (id: string): Effect.Effect<typeof videos.$inferSelect, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          return await db
            .update(videos)
            .set({ deletedAt: null, retentionUntil: null, updatedAt: new Date() })
            .where(eq(videos.id, id))
            .returning();
        },
        catch: (error) =>
          new DatabaseError({
            message: "Failed to restore video",
            operation: "restoreVideo",
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: "Video not found",
            entity: "Video",
            id,
          }),
        );
      }

      return result[0];
    });

  const deleteVideo = (id: string): Effect.Effect<void, DatabaseError | NotFoundError | DeleteError> =>
    Effect.gen(function* () {
      // First, get the video to retrieve file URLs for cleanup
      const videoData = yield* Effect.tryPromise({
        try: async () => {
          return await db.select().from(videos).where(eq(videos.id, id)).limit(1);
        },
        catch: (error) =>
          new DatabaseError({
            message: "Failed to fetch video for deletion",
            operation: "deleteVideo.fetch",
            cause: error,
          }),
      });

      if (!videoData.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: "Video not found",
            entity: "Video",
            id,
          }),
        );
      }

      const video = videoData[0];

      // Delete files from R2 storage
      yield* deleteVideoFiles(video);

      // Delete the database record
      yield* Effect.tryPromise({
        try: async () => {
          return await db.delete(videos).where(eq(videos.id, id)).returning();
        },
        catch: (error) =>
          new DatabaseError({
            message: "Failed to delete video",
            operation: "deleteVideo",
            cause: error,
          }),
      });
    });

  const cleanupExpiredVideos = (): Effect.Effect<number, DatabaseError | DeleteError> =>
    Effect.gen(function* () {
      const now = new Date();

      // Find all videos past their retention period
      const expiredVideos = yield* Effect.tryPromise({
        try: async () => {
          return await db
            .select()
            .from(videos)
            .where(and(isNotNull(videos.deletedAt), lt(videos.retentionUntil, now)));
        },
        catch: (error) =>
          new DatabaseError({
            message: "Failed to fetch expired videos",
            operation: "cleanupExpiredVideos.fetch",
            cause: error,
          }),
      });

      let deletedCount = 0;

      for (const video of expiredVideos) {
        // Delete files from R2 storage
        yield* deleteVideoFiles(video);

        // Delete the database record
        yield* Effect.tryPromise({
          try: async () => {
            await db.delete(videos).where(eq(videos.id, video.id));
          },
          catch: (error) =>
            new DatabaseError({
              message: `Failed to delete expired video ${video.id}`,
              operation: "cleanupExpiredVideos.delete",
              cause: error,
            }),
        });

        deletedCount++;
      }

      return deletedCount;
    });

  const searchVideos = (input: VideoSearchInput): Effect.Effect<PaginatedResponse<VideoWithAuthor>, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const page = input.page ?? 1;
        const limit = input.limit ?? 20;
        const offset = (page - 1) * limit;
        const searchPattern = `%${input.query}%`;

        // Build conditions array
        const conditions = [
          eq(videos.organizationId, input.organizationId),
          isNull(videos.deletedAt),
          or(
            ilike(videos.title, searchPattern),
            ilike(videos.description, searchPattern),
            ilike(videos.transcript, searchPattern),
            sql`${videos.aiTags}::text ILIKE ${searchPattern}`,
          ),
        ];

        if (input.channelId) {
          conditions.push(eq(videos.channelId, input.channelId));
        }

        if (input.authorId) {
          conditions.push(eq(videos.authorId, input.authorId));
        }

        if (input.dateFrom) {
          conditions.push(gte(videos.createdAt, input.dateFrom));
        }

        if (input.dateTo) {
          conditions.push(lte(videos.createdAt, input.dateTo));
        }

        const whereClause = and(...conditions);

        const videosData = await db
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
          .where(whereClause)
          .orderBy(desc(videos.createdAt))
          .offset(offset)
          .limit(limit);

        // Get total count for pagination
        const totalCountResult = await db
          .select({ count: sql`count(*)::int` })
          .from(videos)
          .where(whereClause);

        const total = totalCountResult[0]?.count ?? 0;

        return {
          data: videosData as VideoWithAuthor[],
          pagination: {
            page,
            limit,
            total: Number(total),
            totalPages: Math.ceil(Number(total) / limit),
          },
        };
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to search videos",
          operation: "searchVideos",
          cause: error,
        }),
    });

  const getVideoChapters = (videoId: string): Effect.Effect<(typeof videoChapters.$inferSelect)[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        return await db
          .select()
          .from(videoChapters)
          .where(eq(videoChapters.videoId, videoId))
          .orderBy(asc(videoChapters.startTime));
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch video chapters",
          operation: "getVideoChapters",
          cause: error,
        }),
    });

  const getVideoCodeSnippets = (
    videoId: string,
  ): Effect.Effect<(typeof videoCodeSnippets.$inferSelect)[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        return await db
          .select()
          .from(videoCodeSnippets)
          .where(eq(videoCodeSnippets.videoId, videoId))
          .orderBy(asc(videoCodeSnippets.timestamp));
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch video code snippets",
          operation: "getVideoCodeSnippets",
          cause: error,
        }),
    });

  return {
    getVideos,
    getDeletedVideos,
    getVideo,
    createVideo,
    updateVideo,
    softDeleteVideo,
    restoreVideo,
    deleteVideo,
    cleanupExpiredVideos,
    getVideoChapters,
    getVideoCodeSnippets,
    searchVideos,
  } satisfies VideoRepositoryService;
});

// =============================================================================
// Video Repository Layer
// =============================================================================

export const VideoRepositoryLive = Layer.effect(VideoRepository, makeVideoRepositoryService);

// =============================================================================
// Video Repository Helper Functions
// =============================================================================

export const getVideos = (
  organizationId: string,
  page?: number,
  limit?: number,
): Effect.Effect<PaginatedResponse<VideoWithAuthor>, DatabaseError, VideoRepository> =>
  Effect.gen(function* () {
    const repo = yield* VideoRepository;
    return yield* repo.getVideos(organizationId, page, limit);
  });

export const getDeletedVideos = (
  organizationId: string,
  page?: number,
  limit?: number,
): Effect.Effect<PaginatedResponse<VideoWithAuthor>, DatabaseError, VideoRepository> =>
  Effect.gen(function* () {
    const repo = yield* VideoRepository;
    return yield* repo.getDeletedVideos(organizationId, page, limit);
  });

export const getVideo = (id: string): Effect.Effect<VideoWithDetails, DatabaseError | NotFoundError, VideoRepository> =>
  Effect.gen(function* () {
    const repo = yield* VideoRepository;
    return yield* repo.getVideo(id);
  });

export const createVideo = (
  data: CreateVideoInput,
): Effect.Effect<typeof videos.$inferSelect, DatabaseError, VideoRepository> =>
  Effect.gen(function* () {
    const repo = yield* VideoRepository;
    return yield* repo.createVideo(data);
  });

export const updateVideo = (
  id: string,
  data: UpdateVideoInput,
): Effect.Effect<typeof videos.$inferSelect, DatabaseError | NotFoundError, VideoRepository> =>
  Effect.gen(function* () {
    const repo = yield* VideoRepository;
    return yield* repo.updateVideo(id, data);
  });

export const softDeleteVideo = (
  id: string,
  options?: SoftDeleteOptions,
): Effect.Effect<typeof videos.$inferSelect, DatabaseError | NotFoundError, VideoRepository> =>
  Effect.gen(function* () {
    const repo = yield* VideoRepository;
    return yield* repo.softDeleteVideo(id, options);
  });

export const restoreVideo = (
  id: string,
): Effect.Effect<typeof videos.$inferSelect, DatabaseError | NotFoundError, VideoRepository> =>
  Effect.gen(function* () {
    const repo = yield* VideoRepository;
    return yield* repo.restoreVideo(id);
  });

export const deleteVideo = (
  id: string,
): Effect.Effect<void, DatabaseError | NotFoundError | DeleteError, VideoRepository> =>
  Effect.gen(function* () {
    const repo = yield* VideoRepository;
    return yield* repo.deleteVideo(id);
  });

// For backwards compatibility - renamed export
export const deleteVideoRecord = deleteVideo;

export const cleanupExpiredVideos = (): Effect.Effect<number, DatabaseError | DeleteError, VideoRepository> =>
  Effect.gen(function* () {
    const repo = yield* VideoRepository;
    return yield* repo.cleanupExpiredVideos();
  });

export const getVideoChapters = (
  videoId: string,
): Effect.Effect<(typeof videoChapters.$inferSelect)[], DatabaseError, VideoRepository> =>
  Effect.gen(function* () {
    const repo = yield* VideoRepository;
    return yield* repo.getVideoChapters(videoId);
  });

export const getVideoCodeSnippets = (
  videoId: string,
): Effect.Effect<(typeof videoCodeSnippets.$inferSelect)[], DatabaseError, VideoRepository> =>
  Effect.gen(function* () {
    const repo = yield* VideoRepository;
    return yield* repo.getVideoCodeSnippets(videoId);
  });

export const searchVideos = (
  input: VideoSearchInput,
): Effect.Effect<PaginatedResponse<VideoWithAuthor>, DatabaseError, VideoRepository> =>
  Effect.gen(function* () {
    const repo = yield* VideoRepository;
    return yield* repo.searchVideos(input);
  });
