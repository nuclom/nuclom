"use client";

import { useState, useCallback, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Clock, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CommentFormProps {
  videoId: string;
  parentId?: string;
  onSubmit: (data: { content: string; timestamp?: string; parentId?: string }) => Promise<void>;
  onCancel?: () => void;
  placeholder?: string;
  user?: {
    name?: string | null;
    image?: string | null;
  };
  showTimestamp?: boolean;
  initialTimestamp?: string;
  compact?: boolean;
}

export function CommentForm({
  videoId,
  parentId,
  onSubmit,
  onCancel,
  placeholder = "Add a comment...",
  user,
  showTimestamp = true,
  initialTimestamp,
  compact = false,
}: CommentFormProps) {
  const [content, setContent] = useState("");
  const [timestamp, setTimestamp] = useState(initialTimestamp || "");
  const [showTimestampInput, setShowTimestampInput] = useState(!!initialTimestamp);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();

      if (!content.trim()) return;

      setIsSubmitting(true);
      try {
        await onSubmit({
          content: content.trim(),
          timestamp: showTimestampInput && timestamp ? timestamp : undefined,
          parentId,
        });
        setContent("");
        setTimestamp("");
        setShowTimestampInput(false);
        setIsFocused(false);
      } finally {
        setIsSubmitting(false);
      }
    },
    [content, timestamp, showTimestampInput, parentId, onSubmit],
  );

  const handleCancel = useCallback(() => {
    setContent("");
    setTimestamp("");
    setShowTimestampInput(false);
    setIsFocused(false);
    onCancel?.();
  }, [onCancel]);

  const isExpanded = isFocused || content.length > 0 || parentId;

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-3", compact && "space-y-2")}>
      <div className="flex gap-3">
        {!compact && user && (
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={user.image || undefined} alt={user.name || "User"} />
            <AvatarFallback>{user.name?.[0] || "U"}</AvatarFallback>
          </Avatar>
        )}

        <div className="flex-1 space-y-2">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={() => setIsFocused(true)}
            placeholder={placeholder}
            disabled={isSubmitting}
            className={cn(
              "resize-none transition-all",
              compact ? "min-h-[60px]" : "min-h-[80px]",
              !isExpanded && "min-h-[40px]",
            )}
            rows={isExpanded ? 3 : 1}
          />

          {isExpanded && (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {showTimestamp && !showTimestampInput && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => setShowTimestampInput(true)}
                  >
                    <Clock className="h-4 w-4 mr-1" />
                    Add timestamp
                  </Button>
                )}

                {showTimestampInput && (
                  <div className="flex items-center gap-2">
                    <Label htmlFor="timestamp" className="sr-only">
                      Timestamp
                    </Label>
                    <Input
                      id="timestamp"
                      type="text"
                      placeholder="00:00:00"
                      value={timestamp}
                      onChange={(e) => setTimestamp(e.target.value)}
                      disabled={isSubmitting}
                      className="w-24 h-8 text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setShowTimestampInput(false);
                        setTimestamp("");
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {(parentId || isFocused) && (
                  <Button type="button" variant="ghost" size="sm" onClick={handleCancel} disabled={isSubmitting}>
                    Cancel
                  </Button>
                )}
                <Button type="submit" size="sm" disabled={!content.trim() || isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-1" />
                      {parentId ? "Reply" : "Comment"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
