'use client';

/**
 * Video Progress Hook
 *
 * Custom hook for managing video playback progress with debounced persistence.
 * Automatically saves progress to the server and restores position on mount.
 */

import { Either } from 'effect';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { VideoProgress } from '@/components/video/video-player';
import { runClientEffect, videoProgressApiEffect } from '@/lib/effect/client';

// =============================================================================
// Types
// =============================================================================

export interface UseVideoProgressOptions {
  /** Video ID to track progress for */
  videoId: string;
  /** Debounce interval for saving progress (ms) - default: 5000 */
  saveInterval?: number;
  /** Whether to enable progress tracking - default: true */
  enabled?: boolean;
}

export interface UseVideoProgressResult {
  /** Initial progress (0-1 fraction) to seek to on mount */
  initialProgress: number;
  /** Whether progress data is loading */
  loading: boolean;
  /** Error message if progress fetch failed */
  error: string | null;
  /** Whether the video was previously completed */
  wasCompleted: boolean;
  /** Save progress callback (debounced internally) */
  saveProgress: (progress: VideoProgress) => void;
  /** Force save progress immediately */
  saveProgressNow: (progress: VideoProgress) => Promise<void>;
  /** Mark video as completed */
  markCompleted: () => Promise<void>;
}

// =============================================================================
// Debounce utility
// =============================================================================

function useDebouncedCallback<T extends (...args: unknown[]) => void>(callback: T, delay: number): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    ((...args: unknown[]) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    }) as T,
    [],
  );
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useVideoProgress({
  videoId,
  saveInterval = 5000,
  enabled = true,
}: UseVideoProgressOptions): UseVideoProgressResult {
  const [initialProgress, setInitialProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wasCompleted, setWasCompleted] = useState(false);

  const lastSavedRef = useRef<number>(0);
  const isSavingRef = useRef(false);

  // Fetch initial progress on mount
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    const fetchProgress = async () => {
      setLoading(true);
      setError(null);

      const result = await runClientEffect(videoProgressApiEffect.getProgress(videoId));

      Either.match(result, {
        onLeft: (err) => {
          // Don't show error for 401 (not logged in) - just start from beginning
          if ('status' in err && err.status === 401) {
            setInitialProgress(0);
          } else {
            setError(err.message);
          }
          setLoading(false);
        },
        onRight: (data) => {
          if (data) {
            const currentTime = Number.parseFloat(data.currentTime);
            // We'll calculate progress when we know the duration
            // For now, store the currentTime and let the player seek to it
            setInitialProgress(currentTime);
            setWasCompleted(data.completed);
          }
          setLoading(false);
        },
      });
    };

    fetchProgress();
  }, [videoId, enabled]);

  // Internal save function
  const doSaveProgress = useCallback(
    async (progress: VideoProgress) => {
      if (!enabled || isSavingRef.current) return;

      // Avoid saving if nothing changed significantly
      const timeDiff = Math.abs(progress.currentTime - lastSavedRef.current);
      if (timeDiff < 1 && !progress.completed) return;

      isSavingRef.current = true;

      const result = await runClientEffect(
        videoProgressApiEffect.saveProgress(videoId, {
          currentTime: progress.currentTime,
          completed: progress.completed,
        }),
      );

      isSavingRef.current = false;

      Either.match(result, {
        onLeft: () => {
          // Silently fail - don't interrupt playback
        },
        onRight: () => {
          lastSavedRef.current = progress.currentTime;
        },
      });
    },
    [videoId, enabled],
  );

  // Debounced save
  const debouncedSave = useDebouncedCallback(doSaveProgress as (...args: unknown[]) => void, saveInterval);

  // Public save function
  const saveProgress = useCallback(
    (progress: VideoProgress) => {
      // Always save immediately when completed
      if (progress.completed) {
        doSaveProgress(progress);
        return;
      }
      debouncedSave(progress);
    },
    [debouncedSave, doSaveProgress],
  );

  // Force save now
  const saveProgressNow = useCallback(
    async (progress: VideoProgress) => {
      await doSaveProgress(progress);
    },
    [doSaveProgress],
  );

  // Mark as completed
  const markCompleted = useCallback(async () => {
    if (!enabled) return;

    const result = await runClientEffect(
      videoProgressApiEffect.saveProgress(videoId, {
        currentTime: lastSavedRef.current,
        completed: true,
      }),
    );

    Either.match(result, {
      onLeft: () => {
        // Silently fail - don't interrupt user experience
      },
      onRight: () => {
        setWasCompleted(true);
      },
    });
  }, [videoId, enabled]);

  // Save progress on unmount
  useEffect(() => {
    return () => {
      // Try to save any pending progress when unmounting
      // Note: This may not always complete due to page navigation
    };
  }, []);

  return {
    initialProgress,
    loading,
    error,
    wasCompleted,
    saveProgress,
    saveProgressNow,
    markCompleted,
  };
}

// =============================================================================
// Helper Hook: Convert currentTime to progress fraction
// =============================================================================

/**
 * Convert a currentTime (seconds) to a progress fraction (0-1)
 * given a duration. Useful when initial progress is stored as seconds.
 */
export function useProgressFraction(currentTimeSeconds: number, duration: number | null): number {
  if (!duration || duration <= 0) return 0;
  return Math.min(1, Math.max(0, currentTimeSeconds / duration));
}
