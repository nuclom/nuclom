import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CommentWithAuthor, CommentWithReplies } from "@/lib/effect/services/comment-repository";
import { useRealtimeComments } from "./use-realtime-comments";

// Mock EventSource
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  listeners: Record<string, ((event: MessageEvent | Event) => void)[]> = {};
  readyState = 0;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent | Event) => void) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: (event: MessageEvent | Event) => void) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter((l) => l !== listener);
    }
  }

  emit(type: string, data?: unknown) {
    if (this.listeners[type]) {
      const event = data ? new MessageEvent(type, { data: JSON.stringify(data) }) : new Event(type);
      for (const listener of this.listeners[type]) {
        listener(event);
      }
    }
  }

  triggerError() {
    this.readyState = 2;
    if (this.onerror) {
      this.onerror(new Event("error"));
    }
  }

  close() {
    this.readyState = 2;
  }

  static reset() {
    MockEventSource.instances = [];
  }
}

// Store original EventSource
const OriginalEventSource = global.EventSource;

describe("useRealtimeComments", () => {
  beforeEach(() => {
    MockEventSource.reset();
    // biome-ignore lint/suspicious/noExplicitAny: Test requires global EventSource mock
    (global as any).EventSource = MockEventSource;
  });

  afterEach(() => {
    // biome-ignore lint/suspicious/noExplicitAny: Test requires global EventSource mock
    (global as any).EventSource = OriginalEventSource;
    MockEventSource.reset();
  });

  // Create properly typed mock comment
  const mockComment = {
    id: "comment-1",
    content: "Test comment",
    author: { id: "user-1", name: "Test User" },
    videoId: "video-123",
    parentId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as CommentWithAuthor;

  const mockInitialComments = [
    {
      ...mockComment,
      replies: [],
    },
  ] as unknown as CommentWithReplies[];

  it("should initialize with initial comments", () => {
    const { result } = renderHook(() =>
      useRealtimeComments({
        videoId: "video-123",
        initialComments: mockInitialComments,
      }),
    );

    expect(result.current.comments).toEqual(mockInitialComments);
    expect(result.current.error).toBeNull();
  });

  it("should connect to SSE endpoint when enabled", () => {
    renderHook(() =>
      useRealtimeComments({
        videoId: "video-123",
        initialComments: [],
        enabled: true,
      }),
    );

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe("/api/videos/video-123/comments/stream");
  });

  it("should not connect when disabled", () => {
    renderHook(() =>
      useRealtimeComments({
        videoId: "video-123",
        initialComments: [],
        enabled: false,
      }),
    );

    expect(MockEventSource.instances).toHaveLength(0);
  });

  it("should set connected state on connected event", () => {
    const { result } = renderHook(() =>
      useRealtimeComments({
        videoId: "video-123",
        initialComments: [],
      }),
    );

    expect(result.current.isConnected).toBe(false);

    act(() => {
      MockEventSource.instances[0].emit("connected");
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("should add new comment from SSE event", () => {
    const { result } = renderHook(() =>
      useRealtimeComments({
        videoId: "video-123",
        initialComments: [],
      }),
    );

    act(() => {
      MockEventSource.instances[0].emit("connected");
    });

    const newComment = {
      type: "created",
      comment: mockComment,
    };

    act(() => {
      MockEventSource.instances[0].emit("comment", newComment);
    });

    expect(result.current.comments).toHaveLength(1);
    expect(result.current.comments[0].id).toBe("comment-1");
  });

  it("should not add duplicate comments", () => {
    const { result } = renderHook(() =>
      useRealtimeComments({
        videoId: "video-123",
        initialComments: mockInitialComments,
      }),
    );

    act(() => {
      MockEventSource.instances[0].emit("connected");
    });

    // Try to add same comment again
    const duplicateEvent = {
      type: "created",
      comment: mockComment,
    };

    act(() => {
      MockEventSource.instances[0].emit("comment", duplicateEvent);
    });

    expect(result.current.comments).toHaveLength(1);
  });

  it("should add reply to parent comment", () => {
    const { result } = renderHook(() =>
      useRealtimeComments({
        videoId: "video-123",
        initialComments: mockInitialComments,
      }),
    );

    act(() => {
      MockEventSource.instances[0].emit("connected");
    });

    const replyEvent = {
      type: "created",
      comment: {
        ...mockComment,
        id: "reply-1",
        parentId: "comment-1",
        content: "This is a reply",
      } as unknown as CommentWithAuthor,
    };

    act(() => {
      MockEventSource.instances[0].emit("comment", replyEvent);
    });

    expect(result.current.comments[0].replies).toHaveLength(1);
    expect(result.current.comments[0].replies?.[0].content).toBe("This is a reply");
  });

  it("should update comment content", () => {
    const { result } = renderHook(() =>
      useRealtimeComments({
        videoId: "video-123",
        initialComments: mockInitialComments,
      }),
    );

    act(() => {
      MockEventSource.instances[0].emit("connected");
    });

    const updateEvent = {
      type: "updated",
      comment: {
        ...mockComment,
        content: "Updated content",
      } as unknown as CommentWithAuthor,
    };

    act(() => {
      MockEventSource.instances[0].emit("comment", updateEvent);
    });

    expect(result.current.comments[0].content).toBe("Updated content");
  });

  it("should delete comment", () => {
    const { result } = renderHook(() =>
      useRealtimeComments({
        videoId: "video-123",
        initialComments: mockInitialComments,
      }),
    );

    act(() => {
      MockEventSource.instances[0].emit("connected");
    });

    const deleteEvent = {
      type: "deleted",
      comment: mockComment,
    };

    act(() => {
      MockEventSource.instances[0].emit("comment", deleteEvent);
    });

    expect(result.current.comments).toHaveLength(0);
  });

  it("should handle SSE error", () => {
    const { result } = renderHook(() =>
      useRealtimeComments({
        videoId: "video-123",
        initialComments: [],
      }),
    );

    act(() => {
      MockEventSource.instances[0].emit("connected");
    });

    expect(result.current.isConnected).toBe(true);

    act(() => {
      MockEventSource.instances[0].triggerError();
    });

    expect(result.current.isConnected).toBe(false);
  });

  it("should cleanup on unmount", () => {
    const { unmount } = renderHook(() =>
      useRealtimeComments({
        videoId: "video-123",
        initialComments: [],
      }),
    );

    const instance = MockEventSource.instances[0];
    expect(instance.readyState).not.toBe(2);

    unmount();

    expect(instance.readyState).toBe(2);
  });

  it("should add comment using addComment function", () => {
    const { result } = renderHook(() =>
      useRealtimeComments({
        videoId: "video-123",
        initialComments: [],
      }),
    );

    act(() => {
      result.current.addComment(mockComment);
    });

    expect(result.current.comments).toHaveLength(1);
    expect(result.current.comments[0].id).toBe("comment-1");
  });

  it("should update comment using updateComment function", () => {
    const { result } = renderHook(() =>
      useRealtimeComments({
        videoId: "video-123",
        initialComments: mockInitialComments,
      }),
    );

    act(() => {
      result.current.updateComment("comment-1", "Manually updated");
    });

    expect(result.current.comments[0].content).toBe("Manually updated");
  });

  it("should remove comment using removeComment function", () => {
    const { result } = renderHook(() =>
      useRealtimeComments({
        videoId: "video-123",
        initialComments: mockInitialComments,
      }),
    );

    act(() => {
      result.current.removeComment("comment-1");
    });

    expect(result.current.comments).toHaveLength(0);
  });

  it("should update comments when initialComments change", () => {
    const { result, rerender } = renderHook(
      ({ comments }) =>
        useRealtimeComments({
          videoId: "video-123",
          initialComments: comments,
        }),
      { initialProps: { comments: mockInitialComments } },
    );

    expect(result.current.comments).toHaveLength(1);

    const newComments = [
      ...mockInitialComments,
      { ...mockComment, id: "comment-2", content: "Second comment", replies: [] } as unknown as CommentWithReplies,
    ];

    rerender({ comments: newComments });

    expect(result.current.comments).toHaveLength(2);
  });

  it("should handle nested reply updates", () => {
    const commentsWithReplies = [
      {
        ...mockComment,
        replies: [
          {
            ...mockComment,
            id: "reply-1",
            parentId: "comment-1",
            content: "Reply content",
            replies: [],
          },
        ],
      },
    ] as unknown as CommentWithReplies[];

    const { result } = renderHook(() =>
      useRealtimeComments({
        videoId: "video-123",
        initialComments: commentsWithReplies,
      }),
    );

    act(() => {
      result.current.updateComment("reply-1", "Updated reply");
    });

    expect(result.current.comments[0].replies?.[0].content).toBe("Updated reply");
  });

  it("should handle nested reply deletion", () => {
    const commentsWithReplies = [
      {
        ...mockComment,
        replies: [
          {
            ...mockComment,
            id: "reply-1",
            parentId: "comment-1",
            content: "Reply content",
            replies: [],
          },
        ],
      },
    ] as unknown as CommentWithReplies[];

    const { result } = renderHook(() =>
      useRealtimeComments({
        videoId: "video-123",
        initialComments: commentsWithReplies,
      }),
    );

    act(() => {
      result.current.removeComment("reply-1");
    });

    expect(result.current.comments[0].replies).toHaveLength(0);
  });

  it("should handle malformed SSE event data", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() =>
      useRealtimeComments({
        videoId: "video-123",
        initialComments: [],
      }),
    );

    act(() => {
      MockEventSource.instances[0].emit("connected");
    });

    // Manually trigger with invalid JSON
    act(() => {
      const event = new MessageEvent("comment", { data: "invalid json" });
      MockEventSource.instances[0].listeners.comment?.[0](event);
    });

    // Should not crash, comments should remain unchanged
    expect(result.current.comments).toHaveLength(0);
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
