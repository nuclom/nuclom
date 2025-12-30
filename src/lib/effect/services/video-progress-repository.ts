/**
 * Video Progress Repository Service using Effect-TS
 *
 * Provides type-safe database operations for tracking video playback progress.
 * Enables "resume where you left off" functionality for users.
 */

import { Effect, Context, Layer } from "effect";
import { eq, and } from "drizzle-orm";
import { Database } from "./database";
import { videoProgresses, type VideoProgress, type NewVideoProgress } from "@/lib/db/schema";
import { DatabaseError, NotFoundError } from "../errors";

// =============================================================================
// Types
// =============================================================================

export interface VideoProgressData {
  /** Video ID */
  readonly videoId: string;
  /** User ID */
  readonly userId: string;
  /** Current playback position in seconds (stored as string for precision) */
  readonly currentTime: string;
  /** Whether the video has been completed (watched >= 90%) */
  readonly completed: boolean;
  /** Last time the video was watched */
  readonly lastWatchedAt: Date;
}

export interface SaveProgressInput {
  readonly videoId: string;
  readonly userId: string;
  /** Current time in seconds */
  readonly currentTime: number;
  /** Whether video is completed */
  readonly completed: boolean;
}

export interface VideoProgressWithVideo extends VideoProgress {
  readonly video?: {
    readonly id: string;
    readonly title: string;
    readonly thumbnailUrl: string | null;
    readonly duration: string;
  };
}

// =============================================================================
// Video Progress Repository Service Interface
// =============================================================================

export interface VideoProgressRepositoryService {
  /**
   * Get the playback progress for a specific video and user
   */
  readonly getProgress: (videoId: string, userId: string) => Effect.Effect<VideoProgressData | null, DatabaseError>;

  /**
   * Save or update playback progress for a video
   * Uses upsert (insert or update) based on unique userId+videoId constraint
   */
  readonly saveProgress: (input: SaveProgressInput) => Effect.Effect<VideoProgressData, DatabaseError>;

  /**
   * Get all video progress entries for a user
   * Useful for "Continue Watching" feature
   */
  readonly getUserProgress: (userId: string, limit?: number) => Effect.Effect<VideoProgressData[], DatabaseError>;

  /**
   * Delete progress for a specific video
   */
  readonly deleteProgress: (videoId: string, userId: string) => Effect.Effect<void, DatabaseError | NotFoundError>;

  /**
   * Check if a user has watched a video (has any progress)
   */
  readonly hasWatched: (videoId: string, userId: string) => Effect.Effect<boolean, DatabaseError>;

  /**
   * Mark a video as completed
   */
  readonly markCompleted: (videoId: string, userId: string) => Effect.Effect<VideoProgressData, DatabaseError>;
}

// =============================================================================
// Video Progress Repository Tag
// =============================================================================

export class VideoProgressRepository extends Context.Tag("VideoProgressRepository")<
  VideoProgressRepository,
  VideoProgressRepositoryService
>() {}

// =============================================================================
// Video Progress Repository Implementation
// =============================================================================

