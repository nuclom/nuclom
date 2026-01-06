'use client';

/**
 * Video Presence Hook
 *
 * Custom hook for tracking and displaying user presence on video pages.
 * Shows who is currently watching the video with automatic heartbeat updates.
 */

import { Either } from 'effect';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchEffect, runClientEffect } from '@/lib/effect/client';
import type { UserPresenceInfo } from '@/lib/effect/services/presence';

// =============================================================================
// Types
// =============================================================================

export interface UseVideoPresenceOptions {
  /** Video ID to track presence for */
  videoId: string;
  /** Heartbeat interval in milliseconds - default: 30000 (30 seconds) */
  heartbeatInterval?: number;
  /** Fetch interval for getting viewer list - default: 30000 (30 seconds) */
  fetchInterval?: number;
  /** Whether to enable presence tracking - default: true */
  enabled?: boolean;
}

export interface UseVideoPresenceResult {
  /** List of users currently watching the video */
  viewers: UserPresenceInfo[];
  /** Whether presence data is loading */
  loading: boolean;
  /** Error message if presence fetch failed */
  error: string | null;
  /** Update presence with current playback time */
  updatePresence: (currentTime?: number) => Promise<void>;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useVideoPresence({
  videoId,
  heartbeatInterval = 30000,
  fetchInterval = 30000,
  enabled = true,
}: UseVideoPresenceOptions): UseVideoPresenceResult {
  const [viewers, setViewers] = useState<UserPresenceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fetchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountedRef = useRef(false);

  // Fetch current viewers
  const fetchViewers = useCallback(async () => {
    if (!enabled || isUnmountedRef.current) return;

    const result = await runClientEffect(
      fetchEffect<{ success: boolean; data: UserPresenceInfo[] }>(`/videos/${videoId}/presence`, {
        method: 'GET',
      }),
    );

    if (isUnmountedRef.current) return;

    Either.match(result, {
      onLeft: () => {
        // Silently fail - presence is not critical
        setLoading(false);
      },
      onRight: (response) => {
        setViewers(response.data ?? []);
        setError(null);
        setLoading(false);
      },
    });
  }, [videoId, enabled]);

  // Update presence (heartbeat)
  const updatePresence = useCallback(
    async (currentTime?: number) => {
      if (!enabled || isUnmountedRef.current) return;

      const result = await runClientEffect(
        fetchEffect(`/videos/${videoId}/presence`, {
          method: 'POST',
          body: {
            currentTime,
            status: 'online',
          },
        }),
      );

      Either.match(result, {
        onLeft: () => {
          // Silently fail - presence is not critical
        },
        onRight: () => {
          // Success - presence updated
        },
      });
    },
    [videoId, enabled],
  );

  // Initial fetch and setup timers
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    isUnmountedRef.current = false;

    // Initial presence update
    updatePresence();

    // Initial fetch of viewers
    fetchViewers();

    // Setup heartbeat timer
    heartbeatTimerRef.current = setInterval(() => {
      updatePresence();
    }, heartbeatInterval);

    // Setup fetch timer
    fetchTimerRef.current = setInterval(() => {
      fetchViewers();
    }, fetchInterval);

    // Cleanup on unmount
    return () => {
      isUnmountedRef.current = true;

      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }

      if (fetchTimerRef.current) {
        clearInterval(fetchTimerRef.current);
        fetchTimerRef.current = null;
      }
    };
  }, [enabled, heartbeatInterval, fetchInterval, fetchViewers, updatePresence]);

  return {
    viewers,
    loading,
    error,
    updatePresence,
  };
}
