'use client';

import { logger } from '@nuclom/lib/client-logger';
import { cn } from '@nuclom/lib/utils';
import { Button } from '@nuclom/ui/button';
import { Maximize2, Pause, Play, Volume2, VolumeX, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMiniPlayer } from '@/hooks/use-mini-player';

export function MiniPlayer() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const { state, deactivateMiniPlayer, updateTime, setPlaying, setVolume, getExpandUrl } = useMiniPlayer();
  const [isHovered, setIsHovered] = useState(false);
  const [localPlaying, setLocalPlaying] = useState(state.playing);

  // Sync video with state on mount - intentionally only depends on videoUrl
  // to avoid re-syncing on every state change
  // biome-ignore lint/correctness/useExhaustiveDependencies: Intentional - only sync when video URL changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !state.videoUrl) return;

    video.currentTime = state.currentTime;
    video.volume = state.volume;
    video.muted = state.muted;

    if (state.playing) {
      video.play().catch(() => {
        // Autoplay failed, update state
        setPlaying(false);
        setLocalPlaying(false);
      });
    }
  }, [state.videoUrl]);

  // Handle play/pause
  const handleTogglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (localPlaying) {
      video.pause();
    } else {
      video.play().catch((err) => {
        logger.warn('Mini player autoplay failed', err);
      });
    }
  }, [localPlaying]);

  // Handle mute toggle
  const handleToggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setVolume(video.volume, video.muted);
  }, [setVolume]);

  // Handle expand (navigate back to video page)
  const handleExpand = useCallback(() => {
    const url = getExpandUrl();
    if (url) {
      deactivateMiniPlayer();
      router.push(url);
    }
  }, [getExpandUrl, deactivateMiniPlayer, router]);

  // Handle close
  const handleClose = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.pause();
    }
    deactivateMiniPlayer();
  }, [deactivateMiniPlayer]);

  // Video event handlers
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      updateTime(video.currentTime);
    }
  }, [updateTime]);

  const handlePlay = useCallback(() => {
    setLocalPlaying(true);
    setPlaying(true);
  }, [setPlaying]);

  const handlePause = useCallback(() => {
    setLocalPlaying(false);
    setPlaying(false);
  }, [setPlaying]);

  const handleEnded = useCallback(() => {
    setLocalPlaying(false);
    setPlaying(false);
    deactivateMiniPlayer();
  }, [setPlaying, deactivateMiniPlayer]);

  // Calculate progress
  const progress = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;

  // Keyboard handler for expand
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleExpand();
      }
    },
    [handleExpand],
  );

  if (!state.videoUrl) return null;

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50',
        'w-80 rounded-lg overflow-hidden shadow-2xl',
        'bg-black',
        'animate-in slide-in-from-bottom-4 fade-in duration-300',
        'ring-1 ring-white/10',
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="region"
      aria-label={`Mini player: ${state.title}`}
    >
      {/* Video */}
      <div
        className="relative aspect-video cursor-pointer"
        onClick={handleExpand}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label="Click to expand video"
      >
        {/* biome-ignore lint/a11y/useMediaCaption: Mini-player doesn't need captions */}
        <video
          ref={videoRef}
          src={state.videoUrl}
          poster={state.thumbnailUrl ?? undefined}
          className="w-full h-full object-contain"
          playsInline
          crossOrigin="anonymous"
          onTimeUpdate={handleTimeUpdate}
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handleEnded}
        />

        {/* Overlay with controls */}
        <div
          className={cn(
            'absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40',
            'transition-opacity duration-200',
            isHovered ? 'opacity-100' : 'opacity-0',
          )}
        >
          {/* Top controls */}
          <div className="absolute top-2 right-2 flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                handleExpand();
              }}
              aria-label="Expand"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                handleClose();
              }}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Center play button */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12 text-white hover:bg-white/20 rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                handleTogglePlay();
              }}
              aria-label={localPlaying ? 'Pause' : 'Play'}
            >
              {localPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
            </Button>
          </div>

          {/* Bottom controls */}
          <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleMute();
              }}
              aria-label={state.muted ? 'Unmute' : 'Mute'}
            >
              {state.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <span className="text-white text-xs truncate flex-1" title={state.title ?? undefined}>
              {state.title}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
          <div className="h-full bg-primary transition-all duration-150" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}
