"use client";

import { useState, useCallback, useOptimistic, startTransition } from "react";
import { useRouter } from "next/navigation";
import { CommentThread } from "./comment-thread";
import { CommentForm } from "./comment-form";
import { useRealtimeComments } from "@/hooks/use-realtime-comments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CommentWithReplies } from "@/lib/effect/services/comment-repository";

interface CommentListProps {
  videoId: string;
  videoAuthorId: string;
  initialComments: CommentWithReplies[];
  currentUser?: {
    id: string;
    name?: string | null;
    image?: string | null;
  };
  onTimestampClick?: (timestamp: string) => void;
}

export function CommentList({
  videoId,
  videoAuthorId,
  initialComments,
  currentUser,
  onTimestampClick,
}: CommentListProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Real-time comments with optimistic updates
  const { comments, isConnected, addComment, updateComment, removeComment } = useRealtimeComments({
    videoId,
    initialComments,
  });

  const handleCreateComment = useCallback(
    async (data: { content: string; timestamp?: string; parentId?: string }) => {
      if (!currentUser) {
        router.push("/login");
        return;
      }

      setIsSubmitting(true);
      try {
        const response = await fetch(`/api/videos/${videoId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to create comment");
        }

        // The real-time event will handle adding the comment
        startTransition(() => {
          router.refresh();
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [videoId, currentUser, router],
  );

  const handleEditComment = useCallback(
    async (commentId: string, content: string) => {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update comment");
      }

      startTransition(() => {
        router.refresh();
      });
    },
    [router],
  );

  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete comment");
      }

      startTransition(() => {
        router.refresh();
      });
    },
    [router],
  );

  const commentCount = comments.reduce((count, comment) => {
    return count + 1 + (comment.replies?.length || 0);
  }, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Comments ({commentCount})
        </CardTitle>
        <Badge
          variant={isConnected ? "default" : "secondary"}
          className={cn(
            "text-xs",
            isConnected && "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
          )}
        >
          <Radio className={cn("h-3 w-3 mr-1", isConnected && "animate-pulse")} />
          {isConnected ? "Live" : "Offline"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* New comment form */}
        {currentUser && (
          <CommentForm
            videoId={videoId}
            onSubmit={handleCreateComment}
            placeholder="Add a comment..."
            user={currentUser}
            showTimestamp
          />
        )}

        {!currentUser && (
          <div className="text-center py-4">
            <p className="text-muted-foreground text-sm">
              <a href="/login" className="text-primary hover:underline">
                Sign in
              </a>{" "}
              to leave a comment
            </p>
          </div>
        )}

        {/* Comments list */}
        {comments.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground text-sm">No comments yet</p>
            <p className="text-muted-foreground text-xs mt-1">Be the first to share your thoughts!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => (
              <CommentThread
                key={comment.id}
                comment={comment}
                currentUserId={currentUser?.id}
                videoAuthorId={videoAuthorId}
                videoId={videoId}
                onCreateComment={handleCreateComment}
                onEditComment={handleEditComment}
                onDeleteComment={handleDeleteComment}
                onTimestampClick={onTimestampClick}
                user={currentUser}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
