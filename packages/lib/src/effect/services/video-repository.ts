/**
 * Video Repository Service using Effect-TS
 *
 * Provides type-safe database operations for videos.
 */

import { and, asc, desc, eq, gte, ilike, isNotNull, isNull, lt, lte, ne, or, sql } from 'drizzle-orm';
import { Context, Effect, Layer } from 'effect';
import {
  type ActionItem,
  members,
  organizations,
  type ProcessingStatus,
  type TranscriptSegment,
  teamMembers,
  users,
  type VideoVisibility,
  videoChapters,
  videoShares,
  videos,
} from '../../db/schema';
import type { PaginatedResponse, VideoWithAuthor, VideoWithDetails } from '../../types';
import { DatabaseError, type DeleteError, NotFoundError } from '../errors';
import { Database } from './database';
import { Storage } from './storage';

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
  readonly visibility?: VideoVisibility;
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
  readonly visibility?: VideoVisibility;
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
   * Search videos with full-text search and filters
   */
  readonly searchVideos: (input: VideoSearchInput) => Effect.Effect<PaginatedResponse<VideoWithAuthor>, DatabaseError>;

  /**
   * Get paginated videos by author (user's own videos)
   */
  readonly getVideosByAuthor: (
    authorId: string,
    organizationId: string,
    page?: number,
    limit?: number,
  ) => Effect.Effect<PaginatedResponse<VideoWithAuthor>, DatabaseError>;

  /**
   * Get paginated videos shared by others in the organization (not authored by the current user)
   */
  readonly getVideosSharedByOthers: (
    userId: string,
    organizationId: string,
    page?: number,
    limit?: number,
  ) => Effect.Effect<PaginatedResponse<VideoWithAuthor>, DatabaseError>;

  /**
   * Check if a user can access a specific video based on visibility and sharing rules.
   * Returns the access level if allowed, or null if not allowed.
   *
   * Access rules:
   * - 'public' videos: Anyone can view
   * - 'organization' videos: Any organization member can view
   * - 'private' videos: Only author or explicitly shared users/team members
   */
  readonly canAccessVideo: (
    videoId: string,
    userId: string | null,
  ) => Effect.Effect<{ canAccess: boolean; accessLevel: 'view' | 'comment' | 'download' | null }, DatabaseError>;

  /**
   * Get accessible videos for a user considering visibility rules.
   * Includes:
   * - Videos authored by the user (any visibility)
   * - Organization videos (if user is a member)
   * - Private videos explicitly shared with the user or their teams
   * - Public videos (optional, controlled by includePublic parameter)
   */
  readonly getAccessibleVideos: (
    userId: string,
    organizationId: string,
    options?: {
      includeOwn?: boolean;
      includeOrganization?: boolean;
      includeSharedWithMe?: boolean;
      includePublic?: boolean;
      page?: number;
      limit?: number;
    },
  ) => Effect.Effect<PaginatedResponse<VideoWithAuthor>, DatabaseError>;
}

// =============================================================================
// Video Repository Tag
// =============================================================================

