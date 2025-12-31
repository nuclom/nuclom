"use client";

/**
 * Transcript Display Component
 *
 * Displays video transcript with interactive features:
 * - Click on segment to seek to timestamp
 * - Highlight current segment during playback
 * - Auto-scroll to current segment
 * - Search within transcript
 */

import { FileText, MessageSquarePlus, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { TranscriptSegment } from "@/lib/db/schema";
import { findSegmentIndexByTime } from "@/lib/subtitles";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

export interface TranscriptDisplayProps {
  /** Transcript segments to display */
  segments: TranscriptSegment[];
  /** Current playback time in seconds */
  currentTime?: number;
  /** Callback when a segment is clicked to seek */
  onSeek?: (time: number) => void;
  /** Callback when comment button is clicked on a segment */
  onAddComment?: (segment: TranscriptSegment) => void;
  /** Whether to auto-scroll to current segment */
  autoScroll?: boolean;
  /** Whether transcript is still loading */
  isLoading?: boolean;
  /** Processing status message */
  processingStatus?: "pending" | "transcribing" | "analyzing" | "completed" | "failed";
  /** Maximum height for the transcript container */
  maxHeight?: string;
  /** Optional className */
  className?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "00:00";
  }

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function highlightSearchTerm(text: string, searchTerm: string): React.ReactNode {
  if (!searchTerm.trim()) {
    return text;
  }

  const parts = text.split(new RegExp(`(${escapeRegExp(searchTerm)})`, "gi"));

  return parts.map((part, index) =>
    part.toLowerCase() === searchTerm.toLowerCase() ? (
      <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// =============================================================================
// Transcript Segment Component
// =============================================================================

interface TranscriptSegmentItemProps {
  segment: TranscriptSegment;
  index: number;
  isActive: boolean;
  searchTerm: string;
  onSeek?: (time: number) => void;
  onAddComment?: (segment: TranscriptSegment) => void;
}

function TranscriptSegmentItem({
  segment,
  index,
  isActive,
  searchTerm,
  onSeek,
  onAddComment,
}: TranscriptSegmentItemProps) {
  return (
    <div
      id={`transcript-segment-${index}`}
      className={cn(
        "group relative flex gap-4 p-3 rounded-lg transition-colors cursor-pointer",
        isActive ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-muted/50 border-l-2 border-transparent",
      )}
      onClick={() => onSeek?.(segment.startTime)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSeek?.(segment.startTime);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`Jump to ${formatTime(segment.startTime)}: ${segment.text}`}
    >
      {/* Timestamp */}
      <div className="flex-shrink-0 w-16">
        <span className={cn("font-mono text-xs", isActive ? "text-primary font-medium" : "text-muted-foreground")}>
          {formatTime(segment.startTime)}
        </span>
      </div>

      {/* Text content */}
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm leading-relaxed", isActive && "text-foreground font-medium")}>
          {highlightSearchTerm(segment.text, searchTerm)}
        </p>
      </div>

      {/* Comment button (visible on hover) */}
      {onAddComment && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onAddComment(segment);
            }}
            aria-label="Add comment at this timestamp"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Confidence indicator (if available and low) */}
      {segment.confidence !== undefined && segment.confidence < 0.8 && (
        <div
          className="absolute right-2 bottom-1 text-[10px] text-muted-foreground/50"
          title={`Confidence: ${Math.round(segment.confidence * 100)}%`}
        >
          ⚠
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function TranscriptDisplay({
  segments,
  currentTime = 0,
  onSeek,
  onAddComment,
  autoScroll = true,
  isLoading = false,
  processingStatus,
  maxHeight = "24rem",
  className,
}: TranscriptDisplayProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [userHasScrolled, setUserHasScrolled] = useState(false);

  // Find current segment index
  const currentSegmentIndex = useMemo(() => {
    if (!segments || segments.length === 0) return -1;
    return findSegmentIndexByTime(segments, currentTime);
  }, [segments, currentTime]);

  // Filter segments by search term
  const filteredSegments = useMemo(() => {
    if (!searchTerm.trim()) return segments;
    return segments.filter((segment) => segment.text.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [segments, searchTerm]);

  // Search match count
  const searchMatchCount = searchTerm.trim() ? filteredSegments.length : 0;

  // Auto-scroll to current segment
  useEffect(() => {
    if (!autoScroll || userHasScrolled || currentSegmentIndex < 0) return;

    const element = document.getElementById(`transcript-segment-${currentSegmentIndex}`);
    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentSegmentIndex, autoScroll, userHasScrolled]);

  // Reset user scroll flag when playback jumps (more than 5 seconds)
  const lastTimeRef = useRef(currentTime);
  useEffect(() => {
    const timeDiff = Math.abs(currentTime - lastTimeRef.current);
    if (timeDiff > 5) {
      setUserHasScrolled(false);
    }
    lastTimeRef.current = currentTime;
  }, [currentTime]);

  // Handle scroll event to detect user scrolling
  const handleScroll = useCallback(() => {
    setUserHasScrolled(true);
  }, []);

  // Reset user scroll flag after 3 seconds of inactivity
  useEffect(() => {
    if (!userHasScrolled) return;

    const timeout = setTimeout(() => {
      setUserHasScrolled(false);
    }, 3000);

    return () => clearTimeout(timeout);
  }, [userHasScrolled]);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchTerm("");
  }, []);

  // Handle segment click with mapping back to original index
  const handleSegmentClick = useCallback(
    (time: number) => {
      setUserHasScrolled(false);
      onSeek?.(time);
    },
    [onSeek],
  );

  // Show loading state
  if (isLoading || processingStatus === "pending" || processingStatus === "transcribing") {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Transcript
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <div className="animate-pulse flex space-x-1">
              <div className="h-2 w-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="h-2 w-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="h-2 w-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <p className="text-sm mt-4">
              {processingStatus === "transcribing" ? "Transcribing audio..." : "Preparing transcript..."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show error state
  if (processingStatus === "failed") {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Transcript
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-sm text-red-500">Failed to generate transcript.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show empty state
  if (!segments || segments.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Transcript
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm text-center py-8">No transcript available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Transcript
            <span className="text-xs text-muted-foreground font-normal">({segments.length} segments)</span>
          </CardTitle>

          {/* Search toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setShowSearch((prev) => !prev)}
            aria-label={showSearch ? "Close search" : "Search transcript"}
          >
            {showSearch ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        {/* Search input */}
        {showSearch && (
          <div className="relative mt-2">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search transcript..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-20 h-9"
              autoFocus
            />
            {searchTerm && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {searchMatchCount} match{searchMatchCount !== 1 ? "es" : ""}
                </span>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={clearSearch} aria-label="Clear search">
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        <ScrollArea ref={scrollAreaRef} className="pr-4" style={{ maxHeight }} onScrollCapture={handleScroll}>
          <div className="space-y-1">
            {filteredSegments.map((segment, displayIndex) => {
              // Find original index for active state
              const originalIndex = segments.findIndex(
                (s) => s.startTime === segment.startTime && s.text === segment.text,
              );

              return (
                <TranscriptSegmentItem
                  key={`${segment.startTime}-${displayIndex}`}
                  segment={segment}
                  index={originalIndex}
                  isActive={currentSegmentIndex === originalIndex}
                  searchTerm={searchTerm}
                  onSeek={handleSegmentClick}
                  onAddComment={onAddComment}
                />
              );
            })}
          </div>

          {/* No results message */}
          {searchTerm && filteredSegments.length === 0 && (
            <div className="py-8 text-center text-muted-foreground text-sm">No matches found for "{searchTerm}"</div>
          )}
        </ScrollArea>

        {/* Auto-scroll indicator */}
        {autoScroll && userHasScrolled && (
          <div className="flex justify-center mt-2">
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setUserHasScrolled(false)}>
              Resume auto-scroll
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Export Types
// =============================================================================

export type { TranscriptSegment };
