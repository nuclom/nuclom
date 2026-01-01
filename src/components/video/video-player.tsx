"use client";

import {
  AlertCircle,
  Captions,
  CaptionsOff,
  Keyboard,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  Repeat,
  Settings,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

export interface VideoChapter {
  /** Chapter ID */
  id: string;
  /** Chapter title */
  title: string;
  /** Start time in seconds */
  startTime: number;
  /** End time in seconds */
  endTime?: number;
  /** Optional chapter summary */
  summary?: string;
}

export interface CaptionTrack {
  /** Language code (e.g., "en", "es") */
  code: string;
  /** Language display name */
  label: string;
  /** URL to the subtitle file */
  src: string;
  /** Whether this is the default track */
  default?: boolean;
}

export interface VideoPlayerProps {
  /** The video URL to play */
  url: string;
  /** Video title for accessibility */
  title: string;
  /** Optional video ID for loading captions from API */
  videoId?: string;
  /** Optional thumbnail URL to show before playing */
  thumbnailUrl?: string;
  /** Initial playback position (0-1 fraction) */
  initialProgress?: number;
  /** Optional video chapters for timeline markers and navigation */
  chapters?: VideoChapter[];
  /** Optional custom caption tracks (if not using videoId for auto-loading) */
  captionTracks?: CaptionTrack[];
  /** Called when playback progress changes */
  onProgress?: (progress: VideoProgress) => void;
  /** Called when video playback ends */
  onEnded?: () => void;
  /** Called when an error occurs */
  onError?: (error: string) => void;
  /** Called when time is updated (for syncing with other components) */
  onTimeUpdate?: (currentTime: number) => void;
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
const VIEW_TRACKING_INTERVAL = 30000; // Update view progress every 30 seconds

// Keyboard shortcuts documentation
const KEYBOARD_SHORTCUTS = [
  { key: "Space / K", action: "Play / Pause" },
  { key: "J / ←", action: "Skip back 10s" },
  { key: "L / →", action: "Skip forward 10s" },
  { key: "↑ / ↓", action: "Volume up / down" },
  { key: "M", action: "Mute / Unmute" },
  { key: "F", action: "Fullscreen" },
  { key: "P", action: "Picture-in-Picture" },
  { key: "C", action: "Toggle captions" },
  { key: "R", action: "Toggle loop" },
  { key: "0-9", action: "Jump to 0-90%" },
  { key: "Home / End", action: "Start / End" },
] as const;

// =============================================================================
// Video Player Component
// =============================================================================

export function VideoPlayer({
  url,
  title,
  videoId,
  thumbnailUrl,
  initialProgress = 0,
  chapters = [],
  captionTracks: customCaptionTracks,
  onProgress,
  onEnded,
  onError,
  onTimeUpdate,
  className,
}: VideoPlayerProps) {
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const progressCallbackRef = useRef(onProgress);
  const lastProgressSaveRef = useRef<number>(0);
  const lastClickRef = useRef<number>(0);

  // State
  const [videoState, setVideoState] = useState<VideoState>("idle");
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPiP, setIsPiP] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);

  // Caption state
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [selectedCaptionTrack, setSelectedCaptionTrack] = useState<string | null>(null);
  const [availableCaptionTracks, setAvailableCaptionTracks] = useState<CaptionTrack[]>([]);

  // View tracking state
  const [hasTrackedView, setHasTrackedView] = useState(false);
  const viewTrackingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Generate or retrieve session ID for view tracking
  const sessionId = useMemo(() => {
    if (typeof window === "undefined") return "";
    const stored = localStorage.getItem("viewSessionId");
    if (stored) return stored;
    const id = crypto.randomUUID();
    localStorage.setItem("viewSessionId", id);
    return id;
  }, []);

  // Load caption tracks from API or use custom tracks
  useEffect(() => {
    if (customCaptionTracks && customCaptionTracks.length > 0) {
      setAvailableCaptionTracks(customCaptionTracks);
      const defaultTrack = customCaptionTracks.find((t) => t.default);
      if (defaultTrack) {
        setSelectedCaptionTrack(defaultTrack.code);
      }
    } else if (videoId) {
      // Fetch available captions from API
      fetch(`/api/videos/${videoId}/subtitles`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data?.languages) {
            const tracks: CaptionTrack[] = data.data.languages
              .filter((lang: { available: boolean }) => lang.available)
              .map((lang: { code: string; name: string; isOriginal: boolean; url: string }) => ({
                code: lang.code,
                label: lang.name,
                src: lang.url,
                default: lang.isOriginal,
              }));
            setAvailableCaptionTracks(tracks);
          }
        })
        .catch((err) => {
          console.error("Failed to load caption tracks:", err);
        });
    }
  }, [videoId, customCaptionTracks]);

  // Keep callback ref up to date
  progressCallbackRef.current = onProgress;

  // Find current chapter based on current time
  const currentChapter = useMemo(() => {
    if (!chapters.length || !duration) return null;
    return chapters.find((chapter, index) => {
      const nextChapter = chapters[index + 1];
      const endTime = chapter.endTime || nextChapter?.startTime || duration;
      return currentTime >= chapter.startTime && currentTime < endTime;
    });
  }, [chapters, currentTime, duration]);

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

  const togglePictureInPicture = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiP(false);
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
        setIsPiP(true);
      }
    } catch (err) {
      console.error("Picture-in-Picture error:", err);
    }
  }, []);

  const toggleLoop = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const newLoopState = !isLooping;
    video.loop = newLoopState;
    setIsLooping(newLoopState);
  }, [isLooping]);

  // Caption functions
  const toggleCaptions = useCallback(() => {
    const video = videoRef.current;
    if (!video || availableCaptionTracks.length === 0) return;

    if (captionsEnabled) {
      // Disable all tracks
      Array.from(video.textTracks).forEach((track) => {
        track.mode = "disabled";
      });
      setCaptionsEnabled(false);
    } else {
      // Enable selected track (or first available)
      const trackToEnable = selectedCaptionTrack || availableCaptionTracks[0]?.code;
      if (trackToEnable) {
        setSelectedCaptionTrack(trackToEnable);
        Array.from(video.textTracks).forEach((track) => {
          if (track.language === trackToEnable) {
            track.mode = "showing";
          } else {
            track.mode = "disabled";
          }
        });
        setCaptionsEnabled(true);
      }
    }
  }, [captionsEnabled, selectedCaptionTrack, availableCaptionTracks]);

  const selectCaptionTrack = useCallback((trackCode: string | null) => {
    const video = videoRef.current;
    if (!video) return;

    if (trackCode === null) {
      // Disable all tracks
      Array.from(video.textTracks).forEach((track) => {
        track.mode = "disabled";
      });
      setCaptionsEnabled(false);
      setSelectedCaptionTrack(null);
    } else {
      setSelectedCaptionTrack(trackCode);
      setCaptionsEnabled(true);
      // Enable the selected track, disable others
      Array.from(video.textTracks).forEach((track) => {
        if (track.language === trackCode) {
          track.mode = "showing";
        } else {
          track.mode = "disabled";
        }
      });
    }
  }, []);

  const seekToChapter = useCallback(
    (chapter: VideoChapter) => {
      seek(chapter.startTime);
    },
    [seek],
  );

  // Handle double-click for fullscreen
  const handleVideoClick = useCallback(() => {
    const now = Date.now();
    const timeDiff = now - lastClickRef.current;

    if (timeDiff < 300) {
      // Double click detected
      toggleFullscreen();
      lastClickRef.current = 0;
    } else {
      // Single click - toggle play
      togglePlay();
      lastClickRef.current = now;
    }
  }, [toggleFullscreen, togglePlay]);

  // Handle progress bar hover for time preview
  const handleProgressHover = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const progressBar = progressBarRef.current;
      if (!progressBar || !duration) return;

      const rect = progressBar.getBoundingClientRect();
      const position = (e.clientX - rect.left) / rect.width;
      const time = position * duration;

      setHoverTime(Math.max(0, Math.min(time, duration)));
      setHoverPosition(e.clientX - rect.left);
    },
    [duration],
  );

  const handleProgressLeave = useCallback(() => {
    setHoverTime(null);
  }, []);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const progressBar = progressBarRef.current;
      if (!progressBar || !duration) return;

      const rect = progressBar.getBoundingClientRect();
      const position = (e.clientX - rect.left) / rect.width;
      const newTime = position * duration;

      seek(Math.max(0, Math.min(newTime, duration)));
    },
    [duration, seek],
  );

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
  // View Tracking Functions
  // =============================================================================

  // Track view on first play
  const trackView = useCallback(async () => {
    if (!videoId || !sessionId || hasTrackedView) return;

    try {
      await fetch(`/api/videos/${videoId}/views`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      setHasTrackedView(true);
    } catch (error) {
      console.error("Failed to track view:", error);
    }
  }, [videoId, sessionId, hasTrackedView]);

  // Update view progress
  const updateViewProgress = useCallback(async () => {
    const video = videoRef.current;
    if (!videoId || !sessionId || !hasTrackedView || !video || !Number.isFinite(video.duration)) return;

    try {
      await fetch(`/api/videos/${videoId}/views`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          watchDuration: Math.floor(video.currentTime),
          completionPercent: Math.floor((video.currentTime / video.duration) * 100),
        }),
      });
    } catch (error) {
      console.error("Failed to update view progress:", error);
    }
  }, [videoId, sessionId, hasTrackedView]);

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

  // Update view progress when video ends or pauses
  useEffect(() => {
    if (!playing && hasTrackedView) {
      updateViewProgress();
    }
  }, [playing, hasTrackedView, updateViewProgress]);

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
    onTimeUpdate?.(video.currentTime);
    reportProgress();

    // Update buffered amount
    if (video.buffered.length > 0) {
      const bufferedEnd = video.buffered.end(video.buffered.length - 1);
      setBuffered((bufferedEnd / video.duration) * 100);
    }
  }, [reportProgress, onTimeUpdate]);

  const handlePlay = useCallback(() => {
    setPlaying(true);
    setVideoState("playing");
    // Track view on first play
    if (!hasTrackedView && videoId) {
      trackView();
    }
  }, [hasTrackedView, videoId, trackView]);

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
        case "p":
          e.preventDefault();
          togglePictureInPicture();
          break;
        case "c":
          e.preventDefault();
          toggleCaptions();
          break;
        case "r":
          e.preventDefault();
          toggleLoop();
          break;
        case "?":
          e.preventDefault();
          setShowKeyboardHelp((prev) => !prev);
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
  }, [
    togglePlay,
    seekBackward,
    seekForward,
    handleVolumeChange,
    toggleFullscreen,
    toggleMute,
    togglePictureInPicture,
    toggleLoop,
    toggleCaptions,
    seek,
    volume,
    duration,
  ]);

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
  // Picture-in-Picture listeners
  // =============================================================================

  useEffect(() => {
    // Check PiP support on client side
    setPipSupported(document.pictureInPictureEnabled ?? false);

    const video = videoRef.current;
    if (!video) return;

    const handleEnterPiP = () => setIsPiP(true);
    const handleLeavePiP = () => setIsPiP(false);

    video.addEventListener("enterpictureinpicture", handleEnterPiP);
    video.addEventListener("leavepictureinpicture", handleLeavePiP);

    return () => {
      video.removeEventListener("enterpictureinpicture", handleEnterPiP);
      video.removeEventListener("leavepictureinpicture", handleLeavePiP);
    };
  }, []);

  // =============================================================================
  // Render Helpers
  // =============================================================================

  const formatTime = (seconds: number): string => {
    if (!Number.isFinite(seconds)) return "0:00";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Get volume icon based on level
  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

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
      {/* biome-ignore lint/a11y/useMediaCaption: Captions are dynamically provided via availableCaptionTracks */}
      <video
        ref={videoRef}
        src={url}
        poster={thumbnailUrl}
        className="w-full h-full object-contain"
        preload="metadata"
        playsInline
        crossOrigin="anonymous"
        onClick={handleVideoClick}
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
        {/* Caption Tracks */}
        {availableCaptionTracks.map((track) => (
          <track
            key={track.code}
            kind="captions"
            src={track.src}
            srcLang={track.code}
            label={track.label}
            default={track.default && captionsEnabled}
          />
        ))}
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

      {/* Current Chapter Display */}
      {currentChapter && showControls && (
        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-md">
          <p className="text-white text-sm font-medium">{currentChapter.title}</p>
        </div>
      )}

      {/* Loop Indicator */}
      {isLooping && (
        <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-md">
          <Repeat className="h-4 w-4 text-white" />
        </div>
      )}

      {/* Keyboard Shortcuts Help Modal */}
      {showKeyboardHelp && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
          <div className="bg-background rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Keyboard className="h-5 w-5" />
                Keyboard Shortcuts
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setShowKeyboardHelp(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {KEYBOARD_SHORTCUTS.map((shortcut) => (
                <div key={shortcut.key} className="flex justify-between text-sm">
                  <kbd className="px-2 py-0.5 bg-muted rounded text-muted-foreground font-mono text-xs">
                    {shortcut.key}
                  </kbd>
                  <span className="text-muted-foreground">{shortcut.action}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4 text-center">Press ? to toggle this menu</p>
          </div>
        </div>
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
        {/* Custom Progress Bar with chapters, buffered, and hover preview */}
        {/* biome-ignore lint/a11y/useFocusableInteractive: Progress bar keyboard handled by parent container */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: Keyboard navigation handled at video player level */}
        <div
          ref={progressBarRef}
          className="relative mb-3 h-1.5 bg-white/30 rounded-full cursor-pointer group/progress hover:h-2.5 transition-all"
          onClick={handleProgressClick}
          onMouseMove={handleProgressHover}
          onMouseLeave={handleProgressLeave}
          role="slider"
          aria-label="Video progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          {/* Buffered Progress */}
          <div
            className="absolute top-0 left-0 h-full bg-white/40 rounded-full transition-all"
            style={{ width: `${buffered}%` }}
          />

          {/* Played Progress */}
          <div
            className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />

          {/* Progress Handle */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full shadow-md opacity-0 group-hover/progress:opacity-100 transition-opacity"
            style={{ left: `calc(${progress}% - 6px)` }}
          />

          {/* Chapter Markers */}
          {chapters.map((chapter) => {
            const chapterPosition = duration > 0 ? (chapter.startTime / duration) * 100 : 0;
            return (
              <button
                key={chapter.id}
                type="button"
                className="absolute top-1/2 -translate-y-1/2 w-1 h-3 bg-white/80 rounded-sm hover:bg-white hover:scale-125 transition-transform z-10"
                style={{ left: `${chapterPosition}%` }}
                onClick={(e) => {
                  e.stopPropagation();
                  seekToChapter(chapter);
                }}
                title={chapter.title}
                aria-label={`Jump to chapter: ${chapter.title}`}
              />
            );
          })}

          {/* Hover Time Preview */}
          {hoverTime !== null && (
            <div
              className="absolute -top-10 px-2 py-1 bg-black/90 text-white text-xs rounded pointer-events-none whitespace-nowrap transform -translate-x-1/2"
              style={{ left: hoverPosition }}
            >
              {formatTime(hoverTime)}
              {chapters.length > 0 && (
                <span className="block text-white/60 text-[10px]">
                  {chapters.find((c, i) => {
                    const nextChapter = chapters[i + 1];
                    const endTime = c.endTime || nextChapter?.startTime || duration;
                    return hoverTime >= c.startTime && hoverTime < endTime;
                  })?.title || ""}
                </span>
              )}
            </div>
          )}
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
                <VolumeIcon className="h-4 w-4" />
              </Button>
              <div className="w-0 overflow-hidden group-hover/volume:w-20 transition-all duration-200">
                <div className="relative h-1.5 bg-white/30 rounded-full">
                  <div
                    className="absolute top-0 left-0 h-full bg-white rounded-full"
                    style={{ width: `${(muted ? 0 : volume) * 100}%` }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={muted ? 0 : volume}
                    onChange={(e) => handleVolumeChange([Number.parseFloat(e.target.value)])}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    aria-label="Volume"
                  />
                </div>
              </div>
            </div>

            {/* Time Display */}
            <span className="text-white text-sm ml-2 font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-1">
            {/* Loop Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleLoop}
              className={cn("text-white hover:bg-white/20", isLooping && "bg-white/20")}
              aria-label={isLooping ? "Disable loop" : "Enable loop"}
              title="Toggle loop (C)"
            >
              <Repeat className="h-4 w-4" />
            </Button>

            {/* Settings Menu (Playback Speed + Chapters) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 text-xs px-2">
                  <Settings className="h-4 w-4 mr-1" />
                  {playbackRate}x
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Playback Speed</DropdownMenuLabel>
                {PLAYBACK_RATES.map((rate) => (
                  <DropdownMenuItem
                    key={rate}
                    onClick={() => handlePlaybackRateChange(rate)}
                    className={cn(rate === playbackRate && "bg-accent")}
                  >
                    {rate}x
                  </DropdownMenuItem>
                ))}
                {chapters.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Chapters</DropdownMenuLabel>
                    {chapters.map((chapter) => (
                      <DropdownMenuItem
                        key={chapter.id}
                        onClick={() => seekToChapter(chapter)}
                        className={cn(currentChapter?.id === chapter.id && "bg-accent")}
                      >
                        <span className="flex-1 truncate">{chapter.title}</span>
                        <span className="text-xs text-muted-foreground ml-2">{formatTime(chapter.startTime)}</span>
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Keyboard Shortcuts Help */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  aria-label="Keyboard shortcuts"
                  title="Keyboard shortcuts (?)"
                >
                  <Keyboard className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64">
                <h4 className="font-medium mb-2">Keyboard Shortcuts</h4>
                <div className="space-y-1 text-sm">
                  {KEYBOARD_SHORTCUTS.slice(0, 6).map((shortcut) => (
                    <div key={shortcut.key} className="flex justify-between">
                      <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">{shortcut.key}</kbd>
                      <span className="text-muted-foreground text-xs">{shortcut.action}</span>
                    </div>
                  ))}
                </div>
                <Button
                  variant="link"
                  size="sm"
                  className="w-full mt-2 text-xs"
                  onClick={() => setShowKeyboardHelp(true)}
                >
                  View all shortcuts
                </Button>
              </PopoverContent>
            </Popover>

            {/* Captions */}
            {availableCaptionTracks.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn("text-white hover:bg-white/20", captionsEnabled && "bg-white/20")}
                    aria-label={captionsEnabled ? "Captions on" : "Captions off"}
                    title="Captions (C)"
                  >
                    {captionsEnabled ? <Captions className="h-4 w-4" /> : <CaptionsOff className="h-4 w-4" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Subtitles</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => selectCaptionTrack(null)}
                    className={cn(!captionsEnabled && "bg-accent")}
                  >
                    Off
                  </DropdownMenuItem>
                  {availableCaptionTracks.map((track) => (
                    <DropdownMenuItem
                      key={track.code}
                      onClick={() => selectCaptionTrack(track.code)}
                      className={cn(captionsEnabled && selectedCaptionTrack === track.code && "bg-accent")}
                    >
                      {track.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Picture-in-Picture */}
            {pipSupported && (
              <Button
                variant="ghost"
                size="icon"
                onClick={togglePictureInPicture}
                className={cn("text-white hover:bg-white/20", isPiP && "bg-white/20")}
                aria-label={isPiP ? "Exit Picture-in-Picture" : "Enter Picture-in-Picture"}
                title="Picture-in-Picture (P)"
              >
                <PictureInPicture2 className="h-4 w-4" />
              </Button>
            )}

            {/* Fullscreen */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className="text-white hover:bg-white/20"
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              title="Fullscreen (F)"
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
