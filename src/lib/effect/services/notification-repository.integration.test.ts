/**
 * NotificationRepository Integration Tests
 *
 * Tests the NotificationRepository service using Effect-TS dependency injection
 * to mock the Database service.
 */

import { Effect, Exit, Layer } from 'effect';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockDatabaseService, createMockNotification, type MockDatabaseService } from '@/test/effect-test-utils';
import { createMockUser } from '@/test/mocks';
import { Database } from './database';
import {
  type CreateNotificationInput,
  NotificationRepository,
  NotificationRepositoryLive,
} from './notification-repository';

describe('NotificationRepository Integration Tests', () => {
  let mockDb: MockDatabaseService;
  let testLayer: Layer.Layer<NotificationRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDatabaseService();

    const DatabaseLayer = Layer.succeed(Database, mockDb as unknown as never);
    testLayer = NotificationRepositoryLive.pipe(Layer.provide(DatabaseLayer));
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getNotifications', () => {
    it('should return notifications with unread count', async () => {
      const mockNotifications = [
        { ...createMockNotification(), actor: createMockUser() },
        { ...createMockNotification({ id: 'n2', read: true }), actor: createMockUser() },
      ];

      mockDb.db.query.notifications.findMany.mockResolvedValueOnce(mockNotifications);
      mockDb.db.where.mockResolvedValueOnce([{ count: 1 }]);

      const program = Effect.gen(function* () {
        const repo = yield* NotificationRepository;
        return yield* repo.getNotifications('user-123');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.data).toHaveLength(2);
      expect(result.unreadCount).toBe(1);
    });

    it('should use default pagination', async () => {
      mockDb.db.query.notifications.findMany.mockResolvedValueOnce([]);
      mockDb.db.where.mockResolvedValueOnce([{ count: 0 }]);

      const program = Effect.gen(function* () {
        const repo = yield* NotificationRepository;
        return yield* repo.getNotifications('user-123');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.data).toHaveLength(0);
      expect(result.unreadCount).toBe(0);
    });

    it('should handle custom pagination', async () => {
      mockDb.db.query.notifications.findMany.mockResolvedValueOnce([]);
      mockDb.db.where.mockResolvedValueOnce([{ count: 0 }]);

      const program = Effect.gen(function* () {
        const repo = yield* NotificationRepository;
        return yield* repo.getNotifications('user-123', 2, 10);
      });

      await Effect.runPromise(Effect.provide(program, testLayer));

      expect(mockDb.db.query.notifications.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 10, // (page - 1) * limit = (2 - 1) * 10
        }),
      );
    });

    it('should handle database errors', async () => {
      mockDb.db.query.notifications.findMany.mockRejectedValueOnce(new Error('Connection failed'));

      const program = Effect.gen(function* () {
        const repo = yield* NotificationRepository;
        return yield* repo.getNotifications('user-123');
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(exit)).toBe(true);
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread notification count', async () => {
      mockDb.db.where.mockResolvedValueOnce([{ count: 5 }]);

      const program = Effect.gen(function* () {
        const repo = yield* NotificationRepository;
        return yield* repo.getUnreadCount('user-123');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result).toBe(5);
    });

    it('should return 0 when no unread notifications', async () => {
      mockDb.db.where.mockResolvedValueOnce([{ count: 0 }]);

      const program = Effect.gen(function* () {
        const repo = yield* NotificationRepository;
        return yield* repo.getUnreadCount('user-123');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result).toBe(0);
    });

    it('should return 0 when result is null', async () => {
      mockDb.db.where.mockResolvedValueOnce([]);

      const program = Effect.gen(function* () {
        const repo = yield* NotificationRepository;
        return yield* repo.getUnreadCount('user-123');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result).toBe(0);
    });
  });

  describe('createNotification', () => {
    it('should create a notification', async () => {
      const input: CreateNotificationInput = {
        userId: 'user-123',
        type: 'comment_reply',
        title: 'New reply',
        body: 'Someone replied to your comment',
      };

      const createdNotification = {
        id: 'notification-new',
        ...input,
        read: false,
        createdAt: new Date(),
      };

      mockDb.db.returning.mockResolvedValueOnce([createdNotification]);

      const program = Effect.gen(function* () {
        const repo = yield* NotificationRepository;
        return yield* repo.createNotification(input);
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.id).toBe('notification-new');
      expect(result.type).toBe('comment_reply');
      expect(mockDb.db.insert).toHaveBeenCalled();
    });

    it('should create notification with optional fields', async () => {
      const input: CreateNotificationInput = {
        userId: 'user-123',
        type: 'video_shared',
        title: 'Video shared with you',
        resourceType: 'video',
        resourceId: 'video-123',
        actorId: 'actor-456',
      };

      const createdNotification = { id: 'n1', ...input };
      mockDb.db.returning.mockResolvedValueOnce([createdNotification]);

      const program = Effect.gen(function* () {
        const repo = yield* NotificationRepository;
        return yield* repo.createNotification(input);
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.resourceType).toBe('video');
      expect(result.resourceId).toBe('video-123');
      expect(result.actorId).toBe('actor-456');
    });

    it('should handle creation errors', async () => {
      mockDb.db.returning.mockRejectedValueOnce(new Error('Insert failed'));

      const program = Effect.gen(function* () {
        const repo = yield* NotificationRepository;
        return yield* repo.createNotification({
          userId: 'user-123',
          type: 'comment_reply',
          title: 'Test',
        });
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(exit)).toBe(true);
    });
  });

  describe('notifyCommentReply', () => {
    it('should create notification for comment reply', async () => {
      const parentComment = {
        id: 'parent-123',
        authorId: 'parent-author',
        author: createMockUser({ id: 'parent-author' }),
      };
      const actor = createMockUser({ id: 'replier', name: 'Replier User' });

      mockDb.db.query.comments.findFirst.mockResolvedValueOnce(parentComment);
      mockDb.db.query.users.findFirst.mockResolvedValueOnce(actor);
      mockDb.db.returning.mockResolvedValueOnce([
        {
          id: 'notification-123',
          type: 'comment_reply',
          userId: 'parent-author',
          actorId: 'replier',
        },
      ]);

      const program = Effect.gen(function* () {
        const repo = yield* NotificationRepository;
        return yield* repo.notifyCommentReply('parent-123', 'reply-123', 'replier', 'video-123');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result).not.toBeNull();
      expect(result?.type).toBe('comment_reply');
    });

    it('should not notify when replying to own comment', async () => {
      const parentComment = {
        id: 'parent-123',
        authorId: 'same-user',
        author: createMockUser({ id: 'same-user' }),
      };

      mockDb.db.query.comments.findFirst.mockResolvedValueOnce(parentComment);

      const program = Effect.gen(function* () {
        const repo = yield* NotificationRepository;
        return yield* repo.notifyCommentReply('parent-123', 'reply-123', 'same-user', 'video-123');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result).toBeNull();
    });

    it('should return null when parent comment does not exist', async () => {
      mockDb.db.query.comments.findFirst.mockResolvedValueOnce(null);

      const program = Effect.gen(function* () {
        const repo = yield* NotificationRepository;
        return yield* repo.notifyCommentReply('nonexistent', 'reply-123', 'user-123', 'video-123');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result).toBeNull();
    });
  });

  describe('notifyNewCommentOnVideo', () => {
    it('should create notification for new comment on video', async () => {
      const video = {
        id: 'video-123',
        title: 'Test Video',
        authorId: 'video-owner',
      };
      const actor = createMockUser({ id: 'commenter', name: 'Commenter User' });

      mockDb.db.query.videos.findFirst.mockResolvedValueOnce(video);
      mockDb.db.query.users.findFirst.mockResolvedValueOnce(actor);
      mockDb.db.returning.mockResolvedValueOnce([
        {
          id: 'notification-123',
          type: 'new_comment_on_video',
          userId: 'video-owner',
        },
      ]);

      const program = Effect.gen(function* () {
        const repo = yield* NotificationRepository;
        return yield* repo.notifyNewCommentOnVideo('video-123', 'comment-123', 'commenter');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result).not.toBeNull();
      expect(result?.type).toBe('new_comment_on_video');
    });

    it('should not notify when commenting on own video', async () => {
      const video = {
        id: 'video-123',
        title: 'My Video',
        authorId: 'same-user',
      };

      mockDb.db.query.videos.findFirst.mockResolvedValueOnce(video);

      const program = Effect.gen(function* () {
        const repo = yield* NotificationRepository;
        return yield* repo.notifyNewCommentOnVideo('video-123', 'comment-123', 'same-user');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result).toBeNull();
    });

    it('should return null when video does not exist', async () => {
      mockDb.db.query.videos.findFirst.mockResolvedValueOnce(null);

      const program = Effect.gen(function* () {
        const repo = yield* NotificationRepository;
        return yield* repo.notifyNewCommentOnVideo('nonexistent', 'comment-123', 'user-123');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result).toBeNull();
    });

    it('should return null when video has no author', async () => {
      const video = {
        id: 'video-123',
        title: 'Orphaned Video',
        authorId: null,
      };

      mockDb.db.query.videos.findFirst.mockResolvedValueOnce(video);

      const program = Effect.gen(function* () {
        const repo = yield* NotificationRepository;
        return yield* repo.notifyNewCommentOnVideo('video-123', 'comment-123', 'user-123');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result).toBeNull();
    });
  });

  describe('markAsRead', () => {
    it('should mark a notification as read', async () => {
      const updatedNotification = {
        id: 'notification-123',
        userId: 'user-123',
        read: true,
      };

      mockDb.db.returning.mockResolvedValueOnce([updatedNotification]);

      const program = Effect.gen(function* () {
        const repo = yield* NotificationRepository;
        return yield* repo.markAsRead('notification-123', 'user-123');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.read).toBe(true);
      expect(mockDb.db.update).toHaveBeenCalled();
    });

    it('should fail with NotFoundError when notification does not exist', async () => {
      mockDb.db.returning.mockResolvedValueOnce([]);

      const program = Effect.gen(function* () {
        const repo = yield* NotificationRepository;
        return yield* repo.markAsRead('nonexistent', 'user-123');
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(exit)).toBe(true);
    });

    it('should fail when notification belongs to different user', async () => {
      mockDb.db.returning.mockResolvedValueOnce([]);

      const program = Effect.gen(function* () {
        const repo = yield* NotificationRepository;
        return yield* repo.markAsRead('notification-123', 'wrong-user');
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(exit)).toBe(true);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read', async () => {
      mockDb.db.returning.mockResolvedValueOnce([
        { id: 'n1', read: true },
        { id: 'n2', read: true },
        { id: 'n3', read: true },
      ]);

      const program = Effect.gen(function* () {
        const repo = yield* NotificationRepository;
        return yield* repo.markAllAsRead('user-123');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result).toBe(3);
    });

    it('should return 0 when no unread notifications', async () => {
      mockDb.db.returning.mockResolvedValueOnce([]);

      const program = Effect.gen(function* () {
        const repo = yield* NotificationRepository;
        return yield* repo.markAllAsRead('user-123');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result).toBe(0);
    });
  });

  describe('deleteNotification', () => {
    it('should delete a notification', async () => {
      mockDb.db.returning.mockResolvedValueOnce([{ id: 'notification-123' }]);

      const program = Effect.gen(function* () {
        const repo = yield* NotificationRepository;
        return yield* repo.deleteNotification('notification-123', 'user-123');
      });

      await Effect.runPromise(Effect.provide(program, testLayer));

      expect(mockDb.db.delete).toHaveBeenCalled();
    });

    it('should fail with NotFoundError when notification does not exist', async () => {
      mockDb.db.returning.mockResolvedValueOnce([]);

      const program = Effect.gen(function* () {
        const repo = yield* NotificationRepository;
        return yield* repo.deleteNotification('nonexistent', 'user-123');
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(exit)).toBe(true);
    });

    it('should fail when notification belongs to different user', async () => {
      mockDb.db.returning.mockResolvedValueOnce([]);

      const program = Effect.gen(function* () {
        const repo = yield* NotificationRepository;
        return yield* repo.deleteNotification('notification-123', 'wrong-user');
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(exit)).toBe(true);
    });
  });
});
