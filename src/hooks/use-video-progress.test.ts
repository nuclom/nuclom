import { act, renderHook, waitFor } from "@testing-library/react";
import { Either } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VideoProgress } from "@/components/video/video-player";
import { useProgressFraction, useVideoProgress } from "./use-video-progress";

// Mock the Effect client
vi.mock("@/lib/effect/client", () => ({
  runClientEffect: vi.fn(),
  videoProgressApiEffect: {
    getProgress: vi.fn(),
    saveProgress: vi.fn(),
  },
}));

import { runClientEffect, videoProgressApiEffect } from "@/lib/effect/client";

describe("useVideoProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockProgressData = {
    videoId: "video-123",
    userId: "user-123",
    currentTime: "120.5",
    completed: false,
    lastWatchedAt: "2024-01-01T00:00:00Z",
  };

  // Helper to create a full VideoProgress object
  const createMockProgress = (overrides: Partial<VideoProgress>): VideoProgress => ({
    currentTime: 0,
    duration: 300,
    played: 0,
    completed: false,
    ...overrides,
  });

  it("should start in loading state when enabled", async () => {
    vi.mocked(runClientEffect).mockResolvedValue(Either.right(null));

    const { result } = renderHook(() => useVideoProgress({ videoId: "video-123" }));

    expect(result.current.loading).toBe(true);
    expect(result.current.initialProgress).toBe(0);

    // Wait for async operation to complete to prevent memory leak
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("should not load when disabled", () => {
    const { result } = renderHook(() => useVideoProgress({ videoId: "video-123", enabled: false }));

    expect(result.current.loading).toBe(false);
    expect(videoProgressApiEffect.getProgress).not.toHaveBeenCalled();
  });

  it("should fetch initial progress", async () => {
    vi.mocked(runClientEffect).mockResolvedValue(Either.right(mockProgressData));

    const { result } = renderHook(() => useVideoProgress({ videoId: "video-123" }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(videoProgressApiEffect.getProgress).toHaveBeenCalledWith("video-123");
    expect(result.current.initialProgress).toBe(120.5);
    expect(result.current.wasCompleted).toBe(false);
  });

  it("should handle completed progress", async () => {
    vi.mocked(runClientEffect).mockResolvedValue(Either.right({ ...mockProgressData, completed: true }));

    const { result } = renderHook(() => useVideoProgress({ videoId: "video-123" }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.wasCompleted).toBe(true);
  });

  it("should handle 401 error silently", async () => {
    const mockError = { status: 401, message: "Unauthorized" };
    vi.mocked(runClientEffect).mockResolvedValue(Either.left(mockError));

    const { result } = renderHook(() => useVideoProgress({ videoId: "video-123" }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.initialProgress).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it("should handle other errors", async () => {
    const mockError = { status: 500, message: "Server error" };
    vi.mocked(runClientEffect).mockResolvedValue(Either.left(mockError));

    const { result } = renderHook(() => useVideoProgress({ videoId: "video-123" }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Server error");
  });

  it("should handle null progress response", async () => {
    vi.mocked(runClientEffect).mockResolvedValue(Either.right(null));

    const { result } = renderHook(() => useVideoProgress({ videoId: "video-123" }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.initialProgress).toBe(0);
    expect(result.current.wasCompleted).toBe(false);
  });

  it("should save immediately when completed", async () => {
    vi.mocked(runClientEffect).mockResolvedValue(Either.right(null));

    const { result } = renderHook(() => useVideoProgress({ videoId: "video-123", saveInterval: 5000 }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    vi.clearAllMocks();
    vi.mocked(runClientEffect).mockResolvedValue(Either.right(mockProgressData));

    await act(async () => {
      result.current.saveProgress(createMockProgress({ currentTime: 100, completed: true }));
    });

    // Should save immediately without waiting for debounce
    expect(videoProgressApiEffect.saveProgress).toHaveBeenCalledWith("video-123", {
      currentTime: 100,
      completed: true,
    });
  });

  it("should force save with saveProgressNow", async () => {
    vi.mocked(runClientEffect).mockResolvedValue(Either.right(null));

    const { result } = renderHook(() => useVideoProgress({ videoId: "video-123" }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    vi.clearAllMocks();
    vi.mocked(runClientEffect).mockResolvedValue(Either.right(mockProgressData));

    await act(async () => {
      await result.current.saveProgressNow(createMockProgress({ currentTime: 50, completed: false }));
    });

    expect(videoProgressApiEffect.saveProgress).toHaveBeenCalledWith("video-123", {
      currentTime: 50,
      completed: false,
    });
  });

  it("should mark video as completed", async () => {
    vi.mocked(runClientEffect).mockResolvedValue(Either.right(null));

    const { result } = renderHook(() => useVideoProgress({ videoId: "video-123" }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    vi.clearAllMocks();
    vi.mocked(runClientEffect).mockResolvedValue(Either.right({ ...mockProgressData, completed: true }));

    await act(async () => {
      await result.current.markCompleted();
    });

    expect(videoProgressApiEffect.saveProgress).toHaveBeenCalledWith("video-123", {
      currentTime: expect.any(Number),
      completed: true,
    });
    expect(result.current.wasCompleted).toBe(true);
  });

  it("should not save when disabled", async () => {
    vi.mocked(runClientEffect).mockResolvedValue(Either.right(null));

    const { result } = renderHook(() => useVideoProgress({ videoId: "video-123", enabled: false }));

    await act(async () => {
      result.current.saveProgress(createMockProgress({ currentTime: 10, completed: false }));
    });

    expect(videoProgressApiEffect.saveProgress).not.toHaveBeenCalled();
  });

  it("should handle save errors silently", async () => {
    vi.mocked(runClientEffect).mockResolvedValue(Either.right(null));

    const { result } = renderHook(() => useVideoProgress({ videoId: "video-123" }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    vi.clearAllMocks();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(runClientEffect).mockResolvedValue(Either.left({ message: "Save failed" }));

    await act(async () => {
      await result.current.saveProgressNow(createMockProgress({ currentTime: 100, completed: false }));
    });

    expect(consoleSpy).toHaveBeenCalledWith("Failed to save video progress:", "Save failed");
    consoleSpy.mockRestore();
  });
});

describe("useProgressFraction", () => {
  it("should calculate correct fraction", () => {
    expect(useProgressFraction(30, 100)).toBe(0.3);
    expect(useProgressFraction(50, 100)).toBe(0.5);
    expect(useProgressFraction(100, 100)).toBe(1);
  });

  it("should return 0 for null or zero duration", () => {
    expect(useProgressFraction(30, null)).toBe(0);
    expect(useProgressFraction(30, 0)).toBe(0);
    expect(useProgressFraction(30, -1)).toBe(0);
  });

  it("should clamp fraction between 0 and 1", () => {
    expect(useProgressFraction(150, 100)).toBe(1);
    expect(useProgressFraction(-10, 100)).toBe(0);
  });
});
