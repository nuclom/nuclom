"use client";

import { useState, useCallback } from "react";
import { CommentItem } from "./comment-item";
import { CommentForm } from "./comment-form";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CommentWithReplies, CommentWithAuthor } from "@/lib/effect/services/comment-repository";

interface CommentThreadProps {
  comment: CommentWithReplies;
  currentUserId?: string;
  videoAuthorId?: string;
  videoId: string;
  onCreateComment: (data: { content: string; timestamp?: string; parentId?: string }) => Promise<void>;
  onEditComment: (commentId: string, content: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onTimestampClick?: (timestamp: string) => void;
  user?: {
    name?: string | null;
    image?: string | null;
  };
  maxDepth?: number;
  depth?: number;
}

export function CommentThread({
  comment,
  currentUserId,
  videoAuthorId,
  videoId,
  onCreateComment,
  onEditComment,
  onDeleteComment,
  onTimestampClick,
  user,
  maxDepth = 3,
  depth = 0,
}: CommentThreadProps) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const hasReplies = comment.replies && comment.replies.length > 0;
  const canReply = depth < maxDepth;

  const handleReply = useCallback((commentId: string) => {
    setReplyingTo(commentId);
  }, []);

  const handleSubmitReply = useCallback(
    async (data: { content: string; timestamp?: string; parentId?: string }) => {
      await onCreateComment({
        ...data,
        parentId: replyingTo || comment.id,
      });
      setReplyingTo(null);
    },
    [onCreateComment, replyingTo, comment.id],
  );

  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  return (
    <div className={cn("space-y-2", depth > 0 && "border-l-2 border-muted pl-3 ml-3")}>
      <CommentItem
        comment={comment}
        currentUserId={currentUserId}
        videoAuthorId={videoAuthorId}
        onReply={canReply ? handleReply : undefined}
        onEdit={onEditComment}
        onDelete={onDeleteComment}
        onTimestampClick={onTimestampClick}
        isReplyTarget={replyingTo === comment.id}
        depth={0}
      />

      {replyingTo === comment.id && (
        <div className="ml-10">
          <CommentForm
            videoId={videoId}
            parentId={comment.id}
            onSubmit={handleSubmitReply}
            onCancel={handleCancelReply}
            placeholder={`Reply to ${comment.author.name}...`}
            user={user}
            showTimestamp={false}
            compact
          />
        </div>
      )}

      {hasReplies && (
        <div className="ml-10">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs text-muted-foreground mb-2"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? (
              <>
                <ChevronRight className="h-3 w-3 mr-1" />
                Show {comment.replies.length} {comment.replies.length === 1 ? "reply" : "replies"}
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Hide replies
              </>
            )}
          </Button>

          {!isCollapsed && (
            <div className="space-y-2">
              {comment.replies.map((reply) => (
                <CommentThread
                  key={reply.id}
                  comment={{ ...reply, replies: [] }}
                  currentUserId={currentUserId}
                  videoAuthorId={videoAuthorId}
                  videoId={videoId}
                  onCreateComment={onCreateComment}
                  onEditComment={onEditComment}
                  onDeleteComment={onDeleteComment}
                  onTimestampClick={onTimestampClick}
                  user={user}
                  maxDepth={maxDepth}
                  depth={depth + 1}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
