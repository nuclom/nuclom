import { Effect, Layer } from "effect";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UnauthorizedError } from "@/lib/effect/errors";
import { Auth, type AuthServiceInterface } from "@/lib/effect/services/auth";
import { VideoRepository, type VideoRepositoryService } from "@/lib/effect/services/video-repository";
import { createMockSession, createMockVideo } from "@/test/mocks";

// Mock the api-handler module to provide test layers
vi.mock("@/lib/api-handler", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-handler")>();
  return {
    ...actual,
    createFullLayer: vi.fn(),
  };
});

import { createFullLayer } from "@/lib/api-handler";
import { GET, POST } from "./route";

describe("Videos API Route", () => {
  // Helper to create a mock auth service
  const createMockAuthService = (authenticated = true): AuthServiceInterface => {
    const session = createMockSession();
    return {
      getSession: vi
        .fn()
        .mockImplementation(() =>
          authenticated ? Effect.succeed(session) : Effect.fail(new UnauthorizedError({ message: "Unauthorized" })),
        ),
      getSessionOption: vi
        .fn()
        .mockImplementation(() =>
          authenticated
            ? Effect.succeed({ _tag: "Some" as const, value: session })
            : Effect.succeed({ _tag: "None" as const }),
        ),
      requireAuth: vi
        .fn()
        .mockImplementation(() =>
          authenticated ? Effect.succeed(session) : Effect.fail(new UnauthorizedError({ message: "Unauthorized" })),
        ),
      requireRole: vi
        .fn()
        .mockImplementation(() =>
          authenticated ? Effect.succeed(session) : Effect.fail(new UnauthorizedError({ message: "Unauthorized" })),
        ),
      requireAdmin: vi
        .fn()
        .mockImplementation(() =>
          authenticated ? Effect.succeed(session) : Effect.fail(new UnauthorizedError({ message: "Unauthorized" })),
        ),
    };
  };

  // Helper to create a mock video repository
  const createMockVideoRepository = (): VideoRepositoryService => {
    const mockVideo = createMockVideo();
    const paginatedResponse = {
      data: [mockVideo],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    };

    return {
      getVideos: vi.fn().mockImplementation(() => Effect.succeed(paginatedResponse)),
      getDeletedVideos: vi.fn().mockImplementation(() => Effect.succeed(paginatedResponse)),
      getVideo: vi.fn().mockImplementation(() => Effect.succeed(mockVideo)),
      createVideo: vi.fn().mockImplementation((data) => Effect.succeed({ ...mockVideo, ...data })),
      updateVideo: vi.fn().mockImplementation((id, data) => Effect.succeed({ ...mockVideo, id, ...data })),
      softDeleteVideo: vi.fn().mockImplementation((id) => Effect.succeed({ ...mockVideo, id, deletedAt: new Date() })),
      restoreVideo: vi.fn().mockImplementation((id) => Effect.succeed({ ...mockVideo, id, deletedAt: null })),
      deleteVideo: vi.fn().mockImplementation(() => Effect.void),
      cleanupExpiredVideos: vi.fn().mockImplementation(() => Effect.succeed(0)),
      getVideoChapters: vi.fn().mockImplementation(() => Effect.succeed([])),
      getVideoCodeSnippets: vi.fn().mockImplementation(() => Effect.succeed([])),
      searchVideos: vi.fn().mockImplementation(() => Effect.succeed(paginatedResponse)),
      getVideosByAuthor: vi.fn().mockImplementation(() => Effect.succeed(paginatedResponse)),
      getChannelVideosWithAuthor: vi.fn().mockImplementation(() => Effect.succeed(paginatedResponse)),
      getVideosSharedByOthers: vi.fn().mockImplementation(() => Effect.succeed(paginatedResponse)),
    };
  };

  // Setup test layer for each test
  const setupTestLayer = (options: { authenticated?: boolean; videoRepo?: Partial<VideoRepositoryService> } = {}) => {
    const { authenticated = true, videoRepo = {} } = options;
    const mockAuth = createMockAuthService(authenticated);
    const mockVideoRepo = { ...createMockVideoRepository(), ...videoRepo };

    const AuthLayer = Layer.succeed(Auth, mockAuth);
    const VideoRepoLayer = Layer.succeed(VideoRepository, mockVideoRepo as VideoRepositoryService);
    const testLayer = Layer.mergeAll(AuthLayer, VideoRepoLayer);

    vi.mocked(createFullLayer).mockReturnValue(testLayer as never);

    return { mockAuth, mockVideoRepo };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("GET /api/videos", () => {
    it("should return 400 when organizationId is missing", async () => {
      setupTestLayer();

      const request = new NextRequest("http://localhost:3000/api/videos", {
        method: "GET",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("VALIDATION_MISSING_FIELD");
    });

    it("should return 401 when user is not authenticated", async () => {
      setupTestLayer({ authenticated: false });

      const request = new NextRequest("http://localhost:3000/api/videos?organizationId=org-123", {
        method: "GET",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error.code).toBe("AUTH_UNAUTHORIZED");
      expect(data.error.message).toBe("Unauthorized");
    });

    it("should return paginated videos on success", async () => {
      const { mockVideoRepo } = setupTestLayer();

      const request = new NextRequest("http://localhost:3000/api/videos?organizationId=org-123", {
        method: "GET",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(1);
      expect(data.pagination.page).toBe(1);
      expect(mockVideoRepo.getVideos).toHaveBeenCalledWith("org-123", 1, 20);
    });
  });

  describe("POST /api/videos", () => {
    it("should return 400 when title is missing", async () => {
      setupTestLayer();

      const request = new NextRequest("http://localhost:3000/api/videos", {
        method: "POST",
        body: JSON.stringify({
          duration: "10:30",
          organizationId: "org-123",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("VALIDATION_MISSING_FIELD");
    });

    it("should return 400 when duration is missing", async () => {
      setupTestLayer();

      const request = new NextRequest("http://localhost:3000/api/videos", {
        method: "POST",
        body: JSON.stringify({
          title: "Test Video",
          organizationId: "org-123",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("VALIDATION_MISSING_FIELD");
    });

    it("should return 401 when user is not authenticated", async () => {
      setupTestLayer({ authenticated: false });

      const request = new NextRequest("http://localhost:3000/api/videos", {
        method: "POST",
        body: JSON.stringify({
          title: "Test Video",
          duration: "10:30",
          organizationId: "org-123",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error.code).toBe("AUTH_UNAUTHORIZED");
      expect(data.error.message).toBe("Unauthorized");
    });

    it("should create video and return 201 on success", async () => {
      const { mockVideoRepo } = setupTestLayer();

      const request = new NextRequest("http://localhost:3000/api/videos", {
        method: "POST",
        body: JSON.stringify({
          title: "Test Video",
          duration: "10:30",
          organizationId: "org-123",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBe("video-123");
      expect(data.title).toBe("Test Video");
      expect(mockVideoRepo.createVideo).toHaveBeenCalled();
    });
  });
});
