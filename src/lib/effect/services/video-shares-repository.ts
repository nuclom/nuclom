/**
 * Video Shares Repository Service using Effect-TS
 *
 * Provides type-safe database operations for video sharing.
 * Handles sharing private videos with specific users or teams.
 */

import { and, eq, isNull } from 'drizzle-orm';
import { Context, Effect, Layer } from 'effect';
import { teams, users, type VideoShare, videoShares, videos } from '@/lib/db/schema';
import { DatabaseError, NotFoundError, ValidationError } from '../errors';
import { Database } from './database';

// =============================================================================
// Types
// =============================================================================

export interface CreateUserShareInput {
  readonly videoId: string;
  readonly userId: string;
  readonly accessLevel?: 'view' | 'comment' | 'download';
  readonly sharedBy: string;
}

export interface CreateTeamShareInput {
  readonly videoId: string;
  readonly teamId: string;
  readonly accessLevel?: 'view' | 'comment' | 'download';
  readonly sharedBy: string;
}

export interface VideoShareWithDetails extends VideoShare {
  user?: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  } | null;
  team?: {
    id: string;
    name: string;
  } | null;
}

export interface VideoSharesRepositoryService {
  /**
   * Share a video with a specific user
   */
  readonly shareWithUser: (data: CreateUserShareInput) => Effect.Effect<VideoShare, DatabaseError | ValidationError>;

  /**
   * Share a video with a team
   */
  readonly shareWithTeam: (data: CreateTeamShareInput) => Effect.Effect<VideoShare, DatabaseError | ValidationError>;

  /**
   * Get all shares for a video
   */
  readonly getVideoShares: (videoId: string) => Effect.Effect<VideoShareWithDetails[], DatabaseError>;

  /**
   * Remove a share by ID
   */
  readonly removeShare: (shareId: string) => Effect.Effect<void, DatabaseError | NotFoundError>;

  /**
   * Remove all shares for a specific user from a video
   */
  readonly removeUserShare: (videoId: string, userId: string) => Effect.Effect<void, DatabaseError>;

  /**
   * Remove all shares for a specific team from a video
   */
  readonly removeTeamShare: (videoId: string, teamId: string) => Effect.Effect<void, DatabaseError>;

  /**
   * Check if a user has direct share access to a video
   */
  readonly hasUserShare: (
    videoId: string,
    userId: string,
  ) => Effect.Effect<{ hasShare: boolean; accessLevel: 'view' | 'comment' | 'download' | null }, DatabaseError>;

  /**
   * Check if a user has team-based share access to a video
   */
  readonly hasTeamShare: (
    videoId: string,
    userId: string,
  ) => Effect.Effect<{ hasShare: boolean; accessLevel: 'view' | 'comment' | 'download' | null }, DatabaseError>;

  /**
   * Get all videos shared with a user (directly or via teams)
   */
  readonly getVideosSharedWithUser: (userId: string, organizationId: string) => Effect.Effect<string[], DatabaseError>;
}

// =============================================================================
// Video Shares Repository Tag
// =============================================================================

export class VideoSharesRepository extends Context.Tag('VideoSharesRepository')<
  VideoSharesRepository,
  VideoSharesRepositoryService
>() {}

// =============================================================================
// Video Shares Repository Implementation
// =============================================================================

