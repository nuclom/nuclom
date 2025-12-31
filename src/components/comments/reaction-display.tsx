"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { REACTIONS, type ReactionType } from "./reaction-picker";

interface GroupedReaction {
  type: ReactionType;
  count: number;
  hasReacted: boolean;
  users: Array<{ id: string; name: string | null }>;
}

interface ReactionDisplayProps {
  reactions: GroupedReaction[];
  onReactionClick?: (reactionType: ReactionType) => void;
  disabled?: boolean;
}

export function ReactionDisplay({ reactions, onReactionClick, disabled }: ReactionDisplayProps) {
  if (reactions.length === 0) {
    return null;
  }

  const getEmoji = (type: ReactionType): string => {
    const reaction = REACTIONS.find((r) => r.type === type);
    return reaction?.emoji || "👍";
  };

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-1 mt-2">
        {reactions.map((reaction) => (
          <Tooltip key={reaction.type}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onReactionClick?.(reaction.type)}
                disabled={disabled}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors",
                  reaction.hasReacted
                    ? "bg-primary/10 text-primary hover:bg-primary/20"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                  disabled && "cursor-not-allowed opacity-50",
                )}
              >
                <span>{getEmoji(reaction.type)}</span>
                <span>{reaction.count}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">
                {reaction.users
                  .slice(0, 5)
                  .map((u) => u.name || "Anonymous")
                  .join(", ")}
                {reaction.users.length > 5 && ` and ${reaction.users.length - 5} more`}
              </p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}

/**
 * Helper function to group reactions by type
 */
export function groupReactions(
  reactions: Array<{
    id: string;
    reactionType: ReactionType;
    userId: string;
    user?: { id: string; name: string | null };
  }>,
  currentUserId?: string,
): GroupedReaction[] {
  const grouped = new Map<ReactionType, GroupedReaction>();

  for (const reaction of reactions) {
    const existing = grouped.get(reaction.reactionType);
    if (existing) {
      existing.count++;
      if (reaction.userId === currentUserId) {
        existing.hasReacted = true;
      }
      if (reaction.user) {
        existing.users.push({ id: reaction.user.id, name: reaction.user.name });
      }
    } else {
      grouped.set(reaction.reactionType, {
        type: reaction.reactionType,
        count: 1,
        hasReacted: reaction.userId === currentUserId,
        users: reaction.user ? [{ id: reaction.user.id, name: reaction.user.name }] : [],
      });
    }
  }

  // Sort by count (descending) then by type
  return Array.from(grouped.values()).sort((a, b) => b.count - a.count);
}
