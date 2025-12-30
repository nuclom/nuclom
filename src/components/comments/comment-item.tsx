"use client";

import { useState, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoreHorizontal, Reply, Edit2, Trash2, Clock, Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CommentWithAuthor } from "@/lib/effect/services/comment-repository";

interface CommentItemProps {
  comment: CommentWithAuthor;
  currentUserId?: string;
  videoAuthorId?: string;
  onReply?: (commentId: string) => void;
  onEdit: (commentId: string, content: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onTimestampClick?: (timestamp: string) => void;
  isReplyTarget?: boolean;
  depth?: number;
}

export function CommentItem({
  comment,
  currentUserId,
  videoAuthorId,
  onReply,
  onEdit,
  onDelete,
  onTimestampClick,
  isReplyTarget = false,
  depth = 0,
}: CommentItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const isAuthor = currentUserId === comment.authorId;
  const isVideoOwner = currentUserId === videoAuthorId;
  const canEdit = isAuthor;
  const canDelete = isAuthor || isVideoOwner;

  const handleEdit = useCallback(async () => {
    if (!editContent.trim() || editContent.trim() === comment.content) {
      setIsEditing(false);
      setEditContent(comment.content);
      return;
    }

    setIsSaving(true);
    try {
      await onEdit(comment.id, editContent.trim());
      setIsEditing(false);
    } catch {
      setEditContent(comment.content);
    } finally {
      setIsSaving(false);
    }
  }, [editContent, comment.id, comment.content, onEdit]);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      await onDelete(comment.id);
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  }, [comment.id, onDelete]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditContent(comment.content);
  }, [comment.content]);

  const formattedDate = formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true });
  const wasEdited = comment.updatedAt > comment.createdAt;

  return (
    <>
      <div
        className={cn(
          "group flex gap-3 p-3 rounded-lg transition-colors",
          isReplyTarget && "bg-muted/50 ring-1 ring-primary/20",
          depth > 0 && "ml-10",
        )}
      >
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={comment.author.image || undefined} alt={comment.author.name || "User"} />
          <AvatarFallback>{comment.author.name?.[0] || "U"}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{comment.author.name}</span>
            {comment.timestamp && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-mono"
                onClick={() => onTimestampClick?.(comment.timestamp!)}
              >
                <Clock className="h-3 w-3" />
                {comment.timestamp}
              </button>
            )}
            <span className="text-xs text-muted-foreground">
              {formattedDate}
              {wasEdited && " (edited)"}
            </span>
          </div>

          {isEditing ? (
            <div className="mt-2 space-y-2">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[60px] resize-none"
                disabled={isSaving}
                autoFocus
              />
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleEdit} disabled={isSaving || !editContent.trim()}>
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Save
                    </>
                  )}
                </Button>
                <Button size="sm" variant="ghost" onClick={handleCancelEdit} disabled={isSaving}>
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-sm whitespace-pre-wrap break-words">{comment.content}</p>
          )}

          {!isEditing && (
            <div className="mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {onReply && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => onReply(comment.id)}
                >
                  <Reply className="h-3 w-3 mr-1" />
                  Reply
                </Button>
              )}

              {(canEdit || canDelete) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">More options</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canEdit && (
                      <DropdownMenuItem onClick={() => setIsEditing(true)}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                    )}
                    {canDelete && (
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setShowDeleteDialog(true)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete comment?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this comment
              {comment.parentId ? "" : " and all its replies"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