const makeVideoSharesRepositoryService = Effect.gen(function* () {
  const { db } = yield* Database;

  const shareWithUser = (data: CreateUserShareInput): Effect.Effect<VideoShare, DatabaseError | ValidationError> =>
    Effect.gen(function* () {
      // Validate that the video exists and is private
      const video = yield* Effect.tryPromise({
        try: async () => {
          return await db
            .select({ id: videos.id, visibility: videos.visibility, authorId: videos.authorId })
            .from(videos)
            .where(and(eq(videos.id, data.videoId), isNull(videos.deletedAt)))
            .limit(1);
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to check video',
            operation: 'shareWithUser.checkVideo',
            cause: error,
          }),
      });

      if (!video.length) {
        return yield* Effect.fail(
          new ValidationError({
            message: 'Video not found',
            field: 'videoId',
          }),
        );
      }

      // Only allow sharing for private videos
      if (video[0].visibility !== 'private') {
        return yield* Effect.fail(
          new ValidationError({
            message: 'Only private videos can be shared with specific users',
            field: 'videoId',
          }),
        );
      }

      // Only the author can share the video
      if (video[0].authorId !== data.sharedBy) {
        return yield* Effect.fail(
          new ValidationError({
            message: 'Only the video author can share the video',
            field: 'sharedBy',
          }),
        );
      }

      // Check if share already exists
      const existing = yield* Effect.tryPromise({
        try: async () => {
          return await db
            .select()
            .from(videoShares)
            .where(and(eq(videoShares.videoId, data.videoId), eq(videoShares.userId, data.userId)))
            .limit(1);
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to check existing share',
            operation: 'shareWithUser.checkExisting',
            cause: error,
          }),
      });

      if (existing.length > 0) {
        // Update existing share
        const [updated] = yield* Effect.tryPromise({
          try: async () => {
            return await db
              .update(videoShares)
              .set({ accessLevel: data.accessLevel ?? 'view' })
              .where(eq(videoShares.id, existing[0].id))
              .returning();
          },
          catch: (error) =>
            new DatabaseError({
              message: 'Failed to update share',
              operation: 'shareWithUser.update',
              cause: error,
            }),
        });
        return updated;
      }

      // Create new share
      const [newShare] = yield* Effect.tryPromise({
        try: async () => {
          return await db
            .insert(videoShares)
            .values({
              videoId: data.videoId,
              userId: data.userId,
              accessLevel: data.accessLevel ?? 'view',
              sharedBy: data.sharedBy,
            })
            .returning();
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to create share',
            operation: 'shareWithUser.create',
            cause: error,
          }),
      });

      return newShare;
    });

  const shareWithTeam = (data: CreateTeamShareInput): Effect.Effect<VideoShare, DatabaseError | ValidationError> =>
    Effect.gen(function* () {
      // Validate that the video exists and is private
      const video = yield* Effect.tryPromise({
        try: async () => {
          return await db
            .select({ id: videos.id, visibility: videos.visibility, authorId: videos.authorId })
            .from(videos)
            .where(and(eq(videos.id, data.videoId), isNull(videos.deletedAt)))
            .limit(1);
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to check video',
            operation: 'shareWithTeam.checkVideo',
            cause: error,
          }),
      });

      if (!video.length) {
        return yield* Effect.fail(
          new ValidationError({
            message: 'Video not found',
            field: 'videoId',
          }),
        );
      }

      if (video[0].visibility !== 'private') {
        return yield* Effect.fail(
          new ValidationError({
            message: 'Only private videos can be shared with specific teams',
            field: 'videoId',
          }),
        );
      }

      if (video[0].authorId !== data.sharedBy) {
        return yield* Effect.fail(
          new ValidationError({
            message: 'Only the video author can share the video',
            field: 'sharedBy',
          }),
        );
      }

      // Check if share already exists
      const existing = yield* Effect.tryPromise({
        try: async () => {
          return await db
            .select()
            .from(videoShares)
            .where(and(eq(videoShares.videoId, data.videoId), eq(videoShares.teamId, data.teamId)))
            .limit(1);
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to check existing share',
            operation: 'shareWithTeam.checkExisting',
            cause: error,
          }),
      });

      if (existing.length > 0) {
        const [updated] = yield* Effect.tryPromise({
          try: async () => {
            return await db
              .update(videoShares)
              .set({ accessLevel: data.accessLevel ?? 'view' })
              .where(eq(videoShares.id, existing[0].id))
              .returning();
          },
          catch: (error) =>
            new DatabaseError({
              message: 'Failed to update share',
              operation: 'shareWithTeam.update',
              cause: error,
            }),
        });
        return updated;
      }

      const [newShare] = yield* Effect.tryPromise({
        try: async () => {
          return await db
            .insert(videoShares)
            .values({
              videoId: data.videoId,
              teamId: data.teamId,
              accessLevel: data.accessLevel ?? 'view',
              sharedBy: data.sharedBy,
            })
            .returning();
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to create share',
            operation: 'shareWithTeam.create',
            cause: error,
          }),
      });

      return newShare;
    });

  const getVideoShares = (videoId: string): Effect.Effect<VideoShareWithDetails[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        // Get all shares with user details
        const userShares = await db
          .select({
            id: videoShares.id,
            videoId: videoShares.videoId,
            userId: videoShares.userId,
            teamId: videoShares.teamId,
            accessLevel: videoShares.accessLevel,
            sharedBy: videoShares.sharedBy,
            createdAt: videoShares.createdAt,
            user: {
              id: users.id,
              name: users.name,
              email: users.email,
              image: users.image,
            },
          })
          .from(videoShares)
          .leftJoin(users, eq(videoShares.userId, users.id))
          .where(eq(videoShares.videoId, videoId));

        // Get team details for team shares
        const teamShares = await db
          .select({
            id: videoShares.id,
            videoId: videoShares.videoId,
            userId: videoShares.userId,
            teamId: videoShares.teamId,
            accessLevel: videoShares.accessLevel,
            sharedBy: videoShares.sharedBy,
            createdAt: videoShares.createdAt,
            team: {
              id: teams.id,
              name: teams.name,
            },
          })
          .from(videoShares)
          .innerJoin(teams, eq(videoShares.teamId, teams.id))
          .where(eq(videoShares.videoId, videoId));

        // Merge user and team shares
        const allShares: VideoShareWithDetails[] = [
          ...userShares
            .filter((s) => s.userId !== null)
            .map((s) => ({
              ...s,
              team: null,
            })),
          ...teamShares.map((s) => ({
            ...s,
            user: null,
          })),
        ];

        return allShares;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to get video shares',
          operation: 'getVideoShares',
          cause: error,
        }),
    });

  const removeShare = (shareId: string): Effect.Effect<void, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          return await db.delete(videoShares).where(eq(videoShares.id, shareId)).returning();
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to remove share',
            operation: 'removeShare',
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Share not found',
            entity: 'VideoShare',
            id: shareId,
          }),
        );
      }
    });

  const removeUserShare = (videoId: string, userId: string): Effect.Effect<void, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        await db.delete(videoShares).where(and(eq(videoShares.videoId, videoId), eq(videoShares.userId, userId)));
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to remove user share',
          operation: 'removeUserShare',
          cause: error,
        }),
    });

  const removeTeamShare = (videoId: string, teamId: string): Effect.Effect<void, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        await db.delete(videoShares).where(and(eq(videoShares.videoId, videoId), eq(videoShares.teamId, teamId)));
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to remove team share',
          operation: 'removeTeamShare',
          cause: error,
        }),
    });

  const hasUserShare = (
    videoId: string,
    userId: string,
  ): Effect.Effect<{ hasShare: boolean; accessLevel: 'view' | 'comment' | 'download' | null }, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const share = await db
          .select({ accessLevel: videoShares.accessLevel })
          .from(videoShares)
          .where(and(eq(videoShares.videoId, videoId), eq(videoShares.userId, userId)))
          .limit(1);

        if (share.length > 0) {
          return { hasShare: true, accessLevel: share[0].accessLevel };
        }
        return { hasShare: false, accessLevel: null };
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to check user share',
          operation: 'hasUserShare',
          cause: error,
        }),
    });

  const hasTeamShare = (
    videoId: string,
    userId: string,
  ): Effect.Effect<{ hasShare: boolean; accessLevel: 'view' | 'comment' | 'download' | null }, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        // Check if user is a member of any team that has access to this video
        const { teamMembers } = await import('@/lib/db/schema');
        const share = await db
          .select({ accessLevel: videoShares.accessLevel })
          .from(videoShares)
          .innerJoin(teamMembers, eq(videoShares.teamId, teamMembers.teamId))
          .where(and(eq(videoShares.videoId, videoId), eq(teamMembers.userId, userId)))
          .limit(1);

        if (share.length > 0) {
          return { hasShare: true, accessLevel: share[0].accessLevel };
        }
        return { hasShare: false, accessLevel: null };
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to check team share',
          operation: 'hasTeamShare',
          cause: error,
        }),
    });

  const getVideosSharedWithUser = (userId: string, organizationId: string): Effect.Effect<string[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const { teamMembers } = await import('@/lib/db/schema');

        // Direct user shares
        const userShares = await db
          .select({ videoId: videoShares.videoId })
          .from(videoShares)
          .innerJoin(videos, eq(videoShares.videoId, videos.id))
          .where(
            and(eq(videoShares.userId, userId), eq(videos.organizationId, organizationId), isNull(videos.deletedAt)),
          );

        // Team shares
        const teamSharesList = await db
          .select({ videoId: videoShares.videoId })
          .from(videoShares)
          .innerJoin(teamMembers, eq(videoShares.teamId, teamMembers.teamId))
          .innerJoin(videos, eq(videoShares.videoId, videos.id))
          .where(
            and(eq(teamMembers.userId, userId), eq(videos.organizationId, organizationId), isNull(videos.deletedAt)),
          );

        // Combine and deduplicate
        const videoIds = [...new Set([...userShares.map((s) => s.videoId), ...teamSharesList.map((s) => s.videoId)])];

        return videoIds;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to get videos shared with user',
          operation: 'getVideosSharedWithUser',
          cause: error,
        }),
    });

  return {
    shareWithUser,
    shareWithTeam,
    getVideoShares,
    removeShare,
    removeUserShare,
    removeTeamShare,
    hasUserShare,
    hasTeamShare,
    getVideosSharedWithUser,
  } satisfies VideoSharesRepositoryService;
});