export class VideoRepository extends Context.Tag('VideoRepository')<VideoRepository, VideoRepositoryService>() {}

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
            transcript: videos.transcript,
            transcriptSegments: videos.transcriptSegments,
            processingStatus: videos.processingStatus,
            processingError: videos.processingError,
            aiSummary: videos.aiSummary,
            aiTags: videos.aiTags,
            aiActionItems: videos.aiActionItems,
            visibility: videos.visibility,
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
              twoFactorEnabled: users.twoFactorEnabled,
              lastLoginMethod: users.lastLoginMethod,
              stripeCustomerId: users.stripeCustomerId,
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
          message: 'Failed to fetch videos',
          operation: 'getVideos',
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
            transcript: videos.transcript,
            transcriptSegments: videos.transcriptSegments,
            processingStatus: videos.processingStatus,
            processingError: videos.processingError,
            aiSummary: videos.aiSummary,
            aiTags: videos.aiTags,
            aiActionItems: videos.aiActionItems,
            visibility: videos.visibility,
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
              twoFactorEnabled: users.twoFactorEnabled,
              lastLoginMethod: users.lastLoginMethod,
              stripeCustomerId: users.stripeCustomerId,
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
          message: 'Failed to fetch deleted videos',
          operation: 'getDeletedVideos',
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
              transcript: videos.transcript,
              transcriptSegments: videos.transcriptSegments,
              processingStatus: videos.processingStatus,
              processingError: videos.processingError,
              aiSummary: videos.aiSummary,
              aiTags: videos.aiTags,
              aiActionItems: videos.aiActionItems,
              visibility: videos.visibility,
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
                twoFactorEnabled: users.twoFactorEnabled,
                lastLoginMethod: users.lastLoginMethod,
                stripeCustomerId: users.stripeCustomerId,
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
            message: 'Failed to fetch video',
            operation: 'getVideo',
            cause: error,
          }),
      });

      if (!videoData.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Video not found',
            entity: 'Video',
            id,
          }),
        );
      }

      return {
        ...videoData[0],
        comments: [],
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
          message: 'Failed to create video',
          operation: 'createVideo',
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
            message: 'Failed to update video',
            operation: 'updateVideo',
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Video not found',
            entity: 'Video',
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
            message: 'Failed to soft delete video',
            operation: 'softDeleteVideo',
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Video not found',
            entity: 'Video',
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
            message: 'Failed to restore video',
            operation: 'restoreVideo',
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Video not found',
            entity: 'Video',
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
            message: 'Failed to fetch video for deletion',
            operation: 'deleteVideo.fetch',
            cause: error,
          }),
      });

      if (!videoData.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Video not found',
            entity: 'Video',
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
            message: 'Failed to delete video',
            operation: 'deleteVideo',
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
            message: 'Failed to fetch expired videos',
            operation: 'cleanupExpiredVideos.fetch',
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
              operation: 'cleanupExpiredVideos.delete',
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
            transcript: videos.transcript,
            transcriptSegments: videos.transcriptSegments,
            processingStatus: videos.processingStatus,
            processingError: videos.processingError,
            aiSummary: videos.aiSummary,
            aiTags: videos.aiTags,
            aiActionItems: videos.aiActionItems,
            visibility: videos.visibility,
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
              twoFactorEnabled: users.twoFactorEnabled,
              lastLoginMethod: users.lastLoginMethod,
              stripeCustomerId: users.stripeCustomerId,
            },
          })
          .from(videos)
          .innerJoin(users, eq(videos.authorId, users.id))
          .where(whereClause)
          .orderBy(desc(videos.createdAt))
          .offset(offset)
          .limit(limit);

        // Get total count for pagination
        const totalCountResult = await db.select({ count: sql`count(*)::int` }).from(videos).where(whereClause);

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
          message: 'Failed to search videos',
          operation: 'searchVideos',
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
          message: 'Failed to fetch video chapters',
          operation: 'getVideoChapters',
          cause: error,
        }),
    });

  const getVideosByAuthor = (
    authorId: string,
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
            transcript: videos.transcript,
            transcriptSegments: videos.transcriptSegments,
            processingStatus: videos.processingStatus,
            processingError: videos.processingError,
            aiSummary: videos.aiSummary,
            aiTags: videos.aiTags,
            aiActionItems: videos.aiActionItems,
            visibility: videos.visibility,
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
              twoFactorEnabled: users.twoFactorEnabled,
              lastLoginMethod: users.lastLoginMethod,
              stripeCustomerId: users.stripeCustomerId,
            },
          })
          .from(videos)
          .innerJoin(users, eq(videos.authorId, users.id))
          .where(
            and(eq(videos.authorId, authorId), eq(videos.organizationId, organizationId), isNull(videos.deletedAt)),
          )
          .orderBy(desc(videos.createdAt))
          .offset(offset)
          .limit(limit);

        const totalCount = await db
          .select()
          .from(videos)
          .where(
            and(eq(videos.authorId, authorId), eq(videos.organizationId, organizationId), isNull(videos.deletedAt)),
          );

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
          message: 'Failed to fetch user videos',
          operation: 'getVideosByAuthor',
          cause: error,
        }),
    });

  const getVideosSharedByOthers = (
    userId: string,
    organizationId: string,
    page = 1,
    limit = 20,
  ): Effect.Effect<PaginatedResponse<VideoWithAuthor>, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const offset = (page - 1) * limit;

        // Get videos from the organization that are NOT authored by the current user
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
            transcript: videos.transcript,
            transcriptSegments: videos.transcriptSegments,
            processingStatus: videos.processingStatus,
            processingError: videos.processingError,
            aiSummary: videos.aiSummary,
            aiTags: videos.aiTags,
            aiActionItems: videos.aiActionItems,
            visibility: videos.visibility,
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
              twoFactorEnabled: users.twoFactorEnabled,
              lastLoginMethod: users.lastLoginMethod,
              stripeCustomerId: users.stripeCustomerId,
            },
          })
          .from(videos)
          .innerJoin(users, eq(videos.authorId, users.id))
          .where(and(ne(videos.authorId, userId), eq(videos.organizationId, organizationId), isNull(videos.deletedAt)))
          .orderBy(desc(videos.createdAt))
          .offset(offset)
          .limit(limit);

        const totalCount = await db
          .select()
          .from(videos)
          .where(and(ne(videos.authorId, userId), eq(videos.organizationId, organizationId), isNull(videos.deletedAt)));

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
          message: 'Failed to fetch shared videos',
          operation: 'getVideosSharedByOthers',
          cause: error,
        }),
    });

  const canAccessVideo = (
    videoId: string,
    userId: string | null,
  ): Effect.Effect<{ canAccess: boolean; accessLevel: 'view' | 'comment' | 'download' | null }, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        // First, get the video to check its visibility and author
        const video = await db
          .select({
            id: videos.id,
            authorId: videos.authorId,
            organizationId: videos.organizationId,
            visibility: videos.visibility,
            deletedAt: videos.deletedAt,
          })
          .from(videos)
          .where(eq(videos.id, videoId))
          .limit(1);

        if (!video.length || video[0].deletedAt) {
          return { canAccess: false, accessLevel: null };
        }

        const v = video[0];

        // Public videos: anyone can view
        if (v.visibility === 'public') {
          return { canAccess: true, accessLevel: 'view' };
        }

        // For non-public videos, user must be authenticated
        if (!userId) {
          return { canAccess: false, accessLevel: null };
        }

        // Author always has full access
        if (v.authorId === userId) {
          return { canAccess: true, accessLevel: 'download' };
        }

        // Organization videos: check if user is a member
        if (v.visibility === 'organization') {
          const membership = await db
            .select()
            .from(members)
            .where(and(eq(members.organizationId, v.organizationId), eq(members.userId, userId)))
            .limit(1);

          if (membership.length > 0) {
            return { canAccess: true, accessLevel: 'view' };
          }
        }

        // Private videos: check explicit shares
        if (v.visibility === 'private') {
          // Check direct user share
          const userShare = await db
            .select({ accessLevel: videoShares.accessLevel })
            .from(videoShares)
            .where(and(eq(videoShares.videoId, videoId), eq(videoShares.userId, userId)))
            .limit(1);

          if (userShare.length > 0) {
            return { canAccess: true, accessLevel: userShare[0].accessLevel };
          }

          // Check team shares - user must be a member of a team that has access
          const teamShare = await db
            .select({ accessLevel: videoShares.accessLevel })
            .from(videoShares)
            .innerJoin(teamMembers, eq(videoShares.teamId, teamMembers.teamId))
            .where(and(eq(videoShares.videoId, videoId), eq(teamMembers.userId, userId)))
            .limit(1);

          if (teamShare.length > 0) {
            return { canAccess: true, accessLevel: teamShare[0].accessLevel };
          }
        }

        return { canAccess: false, accessLevel: null };
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to check video access',
          operation: 'canAccessVideo',
          cause: error,
        }),
    });

  const getAccessibleVideos = (
    userId: string,
    organizationId: string,
    options: {
      includeOwn?: boolean;
      includeOrganization?: boolean;
      includeSharedWithMe?: boolean;
      includePublic?: boolean;
      page?: number;
      limit?: number;
    } = {},
  ): Effect.Effect<PaginatedResponse<VideoWithAuthor>, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const {
          includeOwn = true,
          includeOrganization = true,
          includeSharedWithMe = true,
          includePublic = false,
          page = 1,
          limit: itemsLimit = 20,
        } = options;
        const offset = (page - 1) * itemsLimit;

        // Build conditions for accessible videos
        const accessConditions: ReturnType<typeof eq>[] = [];

        // User's own videos (any visibility)
        if (includeOwn) {
          accessConditions.push(eq(videos.authorId, userId));
        }

        // Organization-visible videos (not authored by user)
        if (includeOrganization) {
          accessConditions.push(
            and(
              eq(videos.organizationId, organizationId),
              eq(videos.visibility, 'organization'),
              ne(videos.authorId, userId),
            ) as ReturnType<typeof eq>,
          );
        }

        // Public videos from this organization (not authored by user)
        if (includePublic) {
          accessConditions.push(
            and(
              eq(videos.organizationId, organizationId),
              eq(videos.visibility, 'public'),
              ne(videos.authorId, userId),
            ) as ReturnType<typeof eq>,
          );
        }

        // Get IDs of private videos shared with user directly
        let sharedVideoIds: string[] = [];
        if (includeSharedWithMe) {
          // Direct user shares
          const userShares = await db
            .select({ videoId: videoShares.videoId })
            .from(videoShares)
            .innerJoin(videos, eq(videoShares.videoId, videos.id))
            .where(
              and(
                eq(videoShares.userId, userId),
                eq(videos.visibility, 'private'),
                eq(videos.organizationId, organizationId),
                isNull(videos.deletedAt),
              ),
            );

          // Team shares
          const teamShares = await db
            .select({ videoId: videoShares.videoId })
            .from(videoShares)
            .innerJoin(teamMembers, eq(videoShares.teamId, teamMembers.teamId))
            .innerJoin(videos, eq(videoShares.videoId, videos.id))
            .where(
              and(
                eq(teamMembers.userId, userId),
                eq(videos.visibility, 'private'),
                eq(videos.organizationId, organizationId),
                isNull(videos.deletedAt),
              ),
            );

          sharedVideoIds = [...new Set([...userShares.map((s) => s.videoId), ...teamShares.map((s) => s.videoId)])];
        }

        // Build the final where clause
        const whereClause =
          accessConditions.length > 0 || sharedVideoIds.length > 0
            ? and(
                isNull(videos.deletedAt),
                or(
                  ...accessConditions,
                  ...(sharedVideoIds.length > 0
                    ? [sql`${videos.id} IN (${sql.raw(sharedVideoIds.map((id) => `'${id}'`).join(', '))})`]
                    : []),
                ),
              )
            : and(isNull(videos.deletedAt), eq(videos.authorId, userId)); // Fallback to just own videos

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
            visibility: videos.visibility,
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
              twoFactorEnabled: users.twoFactorEnabled,
              lastLoginMethod: users.lastLoginMethod,
              stripeCustomerId: users.stripeCustomerId,
            },
          })
          .from(videos)
          .innerJoin(users, eq(videos.authorId, users.id))
          .where(whereClause)
          .orderBy(desc(videos.createdAt))
          .offset(offset)
          .limit(itemsLimit);

        // Get total count
        const totalCountResult = await db.select({ count: sql`count(*)::int` }).from(videos).where(whereClause);
        const total = totalCountResult[0]?.count ?? 0;

        return {
          data: videosData as VideoWithAuthor[],
          pagination: {
            page,
            limit: itemsLimit,
            total: Number(total),
            totalPages: Math.ceil(Number(total) / itemsLimit),
          },
        };
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch accessible videos',
          operation: 'getAccessibleVideos',
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
    searchVideos,
    getVideosByAuthor,
    getVideosSharedByOthers,
    canAccessVideo,
    getAccessibleVideos,
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

