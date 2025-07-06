"use client";

import { useState, useEffect } from "react";
import { MessageSquarePlus, Reply, MoreHorizontal, Heart } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface Comment {
  id: string;
  content: string;
  timestamp?: string | null;
  parentId?: string | null;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
  replies?: Comment[];
}

interface VideoCommentsProps {
  videoId: string;
  currentUserId: string;
  onTimestampClick?: (timestamp: string) => void;
}

export function VideoComments({ videoId, currentUserId, onTimestampClick }: VideoCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Load comments
  useEffect(() => {
    loadComments();
  }, [videoId]);

  const loadComments = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/videos/${videoId}/comments`);
      if (response.ok) {
        const data = await response.json();
        setComments(data.data || []);
      }
    } catch (error) {
      console.error("Error loading comments:", error);
    } finally {
      setLoading(false);
    }
  };

  const submitComment = async (content: string, parentId?: string) => {
    if (!content.trim()) return;

    try {
      setSubmitting(true);
      const response = await fetch(`/api/videos/${videoId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: content.trim(),
          parentId,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        if (parentId) {
          // Add reply to existing comment
          setComments((prevComments) =>
            prevComments.map((comment) => {
              if (comment.id === parentId) {
                return {
                  ...comment,
                  replies: [...(comment.replies || []), data.data],
                };
              }
              return comment;
            }),
          );
          setReplyContent("");
          setReplyingTo(null);
        } else {
          // Add new top-level comment
          setComments((prevComments) => [data.data, ...prevComments]);
          setNewComment("");
        }
      }
    } catch (error) {
      console.error("Error submitting comment:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTimestampClick = (timestamp: string) => {
    onTimestampClick?.(timestamp);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="h-8 w-8 bg-muted rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-muted rounded w-1/4"></div>
                  <div className="h-4 bg-muted rounded"></div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Comments ({comments.length})</h3>
          </div>

          {/* New Comment Form */}
          <div className="space-y-3">
            <Textarea
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="min-h-[80px] resize-none"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setNewComment("")}
                disabled={!newComment.trim() || submitting}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={() => submitComment(newComment)} disabled={!newComment.trim() || submitting}>
                {submitting ? "Posting..." : "Comment"}
              </Button>
            </div>
          </div>

          {/* Comments List */}
          <div className="space-y-4">
            {comments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquarePlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No comments yet. Be the first to comment!</p>
              </div>
            ) : (
              comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  currentUserId={currentUserId}
                  onReply={(commentId) => setReplyingTo(commentId)}
                  onTimestampClick={handleTimestampClick}
                  replyingTo={replyingTo}
                  replyContent={replyContent}
                  setReplyContent={setReplyContent}
                  onSubmitReply={(content) => submitComment(content, comment.id)}
                  submitting={submitting}
                />
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface CommentItemProps {
  comment: Comment;
  currentUserId: string;
  onReply: (commentId: string) => void;
  onTimestampClick: (timestamp: string) => void;
  replyingTo: string | null;
  replyContent: string;
  setReplyContent: (content: string) => void;
  onSubmitReply: (content: string) => void;
  submitting: boolean;
  isReply?: boolean;
}

function CommentItem({
  comment,
  currentUserId,
  onReply,
  onTimestampClick,
  replyingTo,
  replyContent,
  setReplyContent,
  onSubmitReply,
  submitting,
  isReply = false,
}: CommentItemProps) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  const isAuthor = comment.author.id === currentUserId;
  const showReplyForm = replyingTo === comment.id;

  const toggleLike = () => {
    setLiked(!liked);
    setLikeCount((prev) => (liked ? prev - 1 : prev + 1));
    // TODO: API call to like/unlike comment
  };

  return (
    <div className={cn("space-y-3", isReply && "ml-12")}>
      <div className="flex gap-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={comment.author.image || "/placeholder.svg"} alt={comment.author.name} />
          <AvatarFallback>{comment.author.name?.charAt(0) || "U"}</AvatarFallback>
        </Avatar>

        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">{comment.author.name}</span>
            <span className="text-muted-foreground">
              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
            </span>
            {comment.timestamp && (
              <>
                <span className="text-muted-foreground">•</span>
                <button
                  className="text-primary hover:underline font-mono text-xs"
                  onClick={() => onTimestampClick(comment.timestamp!)}
                >
                  {comment.timestamp}
                </button>
              </>
            )}
          </div>

          <p className="text-sm whitespace-pre-wrap">{comment.content}</p>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-muted-foreground hover:text-foreground"
              onClick={toggleLike}
            >
              <Heart className={cn("h-4 w-4 mr-1", liked && "fill-current text-red-500")} />
              {likeCount > 0 && likeCount}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-muted-foreground hover:text-foreground"
              onClick={() => onReply(comment.id)}
            >
              <Reply className="h-4 w-4 mr-1" />
              Reply
            </Button>

            {isAuthor && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Edit</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Reply Form */}
          {showReplyForm && (
            <div className="space-y-3 pt-2">
              <Textarea
                placeholder={`Reply to ${comment.author.name}...`}
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                className="min-h-[60px] resize-none"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => onReply("")} disabled={submitting}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => onSubmitReply(replyContent)}
                  disabled={!replyContent.trim() || submitting}
                >
                  {submitting ? "Posting..." : "Reply"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-3">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              onReply={onReply}
              onTimestampClick={onTimestampClick}
              replyingTo={replyingTo}
              replyContent={replyContent}
              setReplyContent={setReplyContent}
              onSubmitReply={onSubmitReply}
              submitting={submitting}
              isReply={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}
