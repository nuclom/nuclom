'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { logger } from '@/lib/client-logger';
import { VIEW_TRACKING_INTERVAL } from '../types';

interface UseViewTrackingOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoId?: string;
  playing: boolean;
}

export function useViewTracking({ videoRef, videoId, playing }: UseViewTrackingOptions) {
  const [hasTrackedView, setHasTrackedView] = useState(false);
  const viewTrackingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const sessionId = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const stored = localStorage.getItem('viewSessionId');
    if (stored) return stored;
    const id = crypto.randomUUID();
    localStorage.setItem('viewSessionId', id);
    return id;
  }, []);

  const trackView = useCallback(async () => {
    if (!videoId || !sessionId || hasTrackedView) return;

    try {
      await fetch(`/api/videos/${videoId}/views`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      setHasTrackedView(true);
    } catch (error) {
      logger.error('Failed to track view', error);
    }
  }, [videoId, sessionId, hasTrackedView]);

  const updateViewProgress = useCallback(async () => {
    const video = videoRef.current;
    if (!videoId || !sessionId || !hasTrackedView || !video || !Number.isFinite(video.duration)) return;

    try {
      await fetch(`/api/videos/${videoId}/views`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          watchDuration: Math.floor(video.currentTime),
          completionPercent: Math.floor((video.currentTime / video.duration) * 100),
        }),
      });
    } catch (error) {
      logger.error('Failed to update view progress', error);
    }
  }, [videoId, sessionId, hasTrackedView, videoRef]);

  // Set up view progress tracking interval
  useEffect(() => {
    if (playing && hasTrackedView && videoId) {
      viewTrackingIntervalRef.current = setInterval(updateViewProgress, VIEW_TRACKING_INTERVAL);
    } else if (viewTrackingIntervalRef.current) {
      clearInterval(viewTrackingIntervalRef.current);
      viewTrackingIntervalRef.current = null;
    }

    return () => {
      if (viewTrackingIntervalRef.current) {
        clearInterval(viewTrackingIntervalRef.current);
        viewTrackingIntervalRef.current = null;
      }
    };
  }, [playing, hasTrackedView, videoId, updateViewProgress]);

  // Update view progress when video pauses
  useEffect(() => {
    if (!playing && hasTrackedView) {
      updateViewProgress();
    }
  }, [playing, hasTrackedView, updateViewProgress]);

  return {
    hasTrackedView,
    trackView,
    updateViewProgress,
  };
}
