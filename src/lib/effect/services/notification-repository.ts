/**
 * Notification Repository Service using Effect-TS
 *
 * Provides type-safe database operations for notifications.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import type { Notification, User } from "@/lib/db/schema";
import { comments, notifications, users, videos } from "@/lib/db/schema";
import { DatabaseError, NotFoundError } from "../errors";
import { Database } from "./database";

// =============================================================================
// Types
// =============================================================================

export type NotificationWithActor = Notification & {
  actor: User | null;
};

export type NotificationType =
  | "comment_reply"
  | "comment_mention"
  | "new_comment_on_video"
  | "video_shared"
  | "video_processing_complete"
  | "video_processing_failed"
  | "invitation_received"
  | "trial_ending"
  | "subscription_created"
  | "subscription_updated"
  | "subscription_canceled"
  | "payment_failed"
  | "payment_succeeded";

export interface CreateNotificationInput {
  readonly userId: string;
  readonly type: NotificationType;
  readonly title: string;
  readonly body?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly actorId?: string;
}

export interface NotificationRepositoryService {
  /**
   * Get all notifications for a user
   */
  readonly getNotifications: (
    userId: string,
    page?: number,
    limit?: number,
  ) => Effect.Effect<{ data: NotificationWithActor[]; unreadCount: number }, DatabaseError>;

  /**
   * Get unread notification count for a user
   */
  readonly getUnreadCount: (userId: string) => Effect.Effect<number, DatabaseError>;

  /**
   * Create a notification
   */
  readonly createNotification: (data: CreateNotificationInput) => Effect.Effect<Notification, DatabaseError>;

  /**
   * Create notifications for comment reply (notifies parent comment author)
   */
  readonly notifyCommentReply: (
    parentCommentId: string,
    replyCommentId: string,
    actorId: string,
    videoId: string,
  ) => Effect.Effect<Notification | null, DatabaseError>;

  /**
   * Create notifications for new comment on video (notifies video owner)
   */
  readonly notifyNewCommentOnVideo: (
    videoId: string,
    commentId: string,
    actorId: string,
  ) => Effect.Effect<Notification | null, DatabaseError>;

  /**
   * Mark a notification as read
   */
  readonly markAsRead: (id: string, userId: string) => Effect.Effect<Notification, DatabaseError | NotFoundError>;

  /**
   * Mark all notifications as read for a user
   */
  readonly markAllAsRead: (userId: string) => Effect.Effect<number, DatabaseError>;

  /**
   * Delete a notification
   */
  readonly deleteNotification: (id: string, userId: string) => Effect.Effect<void, DatabaseError | NotFoundError>;
}

// =============================================================================
// Notification Repository Tag
// =============================================================================

export class NotificationRepository extends Context.Tag("NotificationRepository")<
  NotificationRepository,
  NotificationRepositoryService
>() {}

// =============================================================================
// Notification Repository Implementation
// =============================================================================