const makeVideoProgressRepositoryService = Effect.gen(function* () {
  const { db } = yield* Database;

  const getProgress = (videoId: string, userId: string): Effect.Effect<VideoProgressData | null, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const result = await db
          .select()
          .from(videoProgresses)
          .where(and(eq(videoProgresses.videoId, videoId), eq(videoProgresses.userId, userId)))
          .limit(1);

        if (!result.length) {
          return null;
        }

        return {
          videoId: result[0].videoId,
          userId: result[0].userId,
          currentTime: result[0].currentTime,
          completed: result[0].completed,
          lastWatchedAt: result[0].lastWatchedAt,
        };
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch video progress",
          operation: "getProgress",
          cause: error,
        }),
    });

  const saveProgress = (input: SaveProgressInput): Effect.Effect<VideoProgressData, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const currentTimeStr = input.currentTime.toString();
        const now = new Date();

        // Try to update first
        const existing = await db
          .select()
          .from(videoProgresses)
          .where(and(eq(videoProgresses.videoId, input.videoId), eq(videoProgresses.userId, input.userId)))
          .limit(1);

        if (existing.length > 0) {
          // Update existing record
          const [updated] = await db
            .update(videoProgresses)
            .set({
              currentTime: currentTimeStr,
              completed: input.completed,
              lastWatchedAt: now,
            })
            .where(eq(videoProgresses.id, existing[0].id))
            .returning();

          return {
            videoId: updated.videoId,
            userId: updated.userId,
            currentTime: updated.currentTime,
            completed: updated.completed,
            lastWatchedAt: updated.lastWatchedAt,
          };
        }

        // Insert new record
        const [created] = await db
          .insert(videoProgresses)
          .values({
            videoId: input.videoId,
            userId: input.userId,
            currentTime: currentTimeStr,
            completed: input.completed,
            lastWatchedAt: now,
          })
          .returning();

        return {
          videoId: created.videoId,
          userId: created.userId,
          currentTime: created.currentTime,
          completed: created.completed,
          lastWatchedAt: created.lastWatchedAt,
        };
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to save video progress",
          operation: "saveProgress",
          cause: error,
        }),
    });

  const getUserProgress = (userId: string, limit = 20): Effect.Effect<VideoProgressData[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const results = await db
          .select()
          .from(videoProgresses)
          .where(eq(videoProgresses.userId, userId))
          .orderBy(videoProgresses.lastWatchedAt)
          .limit(limit);

        return results.map((r) => ({
          videoId: r.videoId,
          userId: r.userId,
          currentTime: r.currentTime,
          completed: r.completed,
          lastWatchedAt: r.lastWatchedAt,
        }));
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch user video progress",
          operation: "getUserProgress",
          cause: error,
        }),
    });

  const deleteProgress = (videoId: string, userId: string): Effect.Effect<void, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          return await db
            .delete(videoProgresses)
            .where(and(eq(videoProgresses.videoId, videoId), eq(videoProgresses.userId, userId)))
            .returning();
        },
        catch: (error) =>
          new DatabaseError({
            message: "Failed to delete video progress",
            operation: "deleteProgress",
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: "Video progress not found",
            entity: "VideoProgress",
            id: `${videoId}:${userId}`,
          }),
        );
      }
    });

  const hasWatched = (videoId: string, userId: string): Effect.Effect<boolean, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const result = await db
          .select({ id: videoProgresses.id })
          .from(videoProgresses)
          .where(and(eq(videoProgresses.videoId, videoId), eq(videoProgresses.userId, userId)))
          .limit(1);

        return result.length > 0;
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to check video watch status",
          operation: "hasWatched",
          cause: error,
        }),
    });

  const markCompleted = (videoId: string, userId: string): Effect.Effect<VideoProgressData, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const now = new Date();

        // Try to find existing record
        const existing = await db
          .select()
          .from(videoProgresses)
          .where(and(eq(videoProgresses.videoId, videoId), eq(videoProgresses.userId, userId)))
          .limit(1);

        if (existing.length > 0) {
          // Update existing to mark as completed
          const [updated] = await db
            .update(videoProgresses)
            .set({
              completed: true,
              lastWatchedAt: now,
            })
            .where(eq(videoProgresses.id, existing[0].id))
            .returning();

          return {
            videoId: updated.videoId,
            userId: updated.userId,
            currentTime: updated.currentTime,
            completed: updated.completed,
            lastWatchedAt: updated.lastWatchedAt,
          };
        }

        // Create new record marked as completed
        const [created] = await db
          .insert(videoProgresses)
          .values({
            videoId,
            userId,
            currentTime: "0",
            completed: true,
            lastWatchedAt: now,
          })
          .returning();

        return {
          videoId: created.videoId,
          userId: created.userId,
          currentTime: created.currentTime,
          completed: created.completed,
          lastWatchedAt: created.lastWatchedAt,
        };
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to mark video as completed",
          operation: "markCompleted",
          cause: error,
        }),
    });

  return {
    getProgress,
    saveProgress,
    getUserProgress,
    deleteProgress,
    hasWatched,
    markCompleted,
  } satisfies VideoProgressRepositoryService;
});

// =============================================================================
// Video Progress Repository Layer
// =============================================================================

export const VideoProgressRepositoryLive = Layer.effect(VideoProgressRepository, makeVideoProgressRepositoryService);

// =============================================================================
// Video Progress Repository Helper Functions
// =============================================================================

/**
 * Get playback progress for a video and user
 */
export const getVideoProgress = (
  videoId: string,
  userId: string,
): Effect.Effect<VideoProgressData | null, DatabaseError, VideoProgressRepository> =>
  Effect.gen(function* () {
    const repo = yield* VideoProgressRepository;
    return yield* repo.getProgress(videoId, userId);
  });

/**
 * Save or update playback progress
 */
export const saveVideoProgress = (
  input: SaveProgressInput,
): Effect.Effect<VideoProgressData, DatabaseError, VideoProgressRepository> =>
  Effect.gen(function* () {
    const repo = yield* VideoProgressRepository;
    return yield* repo.saveProgress(input);
  });

/**
 * Get all video progress for a user
 */
export const getUserVideoProgress = (
  userId: string,
  limit?: number,
): Effect.Effect<VideoProgressData[], DatabaseError, VideoProgressRepository> =>
  Effect.gen(function* () {
    const repo = yield* VideoProgressRepository;
    return yield* repo.getUserProgress(userId, limit);
  });

/**
 * Delete progress for a video
 */
export const deleteVideoProgress = (
  videoId: string,
  userId: string,
): Effect.Effect<void, DatabaseError | NotFoundError, VideoProgressRepository> =>
  Effect.gen(function* () {
    const repo = yield* VideoProgressRepository;
    return yield* repo.deleteProgress(videoId, userId);
  });

/**
 * Check if user has watched a video
 */
export const hasWatchedVideo = (
  videoId: string,
  userId: string,
): Effect.Effect<boolean, DatabaseError, VideoProgressRepository> =>
  Effect.gen(function* () {
    const repo = yield* VideoProgressRepository;
    return yield* repo.hasWatched(videoId, userId);
  });

/**
 * Mark a video as completed
 */
export const markVideoCompleted = (
  videoId: string,
  userId: string,
): Effect.Effect<VideoProgressData, DatabaseError, VideoProgressRepository> =>
  Effect.gen(function* () {
    const repo = yield* VideoProgressRepository;
    return yield* repo.markCompleted(videoId, userId);
  });
