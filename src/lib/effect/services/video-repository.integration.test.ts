/**
 * VideoRepository Integration Tests
 *
 * Tests the VideoRepository service using Effect-TS dependency injection.
 * These tests focus on error handling scenarios that are easier to mock.
 */

import { Effect, Exit, Layer } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMockDatabaseService,
  createMockStorageService,
  createMockVideoWithFullAuthor,
  type MockDatabaseService,
  type MockStorageService,
} from "@/test/effect-test-utils";
import { createMockOrganization, createMockVideo } from "@/test/mocks";
import { DeleteError } from "../errors";
import { Database } from "./database";
import { Storage } from "./storage";
import {
  type CreateVideoInput,
  type UpdateVideoInput,
  VideoRepository,
  VideoRepositoryLive,
  type VideoSearchInput,
} from "./video-repository";

describe("VideoRepository Integration Tests", () => {
  let mockDb: MockDatabaseService;
  let mockStorage: MockStorageService;
  let testLayer: Layer.Layer<VideoRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDatabaseService();
    mockStorage = createMockStorageService();

    // Create the test layer with mocked dependencies
    const DatabaseLayer = Layer.succeed(Database, mockDb as unknown as never);
    const StorageLayer = Layer.succeed(Storage, mockStorage as unknown as never);
    const DepsLayer = Layer.mergeAll(DatabaseLayer, StorageLayer);
    testLayer = VideoRepositoryLive.pipe(Layer.provide(DepsLayer));
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("getVideos", () => {
    it("should handle database errors gracefully", async () => {
      mockDb.db.limit.mockRejectedValueOnce(new Error("Connection failed"));

      const program = Effect.gen(function* () {
        const repo = yield* VideoRepository;
        return yield* repo.getVideos("org-123");
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(exit)).toBe(true);
    });
  });

  describe("getVideo", () => {
    it("should fail with NotFoundError when video does not exist", async () => {
      mockDb.db.limit.mockResolvedValueOnce([]);

      const program = Effect.gen(function* () {
        const repo = yield* VideoRepository;
        return yield* repo.getVideo("nonexistent-id");
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(exit)).toBe(true);
    });

    it("should handle database errors", async () => {
      mockDb.db.limit.mockRejectedValueOnce(new Error("Query failed"));

      const program = Effect.gen(function* () {
        const repo = yield* VideoRepository;
        return yield* repo.getVideo("video-123");
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(exit)).toBe(true);
    });
  });

  describe("createVideo", () => {
    it("should create a new video", async () => {
      const input: CreateVideoInput = {
        title: "New Video",
        duration: "10:00",
        authorId: "user-123",
        organizationId: "org-123",
      };

      const createdVideo = { id: "new-video-123", ...input, createdAt: new Date() };
      mockDb.db.returning.mockResolvedValueOnce([createdVideo]);

      const program = Effect.gen(function* () {
        const repo = yield* VideoRepository;
        return yield* repo.createVideo(input);
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.id).toBe("new-video-123");
      expect(result.title).toBe("New Video");
      expect(mockDb.db.insert).toHaveBeenCalled();
    });

    it("should handle creation errors", async () => {
      const input: CreateVideoInput = {
        title: "New Video",
        duration: "10:00",
        authorId: "user-123",
        organizationId: "org-123",
      };

      mockDb.db.returning.mockRejectedValueOnce(new Error("Insert failed"));

      const program = Effect.gen(function* () {
        const repo = yield* VideoRepository;
        return yield* repo.createVideo(input);
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(exit)).toBe(true);
    });
  });

  describe("updateVideo", () => {
    it("should update an existing video", async () => {
      const updateData: UpdateVideoInput = {
        title: "Updated Title",
        description: "Updated description",
      };

      const updatedVideo = {
        id: "video-123",
        ...updateData,
        updatedAt: new Date(),
      };
      mockDb.db.returning.mockResolvedValueOnce([updatedVideo]);

      const program = Effect.gen(function* () {
        const repo = yield* VideoRepository;
        return yield* repo.updateVideo("video-123", updateData);
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.title).toBe("Updated Title");
      expect(mockDb.db.update).toHaveBeenCalled();
    });

    it("should fail with NotFoundError when video does not exist", async () => {
      mockDb.db.returning.mockResolvedValueOnce([]);

      const program = Effect.gen(function* () {
        const repo = yield* VideoRepository;
        return yield* repo.updateVideo("nonexistent", { title: "New Title" });
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(exit)).toBe(true);
    });
  });

  describe("softDeleteVideo", () => {
    it("should soft delete a video with default retention", async () => {
      const deletedVideo = {
        id: "video-123",
        deletedAt: new Date(),
        retentionUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };
      mockDb.db.returning.mockResolvedValueOnce([deletedVideo]);

      const program = Effect.gen(function* () {
        const repo = yield* VideoRepository;
        return yield* repo.softDeleteVideo("video-123");
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.deletedAt).toBeDefined();
      expect(result.retentionUntil).toBeDefined();
    });

    it("should fail with NotFoundError when video does not exist", async () => {
      mockDb.db.returning.mockResolvedValueOnce([]);

      const program = Effect.gen(function* () {
        const repo = yield* VideoRepository;
        return yield* repo.softDeleteVideo("nonexistent");
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(exit)).toBe(true);
    });
  });

  describe("restoreVideo", () => {
    it("should restore a soft-deleted video", async () => {
      const restoredVideo = {
        id: "video-123",
        deletedAt: null,
        retentionUntil: null,
      };
      mockDb.db.returning.mockResolvedValueOnce([restoredVideo]);

      const program = Effect.gen(function* () {
        const repo = yield* VideoRepository;
        return yield* repo.restoreVideo("video-123");
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.deletedAt).toBeNull();
      expect(result.retentionUntil).toBeNull();
    });

    it("should fail with NotFoundError when video does not exist", async () => {
      mockDb.db.returning.mockResolvedValueOnce([]);

      const program = Effect.gen(function* () {
        const repo = yield* VideoRepository;
        return yield* repo.restoreVideo("nonexistent");
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(exit)).toBe(true);
    });
  });

  describe("deleteVideo", () => {
    it("should fail with NotFoundError when video does not exist", async () => {
      mockDb.db.limit.mockResolvedValueOnce([]);

      const program = Effect.gen(function* () {
        const repo = yield* VideoRepository;
        return yield* repo.deleteVideo("nonexistent");
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(exit)).toBe(true);
    });
  });

  describe("cleanupExpiredVideos", () => {
    it("should return 0 when no expired videos exist", async () => {
      mockDb.db.where.mockResolvedValueOnce([]);

      const program = Effect.gen(function* () {
        const repo = yield* VideoRepository;
        return yield* repo.cleanupExpiredVideos();
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result).toBe(0);
    });

    it("should handle database errors", async () => {
      mockDb.db.where.mockRejectedValueOnce(new Error("Query failed"));

      const program = Effect.gen(function* () {
        const repo = yield* VideoRepository;
        return yield* repo.cleanupExpiredVideos();
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(exit)).toBe(true);
    });
  });

  describe("searchVideos", () => {
    it("should handle database errors in search", async () => {
      const searchInput: VideoSearchInput = {
        query: "test",
        organizationId: "org-123",
      };

      mockDb.db.limit.mockRejectedValueOnce(new Error("Search failed"));

      const program = Effect.gen(function* () {
        const repo = yield* VideoRepository;
        return yield* repo.searchVideos(searchInput);
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(exit)).toBe(true);
    });
  });

  describe("getVideosByAuthor", () => {
    it("should handle database errors", async () => {
      mockDb.db.limit.mockRejectedValueOnce(new Error("Query failed"));

      const program = Effect.gen(function* () {
        const repo = yield* VideoRepository;
        return yield* repo.getVideosByAuthor("author-123", "org-123");
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(exit)).toBe(true);
    });
  });

  describe("getVideoChapters", () => {
    it("should return chapters for a video", async () => {
      const chapters = [
        { id: "chapter-1", videoId: "video-123", title: "Introduction", startTime: 0 },
        { id: "chapter-2", videoId: "video-123", title: "Main Content", startTime: 60 },
      ];

      mockDb.db.orderBy.mockResolvedValueOnce(chapters);

      const program = Effect.gen(function* () {
        const repo = yield* VideoRepository;
        return yield* repo.getVideoChapters("video-123");
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe("Introduction");
    });

    it("should handle database errors", async () => {
      mockDb.db.orderBy.mockRejectedValueOnce(new Error("Query failed"));

      const program = Effect.gen(function* () {
        const repo = yield* VideoRepository;
        return yield* repo.getVideoChapters("video-123");
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(exit)).toBe(true);
    });
  });

  describe("getVideoCodeSnippets", () => {
    it("should return code snippets for a video", async () => {
      const snippets = [
        { id: "snippet-1", videoId: "video-123", language: "javascript", code: "console.log('hello')" },
      ];

      mockDb.db.orderBy.mockResolvedValueOnce(snippets);

      const program = Effect.gen(function* () {
        const repo = yield* VideoRepository;
        return yield* repo.getVideoCodeSnippets("video-123");
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result).toHaveLength(1);
      expect(result[0].language).toBe("javascript");
    });

    it("should handle database errors", async () => {
      mockDb.db.orderBy.mockRejectedValueOnce(new Error("Query failed"));

      const program = Effect.gen(function* () {
        const repo = yield* VideoRepository;
        return yield* repo.getVideoCodeSnippets("video-123");
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(exit)).toBe(true);
    });
  });
});
