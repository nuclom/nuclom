/**
 * Video Repository Service using Effect-TS
 *
 * Provides type-safe database operations for videos.
 */

import { Effect, Context, Layer, pipe } from "effect";
import { eq, desc, asc } from "drizzle-orm";
import { Database } from "./database";
import {
  videos,
  users,
  organizations,
  channels,
  collections,
  comments,
  videoChapters,
  videoCodeSnippets,
  type ProcessingStatus,
  type TranscriptSegment,
  type ActionItem,
} from "@/lib/db/schema";
import type { VideoWithAuthor, VideoWithDetails, PaginatedResponse } from "@/lib/types";
import { DatabaseError, NotFoundError, type DbError } from "../errors";

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
}

export interface VideoRepositoryService {
  /**
   * Get paginated videos for an organization
   */
  readonly getVideos: (
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
   * Delete a video
   */
  readonly deleteVideo: (id: string) => Effect.Effect<void, DatabaseError | NotFoundError>;

  /**
   * Get video chapters
   */
  readonly getVideoChapters: (
    videoId: string,
  ) => Effect.Effect<typeof videoChapters.$inferSelect[], DatabaseError>;

  /**
   * Get video code snippets
   */
  readonly getVideoCodeSnippets: (
    videoId: string,
  ) => Effect.Effect<typeof videoCodeSnippets.$inferSelect[], DatabaseError>;
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

  const getVideos = (
    organizationId: string,
    page = 1,
    limit = 20,
  ): Effect.Effect<PaginatedResponse<VideoWithAuthor>, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const offset = (page - 1) * limit;

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
          .where(eq(videos.organizationId, organizationId))
          .orderBy(desc(videos.createdAt))
          .offset(offset)
          .limit(limit);

        const totalCount = await db.select().from(videos).where(eq(videos.organizationId, organizationId));

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
      if (videoData[0].channelId) {
        const channelData = yield* Effect.tryPromise({
          try: () => db.select().from(channels).where(eq(channels.id, videoData[0].channelId!)).limit(1),
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
      if (videoData[0].collectionId) {
        const collectionData = yield* Effect.tryPromise({
          try: () => db.select().from(collections).where(eq(collections.id, videoData[0].collectionId!)).limit(1),
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

  const deleteVideo = (id: string): Effect.Effect<void, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
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

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: "Video not found",
            entity: "Video",
            id,
          }),
        );
      }
    });

  const getVideoChapters = (
    videoId: string,
  ): Effect.Effect<typeof videoChapters.$inferSelect[], DatabaseError> =>
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
  ): Effect.Effect<typeof videoCodeSnippets.$inferSelect[], DatabaseError> =>
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
    getVideo,
    createVideo,
    updateVideo,
    deleteVideo,
    getVideoChapters,
    getVideoCodeSnippets,
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

export const deleteVideo = (id: string): Effect.Effect<void, DatabaseError | NotFoundError, VideoRepository> =>
  Effect.gen(function* () {
    const repo = yield* VideoRepository;
    return yield* repo.deleteVideo(id);
  });

// For backwards compatibility - renamed export
export const deleteVideoRecord = deleteVideo;

export const getVideoChapters = (
  videoId: string,
): Effect.Effect<typeof videoChapters.$inferSelect[], DatabaseError, VideoRepository> =>
  Effect.gen(function* () {
    const repo = yield* VideoRepository;
    return yield* repo.getVideoChapters(videoId);
  });

export const getVideoCodeSnippets = (
  videoId: string,
): Effect.Effect<typeof videoCodeSnippets.$inferSelect[], DatabaseError, VideoRepository> =>
  Effect.gen(function* () {
    const repo = yield* VideoRepository;
    return yield* repo.getVideoCodeSnippets(videoId);
  });
