'use client';

import { formatDistanceToNow } from 'date-fns';
import { Check, Clock, Edit2, Flag, Link2, Loader2, MoreHorizontal, Reply, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { ReportDialog } from '@/components/moderation/report-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/client-logger';
import type { CommentWithAuthor } from '@/lib/effect/services/comment-repository';
import { parseMentions } from '@/lib/mentions';
import { cn } from '@/lib/utils';
import { groupReactions, ReactionDisplay } from './reaction-display';
import { ReactionPicker, type ReactionType } from './reaction-picker';

interface CommentReaction {
  id: string;
  reactionType: ReactionType;
  userId: string;
  user?: { id: string; name: string | null };
}

interface CommentItemProps {
  comment: CommentWithAuthor & { reactions?: CommentReaction[] };
  currentUserId?: string;
  videoAuthorId?: string;
  organizationSlug?: string;
  onReply?: (commentId: string) => void;
  onEdit: (commentId: string, content: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onTimestampClick?: (timestamp: string) => void;
  onReactionChange?: () => void;
  isReplyTarget?: boolean;
  depth?: number;
}

/**
 * Render comment content with parsed mentions
 */
function CommentContent({ content }: { content: string }) {
  const parts = parseMentions(content);

  return (
    <p className="mt-1 text-sm whitespace-pre-wrap break-words">
      {parts.map((part, i) =>
        typeof part === 'string' ? (
          part
        ) : (
          <Link
            key={`mention-${i}`}
            href={`/profile/${part.userId}`}
            className="text-primary font-medium hover:underline"
          >
            @{part.name}
          </Link>
        ),
      )}
    </p>
  );
}

export function CommentItem({
  comment,
  currentUserId,
  videoAuthorId,
  organizationSlug,
  onReply,
  onEdit,
  onDelete,
  onTimestampClick,
  onReactionChange,
  isReplyTarget = false,
  depth = 0,
}: CommentItemProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [reactions, setReactions] = useState<CommentReaction[]>(comment.reactions || []);

  const isAuthor = currentUserId === comment.authorId;
  const isVideoOwner = currentUserId === videoAuthorId;
  const canEdit = isAuthor;
  const canDelete = isAuthor || isVideoOwner;

  // Get current user's reaction
  const currentUserReaction = currentUserId ? reactions.find((r) => r.userId === currentUserId)?.reactionType : null;

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

  const handleReaction = useCallback(
    async (commentId: string, reactionType: ReactionType | null) => {
      if (!currentUserId) {
        toast({
          title: 'Sign in required',
          description: 'Please sign in to react to comments',
          variant: 'destructive',
        });
        return;
      }

      try {
        if (reactionType === null) {
          // Remove reaction
          await fetch(`/api/comments/${commentId}/reactions`, { method: 'DELETE' });
          setReactions((prev) => prev.filter((r) => r.userId !== currentUserId));
        } else {
          // Add or update reaction
          await fetch(`/api/comments/${commentId}/reactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reactionType }),
          });
          setReactions((prev) => {
            const existing = prev.find((r) => r.userId === currentUserId);
            if (existing) {
              return prev.map((r) => (r.userId === currentUserId ? { ...r, reactionType } : r));
            }
            return [...prev, { id: crypto.randomUUID(), reactionType, userId: currentUserId }];
          });
        }
        onReactionChange?.();
      } catch (error) {
        logger.error('Failed to update reaction', error);
        toast({
          title: 'Failed to update reaction',
          description: 'Please try again',
          variant: 'destructive',
        });
      }
    },
    [currentUserId, onReactionChange, toast],
  );

  const handleReactionClick = useCallback(
    (reactionType: ReactionType) => {
      if (currentUserReaction === reactionType) {
        handleReaction(comment.id, null);
      } else {
        handleReaction(comment.id, reactionType);
      }
    },
    [comment.id, currentUserReaction, handleReaction],
  );

  const handleCopyLink = useCallback(() => {
    const url = organizationSlug
      ? `${window.location.origin}/${organizationSlug}/videos/${comment.videoId}?comment=${comment.id}`
      : `${window.location.href}?comment=${comment.id}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Link copied!' });
  }, [comment.id, comment.videoId, organizationSlug, toast]);

  const formattedDate = formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true });
  const wasEdited = comment.updatedAt > comment.createdAt;

  const groupedReactions = groupReactions(reactions, currentUserId);

  return (
    <>
      <div
        className={cn(
          'group flex gap-3 p-3 rounded-lg transition-colors',
          isReplyTarget && 'bg-muted/50 ring-1 ring-primary/20',
          depth > 0 && 'ml-10',
        )}
        id={`comment-${comment.id}`}
      >
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={comment.author.image || undefined} alt={comment.author.name || 'User'} />
          <AvatarFallback>{comment.author.name?.[0] || 'U'}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{comment.author.name}</span>
            {comment.timestamp &&
              (() => {
                const timestamp = comment.timestamp;
                return (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-mono"
                    onClick={() => onTimestampClick?.(timestamp)}
                  >
                    <Clock className="h-3 w-3" />
                    {timestamp}
                  </button>
                );
              })()}
            <span className="text-xs text-muted-foreground">
              {formattedDate}
              {wasEdited && ' (edited)'}
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
            <CommentContent content={comment.content} />
          )}

          {/* Reactions Display */}
          {!isEditing && groupedReactions.length > 0 && (
            <ReactionDisplay
              reactions={groupedReactions}
              onReactionClick={handleReactionClick}
              disabled={!currentUserId}
            />
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

              {currentUserId && (
                <ReactionPicker
                  commentId={comment.id}
                  currentUserReaction={currentUserReaction}
                  onReact={handleReaction}
                />
              )}

              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={handleCopyLink}>
                <Link2 className="h-3 w-3 mr-1" />
                Link
              </Button>

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
                  {(canEdit || canDelete) && <DropdownMenuSeparator />}
                  <ReportDialog
                    resourceType="comment"
                    resourceId={comment.id}
                    trigger={
                      <DropdownMenuItem className="cursor-pointer" onSelect={(e) => e.preventDefault()}>
                        <Flag className="h-4 w-4 mr-2" />
                        Report
                      </DropdownMenuItem>
                    }
                  />
                </DropdownMenuContent>
              </DropdownMenu>
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
              {comment.parentId ? '' : ' and all its replies'}.
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
