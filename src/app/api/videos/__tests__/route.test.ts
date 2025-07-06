import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";

// Mock the auth module
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

// Mock the videos API
vi.mock("@/lib/api/videos", () => ({
  getVideos: vi.fn(),
  createVideo: vi.fn(),
}));

describe("/api/videos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/videos", () => {
    it("should return 401 when user is not authenticated", async () => {
      const { auth } = await import("@/lib/auth");
      auth.api.getSession = vi.fn().mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/videos?organizationId=org-1");
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Unauthorized");
    });

    it("should return 400 when organizationId is missing", async () => {
      const { auth } = await import("@/lib/auth");
      auth.api.getSession = vi.fn().mockResolvedValue({ user: { id: "user-1" } });

      const request = new NextRequest("http://localhost:3000/api/videos");
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Organization ID is required");
    });

    it("should return videos when authenticated with organizationId", async () => {
      const { auth } = await import("@/lib/auth");
      const { getVideos } = await import("@/lib/api/videos");

      auth.api.getSession = vi.fn().mockResolvedValue({ user: { id: "user-1" } });
      vi.mocked(getVideos).mockResolvedValue({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      const request = new NextRequest("http://localhost:3000/api/videos?organizationId=org-1");
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(getVideos).toHaveBeenCalledWith("org-1", 1, 20);
    });

    it("should handle pagination parameters", async () => {
      const { auth } = await import("@/lib/auth");
      const { getVideos } = await import("@/lib/api/videos");

      auth.api.getSession = vi.fn().mockResolvedValue({ user: { id: "user-1" } });
      vi.mocked(getVideos).mockResolvedValue({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      const request = new NextRequest("http://localhost:3000/api/videos?organizationId=org-1&page=2&limit=10");
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(getVideos).toHaveBeenCalledWith("org-1", 2, 10);
    });

    it("should handle errors gracefully", async () => {
      const { auth } = await import("@/lib/auth");
      const { getVideos } = await import("@/lib/api/videos");

      auth.api.getSession = vi.fn().mockResolvedValue({ user: { id: "user-1" } });
      vi.mocked(getVideos).mockRejectedValue(new Error("Database error"));

      const request = new NextRequest("http://localhost:3000/api/videos?organizationId=org-1");
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Internal server error");
    });
  });

  describe("POST /api/videos", () => {
    it("should return 401 when user is not authenticated", async () => {
      const { auth } = await import("@/lib/auth");
      auth.api.getSession = vi.fn().mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/videos", {
        method: "POST",
        body: JSON.stringify({
          title: "Test Video",
          duration: "10:30",
          organizationId: "org-1",
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Unauthorized");
    });

    it("should return 400 when required fields are missing", async () => {
      const { auth } = await import("@/lib/auth");
      auth.api.getSession = vi.fn().mockResolvedValue({ user: { id: "user-1" } });

      const request = new NextRequest("http://localhost:3000/api/videos", {
        method: "POST",
        body: JSON.stringify({
          title: "Test Video",
          // Missing duration and organizationId
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Title, duration, and organization ID are required");
    });

    it("should create video successfully with valid data", async () => {
      const { auth } = await import("@/lib/auth");
      const { createVideo } = await import("@/lib/api/videos");

      const mockVideo = {
        id: "video-1",
        title: "Test Video",
        description: "Test description",
        duration: "10:30",
        thumbnailUrl: null,
        videoUrl: null,
        organizationId: "org-1",
        authorId: "user-1",
        channelId: null,
        collectionId: null,
        transcript: null,
        aiSummary: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      auth.api.getSession = vi.fn().mockResolvedValue({ user: { id: "user-1" } });
      vi.mocked(createVideo).mockResolvedValue(mockVideo);

      const request = new NextRequest("http://localhost:3000/api/videos", {
        method: "POST",
        body: JSON.stringify({
          title: "Test Video",
          description: "Test description",
          duration: "10:30",
          organizationId: "org-1",
          channelId: "channel-1",
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(createVideo).toHaveBeenCalledWith({
        title: "Test Video",
        description: "Test description",
        duration: "10:30",
        thumbnailUrl: undefined,
        videoUrl: undefined,
        authorId: "user-1",
        organizationId: "org-1",
        channelId: "channel-1",
        collectionId: undefined,
        transcript: undefined,
        aiSummary: undefined,
      });

      const data = await response.json();
      expect(data).toMatchObject({
        id: mockVideo.id,
        title: mockVideo.title,
        description: mockVideo.description,
        duration: mockVideo.duration,
        organizationId: mockVideo.organizationId,
        authorId: mockVideo.authorId,
      });
    });

    it("should handle errors gracefully", async () => {
      const { auth } = await import("@/lib/auth");
      const { createVideo } = await import("@/lib/api/videos");

      auth.api.getSession = vi.fn().mockResolvedValue({ user: { id: "user-1" } });
      vi.mocked(createVideo).mockRejectedValue(new Error("Database error"));

      const request = new NextRequest("http://localhost:3000/api/videos", {
        method: "POST",
        body: JSON.stringify({
          title: "Test Video",
          duration: "10:30",
          organizationId: "org-1",
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Internal server error");
    });
  });
});
