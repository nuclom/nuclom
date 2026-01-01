"use client";

import { AlertCircle, Loader2, Play, Volume2, VolumeX, Maximize } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

interface EmbedVideoData {
  id: string;
  title: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  duration: string;
  organization: {
    name: string;
    slug: string;
  };
}

// =============================================================================
// Fetcher
// =============================================================================

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// =============================================================================
// Embed Player Component
// =============================================================================

export default function EmbedPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const videoId = params.id as string;
  const autoplay = searchParams.get("autoplay") === "1";
  const muted = searchParams.get("muted") === "1";
  const loop = searchParams.get("loop") === "1";
  const showTitle = searchParams.get("title") !== "0";
  const showBranding = searchParams.get("branding") !== "0";
  const startTime = Number(searchParams.get("t")) || 0;

  // Video state
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(muted);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const hideControlsTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Fetch video data
  const { data, error, isLoading } = useSWR<{ success: boolean; data: EmbedVideoData; error?: string }>(
    `/api/embed/${videoId}`,
    fetcher,
  );

  // Track view on first play
  const trackView = useCallback(async () => {
    try {
      await fetch(`/api/embed/${videoId}/view`, { method: "POST" });
    } catch (error) {
      console.error("Failed to track view:", error);
    }
  }, [videoId]);

  // Video event handlers
  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    if (!hasStarted) {
      setHasStarted(true);
      trackView();
    }
  }, [hasStarted, trackView]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (video && duration > 0) {
      setProgress((video.currentTime / duration) * 100);
    }
  }, [duration]);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      setDuration(video.duration);
      if (startTime > 0 && startTime < video.duration) {
        video.currentTime = startTime;
      }
    }
  }, [startTime]);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    if (loop && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
    }
  }, [loop]);

  // Control handlers
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      if (isPlaying) {
        video.pause();
      } else {
        video.play();
      }
    }
  }, [isPlaying]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.muted = !video.muted;
      setIsMuted(video.muted);
    }
  }, []);

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const video = videoRef.current;
      const rect = e.currentTarget.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      if (video && duration > 0) {
        video.currentTime = percent * duration;
        setProgress(percent * 100);
      }
    },
    [duration],
  );

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen();
    }
  }, []);

  // Controls visibility
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
    }
    if (isPlaying) {
      hideControlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying]);

  // Autoplay effect
  useEffect(() => {
    if (autoplay && videoRef.current && data?.success) {
      videoRef.current.muted = muted;
      setIsMuted(muted);
      videoRef.current.play().catch(() => {
        // Autoplay blocked, need user interaction
      });
    }
  }, [autoplay, muted, data?.success]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }
    };
  }, []);

  // Format time helper
  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || seconds < 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <Loader2 className="h-12 w-12 animate-spin text-white/50" />
      </div>
    );
  }

  // Error state
  if (error || !data?.success) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-black text-white p-4">
        <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
        <p className="text-center text-white/70">{data?.error || "Video not available"}</p>
      </div>
    );
  }

  const video = data.data;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={video.videoUrl}
        poster={video.thumbnailUrl || undefined}
        className="absolute inset-0 w-full h-full object-contain"
        playsInline
        onPlay={handlePlay}
        onPause={handlePause}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onClick={togglePlay}
      />

      {/* Play Button Overlay (before first play) */}
      {!hasStarted && !isPlaying && (
        <button
          className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
          onClick={togglePlay}
          aria-label="Play video"
        >
          <div className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center shadow-2xl hover:bg-white transition-colors">
            <Play className="h-10 w-10 text-black ml-1" />
          </div>
        </button>
      )}

      {/* Controls Overlay */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 p-4 transition-opacity duration-300",
          "bg-gradient-to-t from-black/80 via-black/40 to-transparent",
          showControls || !isPlaying ? "opacity-100" : "opacity-0",
        )}
      >
        {/* Title (optional) */}
        {showTitle && (
          <div className="mb-2">
            <p className="text-white text-sm font-medium truncate">{video.title}</p>
          </div>
        )}

        {/* Progress Bar */}
        <div
          className="relative h-1 bg-white/30 rounded-full cursor-pointer mb-2 group"
          onClick={handleSeek}
        >
          <div
            className="absolute inset-y-0 left-0 bg-white rounded-full"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `${progress}%`, marginLeft: "-6px" }}
          />
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button
              className="text-white hover:text-white/80 transition-colors"
              onClick={togglePlay}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <Play className="h-5 w-5" />
              )}
            </button>

            {/* Mute/Unmute */}
            <button
              className="text-white hover:text-white/80 transition-colors"
              onClick={toggleMute}
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>

            {/* Time */}
            <span className="text-white text-xs">
              {formatTime(videoRef.current?.currentTime || 0)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Fullscreen */}
            <button
              className="text-white hover:text-white/80 transition-colors"
              onClick={toggleFullscreen}
              aria-label="Toggle fullscreen"
            >
              <Maximize className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Branding (optional) */}
        {showBranding && (
          <div className="mt-2 flex items-center justify-between text-xs text-white/50">
            <span>{video.organization.name}</span>
            <Link
              href={`https://nuclom.com`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white/70 transition-colors"
            >
              Powered by Nuclom
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
