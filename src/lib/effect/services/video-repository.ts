/**
 * Video Repository Service using Effect-TS
 *
 * Provides type-safe database operations for videos.
 */

import { desc, eq } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import { channels, collections, comments, organizations, users, videos } from "@/lib/db/schema";
import type { PaginatedResponse, VideoWithAuthor, VideoWithDetails } from "@/lib/types";
import { DatabaseError, NotFoundError } from "../errors";
import { Database } from "./database";

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
  readonly aiSummary?: string;
}

export interface UpdateVideoInput {
  readonly title?: string;
  readonly description?: string | null;
  readonly thumbnailUrl?: string | null;
  readonly videoUrl?: string | null;
  readonly channelId?: string | null;
  readonly collectionId?: string | null;
  readonly transcript?: string | null;
  readonly aiSummary?: string | null;
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
            aiSummary: videos.aiSummary,
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
              aiSummary: videos.aiSummary,
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

  return {
    getVideos,
    getVideo,
    createVideo,
    updateVideo,
    deleteVideo,
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
