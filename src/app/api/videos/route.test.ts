import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSession, createMockVideo } from "@/test/mocks";

// Mock Effect-TS and services
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock("@/lib/effect", () => ({
  AppLive: {},
  MissingFieldError: class MissingFieldError extends Error {
    _tag = "MissingFieldError";
    field: string;
    constructor({ field, message }: { field: string; message: string }) {
      super(message);
      this.field = field;
    }
  },
  VideoRepository: {
    _tag: "VideoRepository",
  },
}));

vi.mock("@/lib/effect/services/auth", () => ({
  Auth: {
    _tag: "Auth",
  },
  makeAuthLayer: vi.fn().mockReturnValue({}),
}));

vi.mock("effect", async (importOriginal) => {
  const actual = await importOriginal<typeof import("effect")>();
  const mockGetVideos = vi.fn();
  const mockCreateVideo = vi.fn();

  return {
    ...actual,
    Effect: {
      ...actual.Effect,
      gen: vi.fn((fn) => ({
        _fn: fn,
        _mockGetVideos: mockGetVideos,
        _mockCreateVideo: mockCreateVideo,
      })),
      tryPromise: vi.fn(({ try: tryFn }) => tryFn()),
      fail: vi.fn((error) => ({ _tag: "Fail", error })),
      provide: vi.fn((effect, _layer) => effect),
      runPromiseExit: vi.fn(),
    },
    Exit: {
      ...actual.Exit,
      succeed: vi.fn((value) => ({ _tag: "Success", value })),
      fail: vi.fn((error) => ({ _tag: "Failure", cause: { _tag: "Fail", error } })),
      match: vi.fn((exit, { onSuccess, onFailure }) => {
        if (exit._tag === "Success") {
          return onSuccess(exit.value);
        }
        return onFailure(exit.cause);
      }),
    },
    Option: {
      ...actual.Option,
      some: vi.fn((value) => ({ _tag: "Some", value })),
      none: vi.fn(() => ({ _tag: "None" })),
    },
    Data: {
      ...actual.Data,
      TaggedError: vi.fn((tag) => {
        return class extends Error {
          _tag = tag;
        };
      }),
    },
    Cause: {
      ...actual.Cause,
      failureOption: vi.fn((cause) => cause),
    },
    Layer: {
      ...actual.Layer,
      merge: vi.fn((_a, _b) => ({})),
    },
  };
});

import { Cause, Effect, Exit, Option } from "effect";
import { GET, POST } from "./route";

describe("Videos API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("GET /api/videos", () => {
    it("should return 400 when organizationId is missing", async () => {
      const _mockSession = createMockSession();

      vi.mocked(Effect.runPromiseExit).mockResolvedValueOnce(
        Exit.fail({
          _tag: "MissingFieldError",
          message: "Organization ID is required",
        }),
      );

      vi.mocked(Cause.failureOption).mockReturnValueOnce(
        Option.some({
          _tag: "MissingFieldError",
          message: "Organization ID is required",
        }),
      );

      const request = new NextRequest("http://localhost:3000/api/videos", {
        method: "GET",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Organization ID is required");
    });

    it("should return 401 when user is not authenticated", async () => {
      vi.mocked(Effect.runPromiseExit).mockResolvedValueOnce(
        Exit.fail({
          _tag: "UnauthorizedError",
          message: "Unauthorized",
        }),
      );

      vi.mocked(Cause.failureOption).mockReturnValueOnce(
        Option.some({
          _tag: "UnauthorizedError",
          message: "Unauthorized",
        }),
      );

      const request = new NextRequest("http://localhost:3000/api/videos?organizationId=org-123", {
        method: "GET",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should return paginated videos on success", async () => {
      const mockVideos = {
        data: [createMockVideo()],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      };

      vi.mocked(Effect.runPromiseExit).mockResolvedValueOnce(Exit.succeed(mockVideos));

      vi.mocked(Exit.match).mockImplementationOnce((_exit, { onSuccess }) => onSuccess(mockVideos));

      const request = new NextRequest("http://localhost:3000/api/videos?organizationId=org-123", {
        method: "GET",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(1);
      expect(data.pagination.page).toBe(1);
    });
  });

  describe("POST /api/videos", () => {
    it("should return 400 when title is missing", async () => {
      vi.mocked(Effect.runPromiseExit).mockResolvedValueOnce(
        Exit.fail({
          _tag: "MissingFieldError",
          message: "Title is required",
        }),
      );

      vi.mocked(Cause.failureOption).mockReturnValueOnce(
        Option.some({
          _tag: "MissingFieldError",
          message: "Title is required",
        }),
      );

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
      expect(data.error).toBe("Title is required");
    });

    it("should return 400 when duration is missing", async () => {
      vi.mocked(Effect.runPromiseExit).mockResolvedValueOnce(
        Exit.fail({
          _tag: "MissingFieldError",
          message: "Duration is required",
        }),
      );

      vi.mocked(Cause.failureOption).mockReturnValueOnce(
        Option.some({
          _tag: "MissingFieldError",
          message: "Duration is required",
        }),
      );

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
      expect(data.error).toBe("Duration is required");
    });

    it("should return 401 when user is not authenticated", async () => {
      vi.mocked(Effect.runPromiseExit).mockResolvedValueOnce(
        Exit.fail({
          _tag: "UnauthorizedError",
          message: "Unauthorized",
        }),
      );

      vi.mocked(Cause.failureOption).mockReturnValueOnce(
        Option.some({
          _tag: "UnauthorizedError",
          message: "Unauthorized",
        }),
      );

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
      expect(data.error).toBe("Unauthorized");
    });

    it("should create video and return 201 on success", async () => {
      const newVideo = createMockVideo();

      vi.mocked(Effect.runPromiseExit).mockResolvedValueOnce(Exit.succeed(newVideo));

      vi.mocked(Exit.match).mockImplementationOnce((_exit, { onSuccess }) => onSuccess(newVideo));

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
    });
  });
});
