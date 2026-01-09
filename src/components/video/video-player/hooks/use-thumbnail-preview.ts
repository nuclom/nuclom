'use client';

import { useCallback, useRef, useState } from 'react';

interface UseThumbnailPreviewOptions {
  videoUrl: string;
  duration: number;
  enabled?: boolean;
}

interface UseThumbnailPreviewResult {
  getThumbnail: (time: number) => Promise<string | null>;
  isLoading: boolean;
  clearCache: () => void;
}

// Quantize time to reduce cache entries (every 2 seconds)
function quantizeTime(time: number): number {
  return Math.floor(time / 2) * 2;
}

export function useThumbnailPreview({
  videoUrl,
  duration,
  enabled = true,
}: UseThumbnailPreviewOptions): UseThumbnailPreviewResult {
  const cacheRef = useRef<Map<number, string>>(new Map());
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const pendingRequestRef = useRef<number | null>(null);

  const getThumbnail = useCallback(
    async (time: number): Promise<string | null> => {
      if (!enabled || !duration || duration <= 0) return null;

      const quantizedTime = quantizeTime(time);

      // Ensure time is within bounds
      const clampedTime = Math.max(0, Math.min(quantizedTime, duration - 0.1));

      // Check cache first
      if (cacheRef.current.has(clampedTime)) {
        return cacheRef.current.get(clampedTime) ?? null;
      }

      // If there's already a pending request for a different time, skip
      if (pendingRequestRef.current !== null && pendingRequestRef.current !== clampedTime) {
        return null;
      }

      pendingRequestRef.current = clampedTime;
      setIsLoading(true);

      try {
        // Reuse video element if possible
        if (!videoRef.current) {
          videoRef.current = document.createElement('video');
          videoRef.current.crossOrigin = 'anonymous';
          videoRef.current.preload = 'metadata';
          videoRef.current.muted = true;
          videoRef.current.src = videoUrl;

          // Wait for metadata to load
          await new Promise<void>((resolve, reject) => {
            const video = videoRef.current;
            if (!video) {
              reject(new Error('No video element'));
              return;
            }
            if (video.readyState >= 1) {
              resolve();
              return;
            }
            const onLoad = () => {
              video.removeEventListener('loadedmetadata', onLoad);
              video.removeEventListener('error', onError);
              resolve();
            };
            const onError = () => {
              video.removeEventListener('loadedmetadata', onLoad);
              video.removeEventListener('error', onError);
              reject(new Error('Failed to load video metadata'));
            };
            video.addEventListener('loadedmetadata', onLoad);
            video.addEventListener('error', onError);
          });
        }

        const video = videoRef.current;
        video.currentTime = clampedTime;

        // Wait for seek to complete
        await new Promise<void>((resolve, reject) => {
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked);
            video.removeEventListener('error', onError);
            resolve();
          };
          const onError = () => {
            video.removeEventListener('seeked', onSeeked);
            video.removeEventListener('error', onError);
            reject(new Error('Failed to seek'));
          };
          video.addEventListener('seeked', onSeeked);
          video.addEventListener('error', onError);
        });

        // Draw to canvas
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 90;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          return null;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const thumbnail = canvas.toDataURL('image/jpeg', 0.7);

        // Cache the result
        cacheRef.current.set(clampedTime, thumbnail);

        return thumbnail;
      } catch {
        return null;
      } finally {
        setIsLoading(false);
        pendingRequestRef.current = null;
      }
    },
    [videoUrl, duration, enabled],
  );

  const clearCache = useCallback(() => {
    cacheRef.current.clear();
    if (videoRef.current) {
      videoRef.current.src = '';
      videoRef.current = null;
    }
  }, []);

  return { getThumbnail, isLoading, clearCache };
}
