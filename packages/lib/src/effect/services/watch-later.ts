/**
 * Watch Later Service using Effect-TS
 *
 * Manages user bookmarks and watch later lists:
 * - Add/remove videos to watch later
 * - Priority and ordering
 * - Notes and annotations
 */

import { and, desc, eq, isNull } from 'drizzle-orm';
import { Context, Effect, Layer } from 'effect';
import { users, videos, type WatchLater, watchLater } from '../../db/schema';
import type { VideoWithAuthor } from '../../types';
import { DatabaseError, NotFoundError } from '../errors';
import { Database } from './database';

// =============================================================================
// Types
// =============================================================================

export interface WatchLaterItem {
  readonly id: string;
  readonly video: VideoWithAuthor;
  readonly addedAt: Date;
  readonly priority: number;
  readonly notes: string | null;
}

export interface AddToWatchLaterInput {
  readonly userId: string;
  readonly videoId: string;
  readonly priority?: number;
  readonly notes?: string;
}

export interface UpdateWatchLaterInput {
  readonly priority?: number;
  readonly notes?: string;
}

export interface WatchLaterServiceInterface {
  /**
   * Get user's watch later list
   */
  readonly getWatchLaterList: (
    userId: string,
    organizationId: string,
    sortBy?: 'addedAt' | 'priority',
  ) => Effect.Effect<WatchLaterItem[], DatabaseError>;

  /**
   * Add a video to watch later
   */
  readonly addToWatchLater: (input: AddToWatchLaterInput) => Effect.Effect<WatchLater, DatabaseError>;

  /**
   * Remove a video from watch later
   */
  readonly removeFromWatchLater: (
    userId: string,
    videoId: string,
  ) => Effect.Effect<void, DatabaseError | NotFoundError>;

  /**
   * Update watch later item (priority, notes)
   */
  readonly updateWatchLaterItem: (
    userId: string,
    videoId: string,
    update: UpdateWatchLaterInput,
  ) => Effect.Effect<WatchLater, DatabaseError | NotFoundError>;

  /**
   * Check if video is in watch later
   */
  readonly isInWatchLater: (userId: string, videoId: string) => Effect.Effect<boolean, DatabaseError>;

  /**
   * Move item to top of list
   */
  readonly moveToTop: (userId: string, videoId: string) => Effect.Effect<void, DatabaseError | NotFoundError>;

  /**
   * Get watch later count for user
   */
  readonly getWatchLaterCount: (userId: string) => Effect.Effect<number, DatabaseError>;

  /**
   * Clear all watch later items
   */
  readonly clearWatchLater: (userId: string) => Effect.Effect<number, DatabaseError>;
}

// =============================================================================
// Watch Later Service Tag
// =============================================================================

export class WatchLaterService extends Context.Tag('WatchLaterService')<
  WatchLaterService,
  WatchLaterServiceInterface
>() {}

// =============================================================================
// Watch Later Service Implementation
// =============================================================================

