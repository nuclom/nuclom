"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { CommentWithReplies, CommentWithAuthor, CommentEvent } from "@/lib/effect/services/comment-repository";

interface UseRealtimeCommentsOptions {
  videoId: string;
  initialComments: CommentWithReplies[];
  enabled?: boolean;
}

interface UseRealtimeCommentsReturn {
  comments: CommentWithReplies[];
  isConnected: boolean;
  error: Error | null;
  addComment: (comment: CommentWithAuthor) => void;
  updateComment: (commentId: string, content: string) => void;
  removeComment: (commentId: string) => void;
}

export function useRealtimeComments({
  videoId,
  initialComments,
  enabled = true,
}: UseRealtimeCommentsOptions): UseRealtimeCommentsReturn {
  const [comments, setComments] = useState<CommentWithReplies[]>(initialComments);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);

  // Update comments when initialComments change (e.g., from server refresh)
  useEffect(() => {
    setComments(initialComments);
  }, [initialComments]);

  // Add a new comment to the list
  const addComment = useCallback((newComment: CommentWithAuthor) => {
    setComments((prev) => {
      if (newComment.parentId) {
        // Add as reply to parent comment
        return prev.map((comment) => {
          if (comment.id === newComment.parentId) {
            return {
              ...comment,
              replies: [...(comment.replies || []), { ...newComment, replies: [] }],
            };
          }
          // Check nested replies
          if (comment.replies?.some((reply) => reply.id === newComment.parentId)) {
            return {
              ...comment,
              replies: comment.replies.map((reply) =>
                reply.id === newComment.parentId
                  ? {
                      ...reply,
                      replies: [...((reply as CommentWithReplies).replies || []), { ...newComment, replies: [] }],
                    }
                  : reply,
              ),
            };
          }
          return comment;
        });
      } else {
        // Add as top-level comment
        // Check if comment already exists
        if (prev.some((c) => c.id === newComment.id)) {
          return prev;
        }
        return [...prev, { ...newComment, replies: [] }];
      }
    });
  }, []);

  // Update a comment's content
  const updateComment = useCallback((commentId: string, content: string) => {
    setComments((prev) => {
      const updateInList = (list: CommentWithReplies[]): CommentWithReplies[] => {
        return list.map((comment) => {
          if (comment.id === commentId) {
            return { ...comment, content, updatedAt: new Date() };
          }
          if (comment.replies?.length) {
            return { ...comment, replies: updateInList(comment.replies as CommentWithReplies[]) };
          }
          return comment;
        });
      };
      return updateInList(prev);
    });
  }, []);

  // Remove a comment from the list
  const removeComment = useCallback((commentId: string) => {
    setComments((prev) => {
      const removeFromList = (list: CommentWithReplies[]): CommentWithReplies[] => {
        return list
          .filter((comment) => comment.id !== commentId)
          .map((comment) => {
            if (comment.replies?.length) {
              return { ...comment, replies: removeFromList(comment.replies as CommentWithReplies[]) };
            }
            return comment;
          });
      };
      return removeFromList(prev);
    });
  }, []);

  // Handle incoming SSE events
  const handleEvent = useCallback(
    (event: CommentEvent) => {
      switch (event.type) {
        case "created":
          addComment(event.comment);
          break;
        case "updated":
          updateComment(event.comment.id, event.comment.content);
          break;
        case "deleted":
          removeComment(event.comment.id);
          break;
      }
    },
    [addComment, updateComment, removeComment],
  );

  // Connect to SSE endpoint
  const connect = useCallback(() => {
    if (!enabled || typeof window === "undefined") return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const eventSource = new EventSource(`/api/videos/${videoId}/comments/stream`);
      eventSourceRef.current = eventSource;

      eventSource.addEventListener("connected", () => {
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
      });

      eventSource.addEventListener("comment", (e) => {
        try {
          const event: CommentEvent = JSON.parse(e.data);
          handleEvent(event);
        } catch (err) {
          console.error("[useRealtimeComments] Failed to parse event:", err);
        }
      });

      eventSource.onerror = () => {
        setIsConnected(false);
        eventSource.close();
        eventSourceRef.current = null;

        // Reconnect with exponential backoff
        if (reconnectAttempts.current < 5) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current++;
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        } else {
          setError(new Error("Failed to connect to real-time updates"));
        }
      };
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to connect"));
      setIsConnected(false);
    }
  }, [videoId, enabled, handleEvent]);

  // Connect on mount and cleanup on unmount
  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [connect]);

  return {
    comments,
    isConnected,
    error,
    addComment,
    updateComment,
    removeComment,
  };
}
