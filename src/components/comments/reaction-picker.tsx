"use client";

import { SmilePlus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Reaction types that match the database enum
export const REACTIONS = [
  { type: "like" as const, emoji: "👍", label: "Like" },
  { type: "love" as const, emoji: "❤️", label: "Love" },
  { type: "laugh" as const, emoji: "😂", label: "Laugh" },
  { type: "surprised" as const, emoji: "😮", label: "Surprised" },
  { type: "sad" as const, emoji: "😢", label: "Sad" },
  { type: "celebrate" as const, emoji: "🎉", label: "Celebrate" },
] as const;

export type ReactionType = (typeof REACTIONS)[number]["type"];

interface ReactionPickerProps {
  commentId: string;
  currentUserReaction?: ReactionType | null;
  onReact: (commentId: string, reactionType: ReactionType | null) => Promise<void>;
  disabled?: boolean;
}

export function ReactionPicker({ commentId, currentUserReaction, onReact, disabled }: ReactionPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleReaction = async (reactionType: ReactionType) => {
    setIsLoading(true);
    try {
      if (currentUserReaction === reactionType) {
        // Remove reaction
        await onReact(commentId, null);
      } else {
        // Add or update reaction
        await onReact(commentId, reactionType);
      }
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground"
          disabled={disabled || isLoading}
        >
          <SmilePlus className="h-3 w-3 mr-1" />
          React
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="flex gap-1">
          {REACTIONS.map((reaction) => (
            <button
              key={reaction.type}
              type="button"
              onClick={() => handleReaction(reaction.type)}
              disabled={isLoading}
              className={cn(
                "p-2 text-lg rounded-md hover:bg-accent transition-colors",
                currentUserReaction === reaction.type && "bg-accent ring-2 ring-primary",
              )}
              title={reaction.label}
            >
              {reaction.emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