export const searchVideos = (
  input: VideoSearchInput,
): Effect.Effect<PaginatedResponse<VideoWithAuthor>, DatabaseError, VideoRepository> =>
  Effect.gen(function* () {
    const repo = yield* VideoRepository;
    return yield* repo.searchVideos(input);
  });

export const getVideosByAuthor = (
  authorId: string,
  organizationId: string,
  page?: number,
  limit?: number,
): Effect.Effect<PaginatedResponse<VideoWithAuthor>, DatabaseError, VideoRepository> =>
  Effect.gen(function* () {
    const repo = yield* VideoRepository;
    return yield* repo.getVideosByAuthor(authorId, organizationId, page, limit);
  });

export const getVideosSharedByOthers = (
  userId: string,
  organizationId: string,
  page?: number,
  limit?: number,
): Effect.Effect<PaginatedResponse<VideoWithAuthor>, DatabaseError, VideoRepository> =>
  Effect.gen(function* () {
    const repo = yield* VideoRepository;
    return yield* repo.getVideosSharedByOthers(userId, organizationId, page, limit);
  });

export const canAccessVideo = (
  videoId: string,
  userId: string | null,
): Effect.Effect<
  { canAccess: boolean; accessLevel: 'view' | 'comment' | 'download' | null },
  DatabaseError,
  VideoRepository
> =>
  Effect.gen(function* () {
    const repo = yield* VideoRepository;
    return yield* repo.canAccessVideo(videoId, userId);
  });

export const getAccessibleVideos = (
  userId: string,
  organizationId: string,
  options?: {
    includeOwn?: boolean;
    includeOrganization?: boolean;
    includeSharedWithMe?: boolean;
    includePublic?: boolean;
    page?: number;
    limit?: number;
  },
): Effect.Effect<PaginatedResponse<VideoWithAuthor>, DatabaseError, VideoRepository> =>
  Effect.gen(function* () {
    const repo = yield* VideoRepository;
    return yield* repo.getAccessibleVideos(userId, organizationId, options);
  });
