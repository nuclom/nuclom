'use client';

/**
 * Video Processing Hook
 *
 * Polls for video processing updates while a video is being processed.
 * Enables the UI to show incremental updates (thumbnail, transcript, etc.)
 * as they become available during processing.
 */

import { logger } from '@nuclom/lib/client-logger';
import type { ProcessingStatus } from '@nuclom/lib/db/schema';
import type { VideoWithDetails } from '@nuclom/lib/types';
import { useCallback, useEffect, useRef, useState } from 'react';

// =============================================================================
// Types
// =============================================================================

interface UseVideoProcessingOptions {
  /** Initial video data */
  initialVideo: VideoWithDetails;
  /** Polling interval in milliseconds (default: 3000) */
  pollingInterval?: number;
  /** Whether polling is enabled (default: auto-detect based on status) */
  enabled?: boolean;
}

interface UseVideoProcessingResult {
  /** Current video data (updated via polling) */
  video: VideoWithDetails;
  /** Whether the video is currently being processed */
  isProcessing: boolean;
  /** Current processing status */
  processingStatus: ProcessingStatus;
  /** Whether we're actively polling */
  isPolling: boolean;
  /** Force a refresh of video data */
  refresh: () => Promise<void>;
}

// Statuses that indicate processing is in progress
const PROCESSING_STATUSES: ProcessingStatus[] = ['pending', 'transcribing', 'diarizing', 'analyzing'];

// =============================================================================
// Hook Implementation
// =============================================================================

export function useVideoProcessing({
  initialVideo,
  pollingInterval = 3000,
  enabled,
}: UseVideoProcessingOptions): UseVideoProcessingResult {
  const [video, setVideo] = useState<VideoWithDetails>(initialVideo);
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  // Determine if we should be polling
  const processingStatus = video.processingStatus as ProcessingStatus;
  const isProcessing = PROCESSING_STATUSES.includes(processingStatus);
  const shouldPoll = enabled ?? isProcessing;

  // Fetch latest video data
  const fetchVideo = useCallback(async () => {
    try {
      const response = await fetch(`/api/videos/${video.id}`);
      if (!response.ok) return;

      const result = await response.json();
      if (!isMountedRef.current) return;

      if (result.success && result.data) {
        setVideo((prev) => ({
          ...prev,
          ...result.data,
          // Preserve presigned URLs if the new data doesn't have them
          videoUrl: result.data.videoUrl || prev.videoUrl,
          thumbnailUrl: result.data.thumbnailUrl || prev.thumbnailUrl,
        }));
      }
    } catch (error) {
      logger.warn('Failed to fetch video processing status', { error, videoId: video.id });
    }
  }, [video.id]);

  // Refresh function for manual triggers
  const refresh = useCallback(async () => {
    await fetchVideo();
  }, [fetchVideo]);

  // Set up polling
  useEffect(() => {
    isMountedRef.current = true;

    if (shouldPoll) {
      setIsPolling(true);

      // Initial fetch after a short delay
      const initialTimeout = setTimeout(() => {
        if (isMountedRef.current) {
          fetchVideo();
        }
      }, 1000);

      // Set up interval
      intervalRef.current = setInterval(() => {
        if (isMountedRef.current) {
          fetchVideo();
        }
      }, pollingInterval);

      return () => {
        isMountedRef.current = false;
        clearTimeout(initialTimeout);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setIsPolling(false);
      };
    }

    // Stop polling if not needed
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);

    return () => {
      isMountedRef.current = false;
    };
  }, [shouldPoll, pollingInterval, fetchVideo]);

  // Update from initial video if it changes (e.g., from server-side re-render)
  useEffect(() => {
    setVideo((prev) => {
      // Only update if there's meaningful new data
      if (
        initialVideo.processingStatus !== prev.processingStatus ||
        initialVideo.transcript !== prev.transcript ||
        initialVideo.thumbnailUrl !== prev.thumbnailUrl ||
        initialVideo.aiSummary !== prev.aiSummary
      ) {
        return {
          ...prev,
          ...initialVideo,
          // Keep existing presigned URLs if initial doesn't have them
          videoUrl: initialVideo.videoUrl || prev.videoUrl,
          thumbnailUrl: initialVideo.thumbnailUrl || prev.thumbnailUrl,
        };
      }
      return prev;
    });
  }, [initialVideo]);

  return {
    video,
    isProcessing,
    processingStatus,
    isPolling,
    refresh,
  };
}

// =============================================================================
// Export Types
// =============================================================================

export type { UseVideoProcessingOptions, UseVideoProcessingResult };