const makeWatchLaterService = Effect.gen(function* () {
  const { db } = yield* Database;

  const getWatchLaterList = (
    userId: string,
    organizationId: string,
    sortBy: 'addedAt' | 'priority' = 'addedAt',
  ): Effect.Effect<WatchLaterItem[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const orderByClause = sortBy === 'priority' ? desc(watchLater.priority) : desc(watchLater.addedAt);

        const items = await db
          .select({
            id: watchLater.id,
            addedAt: watchLater.addedAt,
            priority: watchLater.priority,
            notes: watchLater.notes,
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
              visibility: videos.visibility,
              deletedAt: videos.deletedAt,
              retentionUntil: videos.retentionUntil,
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
              stripeCustomerId: users.stripeCustomerId,
              lastLoginMethod: users.lastLoginMethod,
            },
          })
          .from(watchLater)
          .innerJoin(videos, eq(watchLater.videoId, videos.id))
          .innerJoin(users, eq(videos.authorId, users.id))
          .where(
            and(eq(watchLater.userId, userId), eq(videos.organizationId, organizationId), isNull(videos.deletedAt)),
          )
          .orderBy(orderByClause);

        return items.map((item) => ({
          id: item.id,
          video: {
            ...item.video,
            author: item.author,
          } as VideoWithAuthor,
          addedAt: item.addedAt,
          priority: item.priority,
          notes: item.notes,
        }));
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to get watch later list',
          operation: 'getWatchLaterList',
          cause: error,
        }),
    });

  const addToWatchLater = (input: AddToWatchLaterInput): Effect.Effect<WatchLater, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const [item] = await db
          .insert(watchLater)
          .values({
            userId: input.userId,
            videoId: input.videoId,
            priority: input.priority ?? 0,
            notes: input.notes ?? null,
            addedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [watchLater.userId, watchLater.videoId],
            set: {
              priority: input.priority ?? 0,
              notes: input.notes ?? null,
              addedAt: new Date(),
            },
          })
          .returning();

        return item;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to add to watch later',
          operation: 'addToWatchLater',
          cause: error,
        }),
    });

  const removeFromWatchLater = (userId: string, videoId: string): Effect.Effect<void, DatabaseError | NotFoundError> =>
    Effect.tryPromise({
      try: async () => {
        const result = await db
          .delete(watchLater)
          .where(and(eq(watchLater.userId, userId), eq(watchLater.videoId, videoId)))
          .returning({ id: watchLater.id });

        if (result.length === 0) {
          throw new NotFoundError({
            message: 'Video not found in watch later list',
            entity: 'WatchLater',
          });
        }
      },
      catch: (error) => {
        if (error instanceof NotFoundError) {
          return error;
        }
        return new DatabaseError({
          message: 'Failed to remove from watch later',
          operation: 'removeFromWatchLater',
          cause: error,
        });
      },
    });

  const updateWatchLaterItem = (
    userId: string,
    videoId: string,
    update: UpdateWatchLaterInput,
  ): Effect.Effect<WatchLater, DatabaseError | NotFoundError> =>
    Effect.tryPromise({
      try: async () => {
        const result = await db
          .update(watchLater)
          .set({
            ...(update.priority !== undefined && { priority: update.priority }),
            ...(update.notes !== undefined && { notes: update.notes }),
          })
          .where(and(eq(watchLater.userId, userId), eq(watchLater.videoId, videoId)))
          .returning();

        if (result.length === 0) {
          throw new NotFoundError({
            message: 'Video not found in watch later list',
            entity: 'WatchLater',
          });
        }

        return result[0];
      },
      catch: (error) => {
        if (error instanceof NotFoundError) {
          return error;
        }
        return new DatabaseError({
          message: 'Failed to update watch later item',
          operation: 'updateWatchLaterItem',
          cause: error,
        });
      },
    });

  const isInWatchLater = (userId: string, videoId: string): Effect.Effect<boolean, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const result = await db
          .select({ id: watchLater.id })
          .from(watchLater)
          .where(and(eq(watchLater.userId, userId), eq(watchLater.videoId, videoId)))
          .limit(1);

        return result.length > 0;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to check watch later status',
          operation: 'isInWatchLater',
          cause: error,
        }),
    });

  const moveToTop = (userId: string, videoId: string): Effect.Effect<void, DatabaseError | NotFoundError> =>
    Effect.tryPromise({
      try: async () => {
        // Get the highest priority
        const maxPriority = await db
          .select({ max: watchLater.priority })
          .from(watchLater)
          .where(eq(watchLater.userId, userId));

        const newPriority = (maxPriority[0]?.max ?? 0) + 1;

        const result = await db
          .update(watchLater)
          .set({ priority: newPriority, addedAt: new Date() })
          .where(and(eq(watchLater.userId, userId), eq(watchLater.videoId, videoId)))
          .returning({ id: watchLater.id });

        if (result.length === 0) {
          throw new NotFoundError({
            message: 'Video not found in watch later list',
            entity: 'WatchLater',
          });
        }
      },
      catch: (error) => {
        if (error instanceof NotFoundError) {
          return error;
        }
        return new DatabaseError({
          message: 'Failed to move to top',
          operation: 'moveToTop',
          cause: error,
        });
      },
    });

  const getWatchLaterCount = (userId: string): Effect.Effect<number, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const result = await db.select({ count: watchLater.id }).from(watchLater).where(eq(watchLater.userId, userId));

        return result.length;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to get watch later count',
          operation: 'getWatchLaterCount',
          cause: error,
        }),
    });

  const clearWatchLater = (userId: string): Effect.Effect<number, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const result = await db
          .delete(watchLater)
          .where(eq(watchLater.userId, userId))
          .returning({ id: watchLater.id });

        return result.length;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to clear watch later',
          operation: 'clearWatchLater',
          cause: error,
        }),
    });

  return {
    getWatchLaterList,
    addToWatchLater,
    removeFromWatchLater,
    updateWatchLaterItem,
    isInWatchLater,
    moveToTop,
    getWatchLaterCount,
    clearWatchLater,
  } satisfies WatchLaterServiceInterface;
});

// =============================================================================
// Watch Later Layer
// =============================================================================

export const WatchLaterServiceLive = Layer.effect(WatchLaterService, makeWatchLaterService);

// =============================================================================
// Helper Functions
// =============================================================================

export const getWatchLaterList = (
  userId: string,
  organizationId: string,
  sortBy?: 'addedAt' | 'priority',
): Effect.Effect<WatchLaterItem[], DatabaseError, WatchLaterService> =>
  Effect.gen(function* () {
    const service = yield* WatchLaterService;
    return yield* service.getWatchLaterList(userId, organizationId, sortBy);
  });

export const addToWatchLater = (
  input: AddToWatchLaterInput,
): Effect.Effect<WatchLater, DatabaseError, WatchLaterService> =>
  Effect.gen(function* () {
    const service = yield* WatchLaterService;
    return yield* service.addToWatchLater(input);
  });

export const removeFromWatchLater = (
  userId: string,
  videoId: string,
): Effect.Effect<void, DatabaseError | NotFoundError, WatchLaterService> =>
  Effect.gen(function* () {
    const service = yield* WatchLaterService;
    return yield* service.removeFromWatchLater(userId, videoId);
  });

export const isInWatchLater = (
  userId: string,
  videoId: string,
): Effect.Effect<boolean, DatabaseError, WatchLaterService> =>
  Effect.gen(function* () {
    const service = yield* WatchLaterService;
    return yield* service.isInWatchLater(userId, videoId);
  });
