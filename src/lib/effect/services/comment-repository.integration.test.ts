/**
 * CommentRepository Integration Tests
 *
 * Tests the CommentRepository service using Effect-TS dependency injection
 * to mock the Database service.
 */

import { Effect, Exit, Layer } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMockCommentWithAuthor,
  createMockDatabaseService,
  type MockDatabaseService,
} from "@/test/effect-test-utils";
import {
  CommentRepository,
  CommentRepositoryLive,
  type CreateCommentInput,
  type UpdateCommentInput,
} from "./comment-repository";
import { Database } from "./database";

describe("CommentRepository Integration Tests", () => {
  let mockDb: MockDatabaseService;
  let testLayer: Layer.Layer<CommentRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDatabaseService();

    const DatabaseLayer = Layer.succeed(Database, mockDb as unknown as never);
    testLayer = CommentRepositoryLive.pipe(Layer.provide(DatabaseLayer));
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("getComments", () => {
    it("should return threaded comments for a video", async () => {
      const parentComment = createMockCommentWithAuthor({ id: "comment-1", parentId: null });
      const replyComment = createMockCommentWithAuthor({ id: "comment-2", parentId: "comment-1" });

      mockDb.db.orderBy.mockResolvedValueOnce([parentComment, replyComment]);

      const program = Effect.gen(function* () {
        const repo = yield* CommentRepository;
        return yield* repo.getComments("video-123");
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result).toHaveLength(1); // Only top-level comments
      expect(result[0].id).toBe("comment-1");
      expect(result[0].replies).toHaveLength(1);
      expect(result[0].replies[0].id).toBe("comment-2");
    });

    it("should return empty array when no comments exist", async () => {
      mockDb.db.orderBy.mockResolvedValueOnce([]);

      const program = Effect.gen(function* () {
        const repo = yield* CommentRepository;
        return yield* repo.getComments("video-123");
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result).toHaveLength(0);
    });

    it("should handle nested replies correctly", async () => {
      const grandparent = createMockCommentWithAuthor({ id: "c1", parentId: null });
      const parent = createMockCommentWithAuthor({ id: "c2", parentId: "c1" });
      const child = createMockCommentWithAuthor({ id: "c3", parentId: "c2" });

      mockDb.db.orderBy.mockResolvedValueOnce([grandparent, parent, child]);

      const program = Effect.gen(function* () {
        const repo = yield* CommentRepository;
        return yield* repo.getComments("video-123");
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result).toHaveLength(1);
      expect((result[0] as unknown as { replies: unknown[] }).replies).toHaveLength(1);
      expect((result[0] as unknown as { replies: { replies: unknown[] }[] }).replies[0].replies).toHaveLength(1);
    });

    it("should handle database errors", async () => {
      mockDb.db.orderBy.mockRejectedValueOnce(new Error("Database connection failed"));

      const program = Effect.gen(function* () {
        const repo = yield* CommentRepository;
        return yield* repo.getComments("video-123");
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(exit)).toBe(true);
    });
  });

  describe("getComment", () => {
    it("should return a single comment with author", async () => {
      const comment = createMockCommentWithAuthor({ id: "comment-123" });

      mockDb.db.limit.mockResolvedValueOnce([comment]);

      const program = Effect.gen(function* () {
        const repo = yield* CommentRepository;
        return yield* repo.getComment("comment-123");
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.id).toBe("comment-123");
      expect(result.author).toBeDefined();
    });

    it("should fail with NotFoundError when comment does not exist", async () => {
      mockDb.db.limit.mockResolvedValueOnce([]);

      const program = Effect.gen(function* () {
        const repo = yield* CommentRepository;
        return yield* repo.getComment("nonexistent");
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(exit)).toBe(true);
    });
  });

  describe("createComment", () => {
    it("should create a new comment", async () => {
      const input: CreateCommentInput = {
        content: "This is a new comment",
        timestamp: "00:01:30",
        authorId: "user-123",
        videoId: "video-123",
      };

      const createdComment = { id: "new-comment-123", ...input };

      // Mock video exists check
      mockDb.db.limit.mockResolvedValueOnce([{ id: "video-123" }]);
      // Mock insert
      mockDb.db.returning.mockResolvedValueOnce([createdComment]);
      // Mock getComment for return
      mockDb.db.limit.mockResolvedValueOnce([createMockCommentWithAuthor({ ...createdComment })]);

      const program = Effect.gen(function* () {
        const repo = yield* CommentRepository;
        return yield* repo.createComment(input);
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.id).toBe("new-comment-123");
      expect(result.content).toBe("This is a new comment");
    });

    it("should fail when video does not exist", async () => {
      const input: CreateCommentInput = {
        content: "Comment on nonexistent video",
        authorId: "user-123",
        videoId: "nonexistent-video",
      };

      mockDb.db.limit.mockResolvedValueOnce([]); // Video not found

      const program = Effect.gen(function* () {
        const repo = yield* CommentRepository;
        return yield* repo.createComment(input);
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(exit)).toBe(true);
    });

    it("should create a reply to an existing comment", async () => {
      const input: CreateCommentInput = {
        content: "This is a reply",
        authorId: "user-123",
        videoId: "video-123",
        parentId: "parent-comment-123",
      };

      const createdReply = { id: "reply-123", ...input };

      // Mock video exists
      mockDb.db.limit.mockResolvedValueOnce([{ id: "video-123" }]);
      // Mock parent comment exists
      mockDb.db.limit.mockResolvedValueOnce([{ id: "parent-comment-123" }]);
      // Mock insert
      mockDb.db.returning.mockResolvedValueOnce([createdReply]);
      // Mock getComment for return
      mockDb.db.limit.mockResolvedValueOnce([createMockCommentWithAuthor({ ...createdReply })]);

      const program = Effect.gen(function* () {
        const repo = yield* CommentRepository;
        return yield* repo.createComment(input);
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.id).toBe("reply-123");
      expect(result.parentId).toBe("parent-comment-123");
    });

    it("should fail when parent comment does not exist", async () => {
      const input: CreateCommentInput = {
        content: "Reply to nonexistent parent",
        authorId: "user-123",
        videoId: "video-123",
        parentId: "nonexistent-parent",
      };

      mockDb.db.limit.mockResolvedValueOnce([{ id: "video-123" }]); // Video exists
      mockDb.db.limit.mockResolvedValueOnce([]); // Parent not found

      const program = Effect.gen(function* () {
        const repo = yield* CommentRepository;
        return yield* repo.createComment(input);
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(exit)).toBe(true);
    });
  });

  describe("updateComment", () => {
    it("should update a comment when user is the author", async () => {
      const existingComment = createMockCommentWithAuthor({
        id: "comment-123",
        authorId: "user-123",
        content: "Original content",
      });

      const updateData: UpdateCommentInput = {
        content: "Updated content",
      };

      // Mock getComment
      mockDb.db.limit.mockResolvedValueOnce([existingComment]);
      // Mock update
      mockDb.db.returning.mockResolvedValueOnce([{ ...existingComment, ...updateData }]);
      // Mock getComment for return
      mockDb.db.limit.mockResolvedValueOnce([{ ...existingComment, ...updateData }]);

      const program = Effect.gen(function* () {
        const repo = yield* CommentRepository;
        return yield* repo.updateComment("comment-123", "user-123", updateData);
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.content).toBe("Updated content");
    });

    it("should fail with ForbiddenError when user is not the author", async () => {
      const existingComment = createMockCommentWithAuthor({
        id: "comment-123",
        authorId: "other-user",
      });

      mockDb.db.limit.mockResolvedValueOnce([existingComment]);

      const program = Effect.gen(function* () {
        const repo = yield* CommentRepository;
        return yield* repo.updateComment("comment-123", "user-123", { content: "Hacked!" });
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(exit)).toBe(true);
    });

    it("should fail with NotFoundError when comment does not exist", async () => {
      mockDb.db.limit.mockResolvedValueOnce([]);

      const program = Effect.gen(function* () {
        const repo = yield* CommentRepository;
        return yield* repo.updateComment("nonexistent", "user-123", { content: "Update" });
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(exit)).toBe(true);
    });
  });

  describe("deleteComment", () => {
    it("should fail with NotFoundError when comment does not exist", async () => {
      mockDb.db.limit.mockResolvedValueOnce([]);

      const program = Effect.gen(function* () {
        const repo = yield* CommentRepository;
        return yield* repo.deleteComment("nonexistent", "user-123");
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(exit)).toBe(true);
    });

    it("should fail with ForbiddenError when user is neither author nor video owner", async () => {
      const existingComment = createMockCommentWithAuthor({
        id: "comment-123",
        authorId: "comment-author",
        videoId: "video-123",
      });

      // Mock getComment
      mockDb.db.limit.mockResolvedValueOnce([existingComment]);
      // Mock video owner check - different user
      mockDb.db.limit.mockResolvedValueOnce([{ authorId: "video-owner" }]);

      const program = Effect.gen(function* () {
        const repo = yield* CommentRepository;
        return yield* repo.deleteComment("comment-123", "random-user");
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(exit)).toBe(true);
    });

    it("should handle database errors when fetching comment", async () => {
      mockDb.db.limit.mockRejectedValueOnce(new Error("Database connection lost"));

      const program = Effect.gen(function* () {
        const repo = yield* CommentRepository;
        return yield* repo.deleteComment("comment-123", "user-123");
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(exit)).toBe(true);
    });
  });

  describe("getCommentsByTimestamp", () => {
    it("should return comments within a timestamp range", async () => {
      const comments = [
        createMockCommentWithAuthor({ id: "c1", timestamp: "00:01:00" }),
        createMockCommentWithAuthor({ id: "c2", timestamp: "00:02:00" }),
        createMockCommentWithAuthor({ id: "c3", timestamp: "00:03:00" }),
      ];

      mockDb.db.orderBy.mockResolvedValueOnce(comments);

      const program = Effect.gen(function* () {
        const repo = yield* CommentRepository;
        return yield* repo.getCommentsByTimestamp("video-123", "00:01:00", "00:02:30");
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      // Should filter to only comments within range
      expect(result.length).toBeLessThanOrEqual(3);
    });

    it("should return empty array when no comments in range", async () => {
      const comments = [createMockCommentWithAuthor({ id: "c1", timestamp: "00:10:00" })];

      mockDb.db.orderBy.mockResolvedValueOnce(comments);

      const program = Effect.gen(function* () {
        const repo = yield* CommentRepository;
        return yield* repo.getCommentsByTimestamp("video-123", "00:01:00", "00:02:00");
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result).toHaveLength(0);
    });

    it("should exclude comments without timestamps", async () => {
      const comments = [
        createMockCommentWithAuthor({ id: "c1", timestamp: null }),
        createMockCommentWithAuthor({ id: "c2", timestamp: "00:01:30" }),
      ];

      mockDb.db.orderBy.mockResolvedValueOnce(comments);

      const program = Effect.gen(function* () {
        const repo = yield* CommentRepository;
        return yield* repo.getCommentsByTimestamp("video-123", "00:01:00", "00:02:00");
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.every((c) => c.timestamp !== null)).toBe(true);
    });
  });
});