const makeNotificationRepositoryService = Effect.gen(function* () {
  const { db } = yield* Database;

  const getNotifications = (
    userId: string,
    page = 1,
    limit = 20,
  ): Effect.Effect<{ data: NotificationWithActor[]; unreadCount: number }, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const offset = (page - 1) * limit;

        const [notificationsData, unreadResult] = await Promise.all([
          db.query.notifications.findMany({
            where: eq(notifications.userId, userId),
            with: {
              actor: true,
            },
            orderBy: desc(notifications.createdAt),
            limit,
            offset,
          }),
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(notifications)
            .where(and(eq(notifications.userId, userId), eq(notifications.read, false))),
        ]);

        return {
          data: notificationsData as NotificationWithActor[],
          unreadCount: unreadResult[0]?.count ?? 0,
        };
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch notifications",
          operation: "getNotifications",
          cause: error,
        }),
    });

  const getUnreadCount = (userId: string): Effect.Effect<number, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const result = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(notifications)
          .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
        return result[0]?.count ?? 0;
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch unread count",
          operation: "getUnreadCount",
          cause: error,
        }),
    });

  const createNotification = (data: CreateNotificationInput): Effect.Effect<Notification, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const [notification] = await db.insert(notifications).values(data).returning();
        return notification;
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to create notification",
          operation: "createNotification",
          cause: error,
        }),
    });

  const notifyCommentReply = (
    parentCommentId: string,
    _replyCommentId: string,
    actorId: string,
    videoId: string,
  ): Effect.Effect<Notification | null, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        // Get parent comment author
        const parentComment = await db.query.comments.findFirst({
          where: eq(comments.id, parentCommentId),
          with: {
            author: true,
          },
        });

        if (!parentComment || parentComment.authorId === actorId) {
          // Don't notify if replying to own comment
          return null;
        }

        // Get actor info
        const actor = await db.query.users.findFirst({
          where: eq(users.id, actorId),
        });

        const [notification] = await db
          .insert(notifications)
          .values({
            userId: parentComment.authorId,
            type: "comment_reply",
            title: "New reply to your comment",
            body: `${actor?.name || "Someone"} replied to your comment`,
            resourceType: "video",
            resourceId: videoId,
            actorId,
          })
          .returning();

        return notification;
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to create comment reply notification",
          operation: "notifyCommentReply",
          cause: error,
        }),
    });

  const notifyNewCommentOnVideo = (
    videoId: string,
    _commentId: string,
    actorId: string,
  ): Effect.Effect<Notification | null, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        // Get video owner
        const video = await db.query.videos.findFirst({
          where: eq(videos.id, videoId),
        });

        // Don't notify if video has no author (deleted user) or commenting on own video
        if (!video || !video.authorId || video.authorId === actorId) {
          return null;
        }

        // Get actor info
        const actor = await db.query.users.findFirst({
          where: eq(users.id, actorId),
        });

        const [notification] = await db
          .insert(notifications)
          .values({
            userId: video.authorId,
            type: "new_comment_on_video",
            title: "New comment on your video",
            body: `${actor?.name || "Someone"} commented on "${video.title}"`,
            resourceType: "video",
            resourceId: videoId,
            actorId,
          })
          .returning();

        return notification;
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to create new comment notification",
          operation: "notifyNewCommentOnVideo",
          cause: error,
        }),
    });

  const markAsRead = (id: string, userId: string): Effect.Effect<Notification, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          return await db
            .update(notifications)
            .set({ read: true })
            .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
            .returning();
        },
        catch: (error) =>
          new DatabaseError({
            message: "Failed to mark notification as read",
            operation: "markAsRead",
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: "Notification not found",
            entity: "Notification",
            id,
          }),
        );
      }

      return result[0];
    });

  const markAllAsRead = (userId: string): Effect.Effect<number, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const result = await db
          .update(notifications)
          .set({ read: true })
          .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
          .returning();
        return result.length;
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to mark all notifications as read",
          operation: "markAllAsRead",
          cause: error,
        }),
    });

  const deleteNotification = (id: string, userId: string): Effect.Effect<void, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          return await db
            .delete(notifications)
            .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
            .returning();
        },
        catch: (error) =>
          new DatabaseError({
            message: "Failed to delete notification",
            operation: "deleteNotification",
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: "Notification not found",
            entity: "Notification",
            id,
          }),
        );
      }
    });

  return {
    getNotifications,
    getUnreadCount,
    createNotification,
    notifyCommentReply,
    notifyNewCommentOnVideo,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } satisfies NotificationRepositoryService;
});

// =============================================================================
// Notification Repository Layer
// =============================================================================

export const NotificationRepositoryLive = Layer.effect(NotificationRepository, makeNotificationRepositoryService);

// =============================================================================
// Notification Repository Helper Functions
// =============================================================================

export const getNotifications = (
  userId: string,
  page?: number,
  limit?: number,
): Effect.Effect<{ data: NotificationWithActor[]; unreadCount: number }, DatabaseError, NotificationRepository> =>
  Effect.gen(function* () {
    const repo = yield* NotificationRepository;
    return yield* repo.getNotifications(userId, page, limit);
  });

export const getUnreadCount = (userId: string): Effect.Effect<number, DatabaseError, NotificationRepository> =>
  Effect.gen(function* () {
    const repo = yield* NotificationRepository;
    return yield* repo.getUnreadCount(userId);
  });

export const createNotification = (
  data: CreateNotificationInput,
): Effect.Effect<Notification, DatabaseError, NotificationRepository> =>
  Effect.gen(function* () {
    const repo = yield* NotificationRepository;
    return yield* repo.createNotification(data);
  });

export const notifyCommentReply = (
  parentCommentId: string,
  replyCommentId: string,
  actorId: string,
  videoId: string,
): Effect.Effect<Notification | null, DatabaseError, NotificationRepository> =>
  Effect.gen(function* () {
    const repo = yield* NotificationRepository;
    return yield* repo.notifyCommentReply(parentCommentId, replyCommentId, actorId, videoId);
  });

export const notifyNewCommentOnVideo = (
  videoId: string,
  commentId: string,
  actorId: string,
): Effect.Effect<Notification | null, DatabaseError, NotificationRepository> =>
  Effect.gen(function* () {
    const repo = yield* NotificationRepository;
    return yield* repo.notifyNewCommentOnVideo(videoId, commentId, actorId);
  });

export const markAsRead = (
  id: string,
  userId: string,
): Effect.Effect<Notification, DatabaseError | NotFoundError, NotificationRepository> =>
  Effect.gen(function* () {
    const repo = yield* NotificationRepository;
    return yield* repo.markAsRead(id, userId);
  });

export const markAllAsRead = (userId: string): Effect.Effect<number, DatabaseError, NotificationRepository> =>
  Effect.gen(function* () {
    const repo = yield* NotificationRepository;
    return yield* repo.markAllAsRead(userId);
  });

export const deleteNotification = (
  id: string,
  userId: string,
): Effect.Effect<void, DatabaseError | NotFoundError, NotificationRepository> =>
  Effect.gen(function* () {
    const repo = yield* NotificationRepository;
    return yield* repo.deleteNotification(id, userId);
  });
