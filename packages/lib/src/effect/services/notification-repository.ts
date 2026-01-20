/**
 * Notification Repository Service using Effect-TS
 *
 * Provides type-safe database operations for notifications.
 */

import { and, desc, eq, sql } from 'drizzle-orm';
import { Context, Effect, Layer } from 'effect';
import type { Notification, User } from '../../db/schema';
import { notifications } from '../../db/schema';
import { DatabaseError, NotFoundError } from '../errors';
import { Database } from './database';

// =============================================================================
// Types
// =============================================================================

export type NotificationWithActor = Notification & {
  actor: User | null;
};

export type NotificationType =
  | 'video_shared'
  | 'video_processing_complete'
  | 'video_processing_failed'
  | 'invitation_received'
  | 'trial_ending'
  | 'subscription_created'
  | 'subscription_updated'
  | 'subscription_canceled'
  | 'payment_failed'
  | 'payment_succeeded';

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

export class NotificationRepository extends Context.Tag('NotificationRepository')<
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
    Effect.gen(function* () {
      const offset = (page - 1) * limit;

      // Fetch notifications with actor relation
      const notificationsData = yield* Effect.tryPromise({
        try: () =>
          db.query.notifications.findMany({
            where: eq(notifications.userId, userId),
            with: {
              actor: true,
            },
            orderBy: desc(notifications.createdAt),
            limit,
            offset,
          }),
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to fetch notifications list',
            operation: 'getNotifications.findMany',
            cause: error,
          }),
      });

      // Fetch unread count in parallel (but handle errors separately)
      const unreadResult = yield* Effect.tryPromise({
        try: () =>
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(notifications)
            .where(and(eq(notifications.userId, userId), eq(notifications.read, false))),
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to fetch unread notification count',
            operation: 'getNotifications.unreadCount',
            cause: error,
          }),
      });

      return {
        data: notificationsData as NotificationWithActor[],
        unreadCount: unreadResult[0]?.count ?? 0,
      };
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
          message: 'Failed to fetch unread count',
          operation: 'getUnreadCount',
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
          message: 'Failed to create notification',
          operation: 'createNotification',
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
            message: 'Failed to mark notification as read',
            operation: 'markAsRead',
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Notification not found',
            entity: 'Notification',
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
          message: 'Failed to mark all notifications as read',
          operation: 'markAllAsRead',
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
            message: 'Failed to delete notification',
            operation: 'deleteNotification',
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Notification not found',
            entity: 'Notification',
            id,
          }),
        );
      }
    });

  return {
    getNotifications,
    getUnreadCount,
    createNotification,
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