// =============================================================================
// Video Shares Repository Layer
// =============================================================================

export const VideoSharesRepositoryLive = Layer.effect(VideoSharesRepository, makeVideoSharesRepositoryService);

// =============================================================================
// Video Shares Repository Helper Functions
// =============================================================================

export const shareWithUser = (
  data: CreateUserShareInput,
): Effect.Effect<VideoShare, DatabaseError | ValidationError, VideoSharesRepository> =>
  Effect.gen(function* () {
    const repo = yield* VideoSharesRepository;
    return yield* repo.shareWithUser(data);
  });

export const shareWithTeam = (
  data: CreateTeamShareInput,
): Effect.Effect<VideoShare, DatabaseError | ValidationError, VideoSharesRepository> =>
  Effect.gen(function* () {
    const repo = yield* VideoSharesRepository;
    return yield* repo.shareWithTeam(data);
  });

export const getVideoShares = (
  videoId: string,
): Effect.Effect<VideoShareWithDetails[], DatabaseError, VideoSharesRepository> =>
  Effect.gen(function* () {
    const repo = yield* VideoSharesRepository;
    return yield* repo.getVideoShares(videoId);
  });

export const removeShare = (
  shareId: string,
): Effect.Effect<void, DatabaseError | NotFoundError, VideoSharesRepository> =>
  Effect.gen(function* () {
    const repo = yield* VideoSharesRepository;
    return yield* repo.removeShare(shareId);
  });

