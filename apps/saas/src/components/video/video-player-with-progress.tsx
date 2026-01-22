'use client';

/**
 * Video Player with Progress Tracking
 *
 * Client component that wraps the VideoPlayer with automatic progress persistence.
 * Handles loading saved progress and saving playback position.
 */

import { logger } from '@nuclom/lib/client-logger';
import { CheckCircle, Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';
import { useProgressFraction, useVideoProgress } from '@/hooks/use-video-progress';
import type { VideoChapter, VideoProgress } from './video-player';

// Dynamic import for the video player - reduces initial bundle size
const VideoPlayer = dynamic(() => import('./video-player').then((m) => m.VideoPlayer), {
  ssr: false,
  loading: () => (
    <div className="aspect-video bg-black rounded-lg flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-white/50" />
    </div>
  ),
});

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
  /** Organization slug for mini-player navigation */
  organizationSlug?: string;
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
  /** Callback to register the seek function for external control */
  registerSeek?: (seekFn: (time: number) => void) => void;
  /** Callback to register the play function for external control */
  registerPlay?: (playFn: () => void) => void;
  /** Optional function to refresh the video URL (for expired signed URLs) */
  onRefreshUrl?: () => Promise<string | null>;
  /** Optional className */
  className?: string;
}

// =============================================================================
// Helper: Parse duration string to seconds
// =============================================================================

function parseDuration(duration: string): number {
  const parts = duration.split(':').map((p) => Number.parseInt(p, 10));

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
  organizationSlug,
  thumbnailUrl,
  duration,
  chapters,
  onEnded,
  onTimeUpdate,
  registerSeek,
  registerPlay,
  onRefreshUrl,
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
    logger.error('Video playback error', errorMsg);
  }, []);

  // Log warning if progress fetch failed (but don't block playback)
  if (error) {
    logger.warn('Failed to load video progress', error);
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

      {/* Video Player - show immediately, don't wait for progress to load */}
      <VideoPlayer
        url={url}
        title={title}
        videoId={videoId}
        organizationSlug={organizationSlug}
        thumbnailUrl={thumbnailUrl}
        initialProgress={loading ? 0 : initialProgressFraction}
        chapters={chapters}
        onProgress={handleProgress}
        onEnded={handleEnded}
        onError={handleError}
        onTimeUpdate={onTimeUpdate}
        registerSeek={registerSeek}
        registerPlay={registerPlay}
        onRefreshUrl={onRefreshUrl}
      />
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
