"use client";

import {
  AlertCircle,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  Settings,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

export interface VideoPlayerProps {
  /** The video URL to play */
  url: string;
  /** Video title for accessibility */
  title: string;
  /** Optional thumbnail URL to show before playing */
  thumbnailUrl?: string;
  /** Initial playback position (0-1 fraction) */
  initialProgress?: number;
  /** Called when playback progress changes */
  onProgress?: (progress: VideoProgress) => void;
  /** Called when video playback ends */
  onEnded?: () => void;
  /** Called when an error occurs */
  onError?: (error: string) => void;
  /** Optional className for the container */
  className?: string;
}

export interface VideoProgress {
  /** Current time in seconds */
  currentTime: number;
  /** Total duration in seconds */
  duration: number;
  /** Progress as a fraction (0-1) */
  played: number;
  /** Whether the video has been watched (>90%) */
  completed: boolean;
}

type VideoState = "idle" | "loading" | "ready" | "playing" | "paused" | "ended" | "error";

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
const SKIP_SECONDS = 10;
const PROGRESS_SAVE_INTERVAL = 5000; // Save progress every 5 seconds
const COMPLETION_THRESHOLD = 0.9; // 90% watched = completed

// =============================================================================
// Video Player Component
// =============================================================================

export function VideoPlayer({
  url,
  title,
  thumbnailUrl,
  initialProgress = 0,
  onProgress,
  onEnded,
  onError,
  className,
}: VideoPlayerProps) {
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressCallbackRef = useRef(onProgress);
  const lastProgressSaveRef = useRef<number>(0);

  // State
  const [videoState, setVideoState] = useState<VideoState>("idle");
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Keep callback ref up to date
  progressCallbackRef.current = onProgress;

  // =============================================================================
  // Video Control Functions
  // =============================================================================

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (playing) {
      video.pause();
    } else {
      video.play().catch((err) => {
        console.error("Failed to play video:", err);
        setErrorMessage("Failed to play video");
        setVideoState("error");
      });
    }
  }, [playing]);

  const seek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;

    const newTime = Math.max(0, Math.min(time, video.duration));
    video.currentTime = newTime;
    setCurrentTime(newTime);
  }, []);

  const seekForward = useCallback(() => {
    seek(currentTime + SKIP_SECONDS);
  }, [currentTime, seek]);

  const seekBackward = useCallback(() => {
    seek(currentTime - SKIP_SECONDS);
  }, [currentTime, seek]);

  const handleVolumeChange = useCallback((value: number[]) => {
    const newVolume = value[0];
    const video = videoRef.current;
    if (!video) return;

    video.volume = newVolume;
    setVolume(newVolume);
    setMuted(newVolume === 0);
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const newMuted = !muted;
    video.muted = newMuted;
    setMuted(newMuted);
  }, [muted]);

  const handlePlaybackRateChange = useCallback((rate: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.playbackRate = rate;
    setPlaybackRate(rate);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;

    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  }, []);

  // =============================================================================
  // Progress Reporting
  // =============================================================================

  const reportProgress = useCallback(() => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;

    const progress: VideoProgress = {
      currentTime: video.currentTime,
      duration: video.duration,
      played: video.currentTime / video.duration,
      completed: video.currentTime / video.duration >= COMPLETION_THRESHOLD,
    };

    // Only save progress at intervals to reduce API calls
    const now = Date.now();
    if (now - lastProgressSaveRef.current >= PROGRESS_SAVE_INTERVAL) {
      lastProgressSaveRef.current = now;
      progressCallbackRef.current?.(progress);
    }
  }, []);

  // =============================================================================
  // Video Event Handlers
  // =============================================================================

  const handleLoadStart = useCallback(() => {
    setVideoState("loading");
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    setDuration(video.duration);
    setVideoState("ready");

    // Seek to initial position if provided
    if (initialProgress > 0 && !hasInitialized) {
      const targetTime = initialProgress * video.duration;
      if (Number.isFinite(targetTime)) {
        video.currentTime = targetTime;
        setCurrentTime(targetTime);
      }
      setHasInitialized(true);
    }
  }, [initialProgress, hasInitialized]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    setCurrentTime(video.currentTime);
    reportProgress();
  }, [reportProgress]);

  const handlePlay = useCallback(() => {
    setPlaying(true);
    setVideoState("playing");
  }, []);

  const handlePause = useCallback(() => {
    setPlaying(false);
    setVideoState("paused");
    // Save progress immediately when pausing
    const video = videoRef.current;
    if (video && Number.isFinite(video.duration)) {
      progressCallbackRef.current?.({
        currentTime: video.currentTime,
        duration: video.duration,
        played: video.currentTime / video.duration,
        completed: video.currentTime / video.duration >= COMPLETION_THRESHOLD,
      });
    }
  }, []);

  const handleEnded = useCallback(() => {
    setPlaying(false);
    setVideoState("ended");
    onEnded?.();
    // Mark as completed
    const video = videoRef.current;
    if (video) {
      progressCallbackRef.current?.({
        currentTime: video.duration,
        duration: video.duration,
        played: 1,
        completed: true,
      });
    }
  }, [onEnded]);

  const handleError = useCallback(() => {
    const video = videoRef.current;
    const errorMsg = video?.error?.message || "Failed to load video";
    setErrorMessage(errorMsg);
    setVideoState("error");
    onError?.(errorMsg);
  }, [onError]);

  const handleWaiting = useCallback(() => {
    setVideoState("loading");
  }, []);

  const handleCanPlay = useCallback(() => {
    if (videoState === "loading") {
      setVideoState(playing ? "playing" : "ready");
    }
  }, [videoState, playing]);

  // =============================================================================
  // Keyboard Shortcuts
  // =============================================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Only handle shortcuts when container or video is focused
      const container = containerRef.current;
      if (!container?.contains(document.activeElement) && document.activeElement !== document.body) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "arrowleft":
        case "j":
          e.preventDefault();
          seekBackward();
          break;
        case "arrowright":
        case "l":
          e.preventDefault();
          seekForward();
          break;
        case "arrowup":
          e.preventDefault();
          handleVolumeChange([Math.min(1, volume + 0.1)]);
          break;
        case "arrowdown":
          e.preventDefault();
          handleVolumeChange([Math.max(0, volume - 0.1)]);
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          break;
        case "0":
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9":
          e.preventDefault();
          seek((Number.parseInt(e.key, 10) / 10) * duration);
          break;
        case "home":
          e.preventDefault();
          seek(0);
          break;
        case "end":
          e.preventDefault();
          seek(duration);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, seekBackward, seekForward, handleVolumeChange, toggleFullscreen, toggleMute, seek, volume, duration]);

  // =============================================================================
  // Auto-hide controls
  // =============================================================================

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    const hideControls = () => {
      if (playing && !isFullscreen) {
        setShowControls(false);
      }
    };

    const showControlsTemporarily = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(hideControls, 3000);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener("mousemove", showControlsTemporarily);
      container.addEventListener("mouseenter", showControlsTemporarily);
      container.addEventListener("mouseleave", () => {
        if (playing) setShowControls(false);
      });
    }

    return () => {
      clearTimeout(timeout);
      if (container) {
        container.removeEventListener("mousemove", showControlsTemporarily);
        container.removeEventListener("mouseenter", showControlsTemporarily);
      }
    };
  }, [playing, isFullscreen]);

  // =============================================================================
  // Fullscreen change listener
  // =============================================================================

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // =============================================================================
  // Render Helpers
  // =============================================================================

  const formatTime = (seconds: number): string => {
    if (!Number.isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative aspect-video bg-black rounded-lg overflow-hidden group",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        className,
      )}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: Video player needs tabIndex for keyboard controls
      tabIndex={0}
      role="application"
      aria-label={`Video player: ${title}`}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={url}
        poster={thumbnailUrl}
        className="w-full h-full object-contain"
        preload="metadata"
        playsInline
        onClick={togglePlay}
        onLoadStart={handleLoadStart}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        onError={handleError}
        onWaiting={handleWaiting}
        onCanPlay={handleCanPlay}
      >
        <track kind="captions" src="" label="Captions" />
      </video>

      {/* Loading Overlay */}
      {videoState === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <Loader2 className="h-12 w-12 animate-spin text-white" />
        </div>
      )}

      {/* Error Overlay */}
      {videoState === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white gap-3">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="text-sm">{errorMessage || "Failed to load video"}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setVideoState("idle");
              setErrorMessage(null);
              videoRef.current?.load();
            }}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Play Button Overlay (when paused) */}
      {(videoState === "ready" || videoState === "paused" || videoState === "idle") && !playing && (
        <button
          type="button"
          className="absolute inset-0 flex items-center justify-center cursor-pointer bg-black/30 hover:bg-black/40 transition-colors"
          onClick={togglePlay}
          aria-label="Play video"
        >
          <div className="p-4 rounded-full bg-white/20 backdrop-blur-sm">
            <Play className="h-12 w-12 text-white fill-white" />
          </div>
        </button>
      )}

      {/* Controls Overlay */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 p-4",
          "bg-gradient-to-t from-black/80 via-black/40 to-transparent",
          "transition-opacity duration-300",
          showControls || !playing ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      >
        {/* Progress Bar */}
        <div className="mb-3 group/progress">
          <Slider
            value={[progress]}
            min={0}
            max={100}
            step={0.1}
            onValueChange={([value]) => {
              const newTime = (value / 100) * duration;
              seek(newTime);
            }}
            className="cursor-pointer"
            aria-label="Video progress"
          />
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between gap-2">
          {/* Left Controls */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePlay}
              className="text-white hover:bg-white/20"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={seekBackward}
              className="text-white hover:bg-white/20"
              aria-label={`Skip back ${SKIP_SECONDS} seconds`}
            >
              <SkipBack className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={seekForward}
              className="text-white hover:bg-white/20"
              aria-label={`Skip forward ${SKIP_SECONDS} seconds`}
            >
              <SkipForward className="h-4 w-4" />
            </Button>

            {/* Volume Control */}
            <div className="flex items-center gap-1 group/volume">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMute}
                className="text-white hover:bg-white/20"
                aria-label={muted ? "Unmute" : "Mute"}
              >
                {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              <div className="w-0 overflow-hidden group-hover/volume:w-20 transition-all duration-200">
                <Slider
                  value={[muted ? 0 : volume]}
                  min={0}
                  max={1}
                  step={0.01}
                  onValueChange={handleVolumeChange}
                  className="cursor-pointer"
                  aria-label="Volume"
                />
              </div>
            </div>

            {/* Time Display */}
            <span className="text-white text-sm ml-2 font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-1">
            {/* Playback Speed */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 text-xs px-2">
                  <Settings className="h-4 w-4 mr-1" />
                  {playbackRate}x
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {PLAYBACK_RATES.map((rate) => (
                  <DropdownMenuItem
                    key={rate}
                    onClick={() => handlePlaybackRateChange(rate)}
                    className={cn(rate === playbackRate && "bg-accent")}
                  >
                    {rate}x
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Fullscreen */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className="text-white hover:bg-white/20"
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
