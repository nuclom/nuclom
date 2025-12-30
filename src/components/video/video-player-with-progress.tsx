"use client";

/**
 * Video Player with Progress Tracking
 *
 * Client component that wraps the VideoPlayer with automatic progress persistence.
 * Handles loading saved progress and saving playback position.
 */

import { CheckCircle } from "lucide-react";
import { useCallback, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useProgressFraction, useVideoProgress } from "@/hooks/use-video-progress";
import { type VideoChapter, VideoPlayer, type VideoProgress } from "./video-player";

// =============================================================================
// Types
// =============================================================================

export interface VideoPlayerWithProgressProps {
  /** Video ID for progress tracking */
  videoId: string;
  /** Video URL to play */
  url: string;
  /** Video title */
  title: string;
  /** Optional thumbnail URL */
  thumbnailUrl?: string;
  /** Video duration in format "HH:MM:SS" or "MM:SS" */
  duration: string;
  /** Optional video chapters for timeline markers */
  chapters?: VideoChapter[];
  /** Optional callback when playback ends */
  onEnded?: () => void;
  /** Optional callback when time updates (for syncing with transcript) */
  onTimeUpdate?: (currentTime: number) => void;
  /** Optional className */
  className?: string;
}

// =============================================================================
// Helper: Parse duration string to seconds
// =============================================================================

function parseDuration(duration: string): number {
  const parts = duration.split(":").map((p) => Number.parseInt(p, 10));

  if (parts.length === 3) {
    // HH:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    // MM:SS
    return parts[0] * 60 + parts[1];
  }
  // Just seconds
  return parts[0] || 0;
}

// =============================================================================
// Component
// =============================================================================

export function VideoPlayerWithProgress({
  videoId,
  url,
  title,
  thumbnailUrl,
  duration,
  chapters,
  onEnded,
  onTimeUpdate,
  className,
}: VideoPlayerWithProgressProps) {
  const [videoDuration, setVideoDuration] = useState<number | null>(null);

  const { initialProgress, loading, error, wasCompleted, saveProgress, markCompleted } = useVideoProgress({
    videoId,
    saveInterval: 5000,
  });

  // Calculate initial progress as a fraction
  // initialProgress is stored as seconds, we need to convert to 0-1 fraction
  const durationSeconds = videoDuration || parseDuration(duration);
  const initialProgressFraction = useProgressFraction(initialProgress, durationSeconds);

  // Handle progress updates
  const handleProgress = useCallback(
    (progress: VideoProgress) => {
      // Update our knowledge of duration
      if (progress.duration > 0) {
        setVideoDuration(progress.duration);
      }
      // Save to backend
      saveProgress(progress);
    },
    [saveProgress],
  );

  // Handle video ended
  const handleEnded = useCallback(() => {
    markCompleted();
    onEnded?.();
  }, [markCompleted, onEnded]);

  // Handle errors
  const handleError = useCallback((errorMsg: string) => {
    console.error("Video playback error:", errorMsg);
  }, []);

  // Show skeleton while loading progress
  if (loading) {
    return (
      <div className={className}>
        <Skeleton className="aspect-video w-full rounded-lg" />
        <p className="text-xs text-muted-foreground mt-2 text-center">Loading playback position...</p>
      </div>
    );
  }

  // Show error but still allow playback
  if (error) {
    console.warn("Failed to load video progress:", error);
    // Continue with video player anyway
  }

  return (
    <div className={className}>
      {/* Completed badge */}
      {wasCompleted && (
        <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 mb-2">
          <CheckCircle className="h-3 w-3" />
          <span>Previously watched</span>
        </div>
      )}

      {/* Video Player */}
      <VideoPlayer
        url={url}
        title={title}
        thumbnailUrl={thumbnailUrl}
        initialProgress={initialProgressFraction}
        chapters={chapters}
        onProgress={handleProgress}
        onEnded={handleEnded}
        onError={handleError}
        onTimeUpdate={onTimeUpdate}
      />

      {/* Resume message */}
      {initialProgress > 0 && !wasCompleted && (
        <p className="text-xs text-muted-foreground mt-2 text-center">Resuming from where you left off</p>
      )}
    </div>
  );
}

// =============================================================================
// Simple Video Player (no progress tracking)
// =============================================================================

export interface SimpleVideoPlayerProps {
  /** Video URL to play */
  url: string;
  /** Video title */
  title: string;
  /** Optional thumbnail URL */
  thumbnailUrl?: string;
  /** Optional callback when playback ends */
  onEnded?: () => void;
  /** Optional className */
  className?: string;
}

/**
 * Simple video player without progress tracking.
 * Use this when progress tracking is not needed (e.g., preview mode).
 */
export function SimpleVideoPlayer({ url, title, thumbnailUrl, onEnded, className }: SimpleVideoPlayerProps) {
  return <VideoPlayer url={url} title={title} thumbnailUrl={thumbnailUrl} onEnded={onEnded} className={className} />;
}
