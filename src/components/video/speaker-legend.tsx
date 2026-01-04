"use client";

/**
 * Speaker Legend Component
 *
 * Displays a legend of speakers with color coding for a video.
 * Allows clicking to filter transcript by speaker.
 */

import { User, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

export interface Speaker {
  id: string;
  speakerLabel: string;
  displayName: string;
  speakingPercentage: number;
  totalSpeakingTime: number;
  segmentCount: number;
  linkedUser?: {
    id: string;
    name: string;
    email?: string;
    image?: string | null;
  } | null;
}

export interface SpeakerLegendProps {
  /** List of speakers in the video */
  speakers: Speaker[];
  /** Currently selected speaker for filtering */
  selectedSpeakerId?: string | null;
  /** Callback when a speaker is selected/deselected */
  onSelectSpeaker?: (speakerId: string | null) => void;
  /** Whether to show the filter functionality */
  showFilter?: boolean;
  /** Balance score (0-100) */
  balanceScore?: number;
  /** Additional className */
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

// Colors for speakers (up to 10 distinct colors)
const SPEAKER_COLORS = [
  { bg: "bg-blue-500", text: "text-blue-500", light: "bg-blue-100 dark:bg-blue-900/30" },
  { bg: "bg-green-500", text: "text-green-500", light: "bg-green-100 dark:bg-green-900/30" },
  { bg: "bg-purple-500", text: "text-purple-500", light: "bg-purple-100 dark:bg-purple-900/30" },
  { bg: "bg-orange-500", text: "text-orange-500", light: "bg-orange-100 dark:bg-orange-900/30" },
  { bg: "bg-pink-500", text: "text-pink-500", light: "bg-pink-100 dark:bg-pink-900/30" },
  { bg: "bg-teal-500", text: "text-teal-500", light: "bg-teal-100 dark:bg-teal-900/30" },
  { bg: "bg-red-500", text: "text-red-500", light: "bg-red-100 dark:bg-red-900/30" },
  { bg: "bg-yellow-500", text: "text-yellow-500", light: "bg-yellow-100 dark:bg-yellow-900/30" },
  { bg: "bg-indigo-500", text: "text-indigo-500", light: "bg-indigo-100 dark:bg-indigo-900/30" },
  { bg: "bg-cyan-500", text: "text-cyan-500", light: "bg-cyan-100 dark:bg-cyan-900/30" },
];

export function getSpeakerColor(index: number) {
  return SPEAKER_COLORS[index % SPEAKER_COLORS.length];
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) {
    return `${secs}s`;
  }
  return `${mins}m ${secs}s`;
}

function getBalanceLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "Excellent", color: "text-green-500" };
  if (score >= 60) return { label: "Good", color: "text-blue-500" };
  if (score >= 40) return { label: "Fair", color: "text-yellow-500" };
  return { label: "Poor", color: "text-red-500" };
}

// =============================================================================
// Main Component
// =============================================================================

export function SpeakerLegend({
  speakers,
  selectedSpeakerId,
  onSelectSpeaker,
  showFilter = true,
  balanceScore,
  className,
}: SpeakerLegendProps) {
  if (!speakers || speakers.length === 0) {
    return null;
  }

  const handleSpeakerClick = (speakerId: string) => {
    if (!showFilter || !onSelectSpeaker) return;

    if (selectedSpeakerId === speakerId) {
      onSelectSpeaker(null); // Deselect
    } else {
      onSelectSpeaker(speakerId);
    }
  };

  const balance = balanceScore !== undefined ? getBalanceLabel(balanceScore) : null;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Speakers
            <span className="text-xs text-muted-foreground font-normal">({speakers.length})</span>
          </CardTitle>

          {balance && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className={cn("text-xs", balance.color)}>
                    Balance: {balance.label}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Score: {balanceScore}/100
                    <br />
                    Measures how evenly speaking time is distributed
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-2">
          {speakers.map((speaker, index) => {
            const color = getSpeakerColor(index);
            const isSelected = selectedSpeakerId === speaker.id;
            const isFiltering = showFilter && selectedSpeakerId !== null;

            const ElementWrapper = showFilter ? "button" : "div";
            return (
              <ElementWrapper
                type={showFilter ? "button" : undefined}
                key={speaker.id}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-lg transition-all text-left w-full",
                  showFilter && "cursor-pointer",
                  isSelected && color.light,
                  isFiltering && !isSelected && "opacity-50",
                  showFilter && !isSelected && "hover:bg-muted/50",
                )}
                onClick={() => handleSpeakerClick(speaker.id)}
              >
                {/* Color indicator */}
                <div className={cn("w-3 h-3 rounded-full flex-shrink-0", color.bg)} />

                {/* Avatar and name */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {speaker.linkedUser ? (
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={speaker.linkedUser.image || undefined} alt={speaker.linkedUser.name} />
                      <AvatarFallback className="text-[10px]">
                        {speaker.linkedUser.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className={cn("h-6 w-6 rounded-full flex items-center justify-center", color.light)}>
                      <User className={cn("h-3 w-3", color.text)} />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{speaker.displayName}</p>
                    {speaker.linkedUser && (
                      <p className="text-xs text-muted-foreground truncate">{speaker.linkedUser.email}</p>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-medium">{speaker.speakingPercentage}%</p>
                  <p className="text-xs text-muted-foreground">{formatTime(speaker.totalSpeakingTime)}</p>
                </div>
              </ElementWrapper>
            );
          })}
        </div>

        {/* Show all button when filtering */}
        {showFilter && selectedSpeakerId && (
          <Button variant="ghost" size="sm" className="w-full mt-3 text-xs" onClick={() => onSelectSpeaker?.(null)}>
            Show all speakers
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