export const removeUserShare = (
  videoId: string,
  userId: string,
): Effect.Effect<void, DatabaseError, VideoSharesRepository> =>
  Effect.gen(function* () {
    const repo = yield* VideoSharesRepository;
    return yield* repo.removeUserShare(videoId, userId);
  });

export const removeTeamShare = (
  videoId: string,
  teamId: string,
): Effect.Effect<void, DatabaseError, VideoSharesRepository> =>
  Effect.gen(function* () {
    const repo = yield* VideoSharesRepository;
    return yield* repo.removeTeamShare(videoId, teamId);
  });

export const hasUserShare = (
  videoId: string,
  userId: string,
): Effect.Effect<
  { hasShare: boolean; accessLevel: 'view' | 'comment' | 'download' | null },
  DatabaseError,
  VideoSharesRepository
> =>
  Effect.gen(function* () {
    const repo = yield* VideoSharesRepository;
    return yield* repo.hasUserShare(videoId, userId);
  });

export const hasTeamShare = (
  videoId: string,
  userId: string,
): Effect.Effect<
  { hasShare: boolean; accessLevel: 'view' | 'comment' | 'download' | null },
  DatabaseError,
  VideoSharesRepository
> =>
  Effect.gen(function* () {
    const repo = yield* VideoSharesRepository;
    return yield* repo.hasTeamShare(videoId, userId);
  });

export const getVideosSharedWithUser = (
  userId: string,
  organizationId: string,
): Effect.Effect<string[], DatabaseError, VideoSharesRepository> =>
  Effect.gen(function* () {
    const repo = yield* VideoSharesRepository;
    return yield* repo.getVideosSharedWithUser(userId, organizationId);
  });
