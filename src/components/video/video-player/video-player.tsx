'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMiniPlayer } from '@/hooks/use-mini-player';
import { useTouch } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { VideoPresence } from '../video-presence';
import { KeyboardHelpModal } from './components/keyboard-help-modal';
import { TouchSkipFeedback } from './components/touch-skip-feedback';
import { VideoControls } from './components/video-controls';
import {
  ChapterDisplay,
  ErrorOverlay,
  LoadingOverlay,
  LoopIndicator,
  PlayButtonOverlay,
} from './components/video-overlays';
import { VideoProgressBar } from './components/video-progress-bar';
import { useCaptions } from './hooks/use-captions';
import { useKeyboardShortcuts } from './hooks/use-keyboard-shortcuts';
import { useTouchGestures } from './hooks/use-touch-gestures';
import { useVideoControls } from './hooks/use-video-controls';
import { useViewTracking } from './hooks/use-view-tracking';
import {
  COMPLETION_THRESHOLD,
  PROGRESS_SAVE_INTERVAL,
  type VideoChapter,
  type VideoPlayerProps,
  type VideoProgress,
  type VideoState,
} from './types';

export function VideoPlayer({
  url,
  title,
  videoId,
  organizationSlug,
  thumbnailUrl,
  initialProgress = 0,
  chapters = [],
  captionTracks: customCaptionTracks,
  onProgress,
  onEnded,
  onError,
  onTimeUpdate,
  registerSeek,
  registerPlay,
  onRefreshUrl,
  className,
}: VideoPlayerProps) {
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const progressCallbackRef = useRef(onProgress);
  const lastProgressSaveRef = useRef<number>(0);

  // State
  const [videoState, setVideoState] = useState<VideoState>('idle');
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
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [currentUrl, setCurrentUrl] = useState(url);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastPlaybackTimeRef = useRef<number>(0);

  // Update currentUrl if prop changes
  useEffect(() => {
    setCurrentUrl(url);
  }, [url]);

  // Keep callback ref up to date
  progressCallbackRef.current = onProgress;

  // Custom hooks
  const refs = { video: videoRef, container: containerRef, progressBar: progressBarRef };

  const controls = useVideoControls({
    refs,
    playing,
    muted,
    isLooping,
    currentTime,
    setCurrentTime,
    setPlaying,
    setMuted,
    setVolume,
    setPlaybackRate,
    setIsFullscreen,
    setIsPiP,
    setIsLooping,
    setVideoState,
    setErrorMessage,
  });

  const captions = useCaptions({
    videoRef,
    videoId,
    customCaptionTracks,
  });

  const { hasTrackedView, trackView } = useViewTracking({
    videoRef,
    videoId,
    playing,
  });

  // Mini-player registration
  const { registerVideo, updateRegisteredVideo, unregisterVideo, shouldShowForVideo, deactivateMiniPlayer } =
    useMiniPlayer();

  // Check if this video is already playing in mini-player
  const isInMiniPlayer = videoId ? shouldShowForVideo(videoId) : false;

  // Deactivate mini-player if we're on the same video page
  useEffect(() => {
    if (isInMiniPlayer) {
      deactivateMiniPlayer();
    }
  }, [isInMiniPlayer, deactivateMiniPlayer]);

  // Register/update video with mini-player when playing
  useEffect(() => {
    if (!videoId || !organizationSlug || !url) return;

    if (playing && duration > 0) {
      registerVideo({
        videoUrl: url,
        videoId,
        title,
        organizationSlug,
        thumbnailUrl,
        currentTime,
        duration,
        playing,
        volume,
        muted,
      });
    } else if (!playing) {
      unregisterVideo();
    }
  }, [
    playing,
    videoId,
    organizationSlug,
    url,
    title,
    thumbnailUrl,
    currentTime,
    duration,
    volume,
    muted,
    registerVideo,
    unregisterVideo,
  ]);

  // Update registered video state on time/volume changes
  useEffect(() => {
    if (playing && videoId && organizationSlug) {
      updateRegisteredVideo({
        currentTime,
        volume,
        muted,
        playing,
      });
    }
  }, [currentTime, volume, muted, playing, videoId, organizationSlug, updateRegisteredVideo]);

  const isTouchDevice = useTouch();
  const { feedback: touchFeedback } = useTouchGestures({
    containerRef,
    onDoubleTapLeft: controls.seekBackward,
    onDoubleTapRight: controls.seekForward,
    onSingleTap: controls.togglePlay,
    enabled: isTouchDevice,
  });

  useKeyboardShortcuts({
    containerRef,
    duration,
    volume,
    togglePlay: controls.togglePlay,
    seekForward: controls.seekForward,
    seekBackward: controls.seekBackward,
    seek: controls.seek,
    handleVolumeChange: controls.handleVolumeChange,
    toggleFullscreen: controls.toggleFullscreen,
    toggleMute: controls.toggleMute,
    togglePictureInPicture: controls.togglePictureInPicture,
    toggleLoop: controls.toggleLoop,
    toggleCaptions: captions.toggleCaptions,
    setShowKeyboardHelp,
  });

  // Register seek function for external control
  useEffect(() => {
    registerSeek?.(controls.seek);
  }, [registerSeek, controls.seek]);

  // Register play function for external control
  useEffect(() => {
    registerPlay?.(controls.play);
  }, [registerPlay, controls.play]);

  // Find current chapter
  const currentChapter = useMemo((): VideoChapter | null => {
    if (!chapters.length || !duration) return null;
    return (
      chapters.find((chapter, index) => {
        const nextChapter = chapters[index + 1];
        const endTime = chapter.endTime || nextChapter?.startTime || duration;
        return currentTime >= chapter.startTime && currentTime < endTime;
      }) ?? null
    );
  }, [chapters, currentTime, duration]);

  // Progress reporting
  const reportProgress = useCallback(() => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;

    const progress: VideoProgress = {
      currentTime: video.currentTime,
      duration: video.duration,
      played: video.currentTime / video.duration,
      completed: video.currentTime / video.duration >= COMPLETION_THRESHOLD,
    };

    const now = Date.now();
    if (now - lastProgressSaveRef.current >= PROGRESS_SAVE_INTERVAL) {
      lastProgressSaveRef.current = now;
      progressCallbackRef.current?.(progress);
    }
  }, []);

  // Video event handlers
  const handleLoadStart = useCallback(() => {
    setVideoState('loading');
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    setDuration(video.duration);
    setVideoState('ready');

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

    // Track last successful playback position for recovery
    if (video.currentTime > 0) {
      lastPlaybackTimeRef.current = video.currentTime;
    }

    if (video.buffered.length > 0) {
      const bufferedEnd = video.buffered.end(video.buffered.length - 1);
      setBuffered((bufferedEnd / video.duration) * 100);
    }
  }, [reportProgress, onTimeUpdate]);

  const handlePlay = useCallback(() => {
    setPlaying(true);
    setVideoState('playing');
    if (!hasTrackedView && videoId) {
      trackView();
    }
  }, [hasTrackedView, videoId, trackView]);

  const handlePause = useCallback(() => {
    setPlaying(false);
    setVideoState('paused');
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
    setVideoState('ended');
    onEnded?.();
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

  const MAX_AUTO_RETRIES = 3;

  const handleRetry = useCallback(async () => {
    const video = videoRef.current;
    const resumeTime = lastPlaybackTimeRef.current;

    setVideoState('loading');
    setErrorMessage(null);

    // Try to refresh the URL if a refresh function is provided
    if (onRefreshUrl) {
      try {
        const newUrl = await onRefreshUrl();
        if (newUrl) {
          setCurrentUrl(newUrl);
        }
      } catch {
        // Continue with existing URL if refresh fails
      }
    }

    if (video) {
      video.load();
      // Resume from last position after reload
      const handleCanPlayOnce = () => {
        if (resumeTime > 0) {
          video.currentTime = resumeTime;
        }
        video.play().catch(() => {
          // Autoplay may be blocked, user will need to click play
        });
        video.removeEventListener('canplay', handleCanPlayOnce);
      };
      video.addEventListener('canplay', handleCanPlayOnce);
    }
  }, [onRefreshUrl]);

  const handleError = useCallback(() => {
    const video = videoRef.current;
    const errorMsg = video?.error?.message || 'Failed to load video';

    // Clear any existing retry timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }

    // Auto-retry with exponential backoff for recoverable errors
    if (retryCount < MAX_AUTO_RETRIES) {
      const delay = Math.min(1000 * 2 ** retryCount, 8000); // 1s, 2s, 4s, max 8s
      setVideoState('loading');
      setRetryCount((prev) => prev + 1);

      retryTimeoutRef.current = setTimeout(() => {
        handleRetry();
      }, delay);
    } else {
      // Max retries reached, show error to user
      setErrorMessage(errorMsg);
      setVideoState('error');
      onError?.(errorMsg);
    }
  }, [retryCount, handleRetry, onError]);

  const handleWaiting = useCallback(() => {
    setVideoState('loading');
  }, []);

  const handleCanPlay = useCallback(() => {
    if (videoState === 'loading') {
      setVideoState(playing ? 'playing' : 'ready');
    }
    // Reset retry count on successful playback
    setRetryCount(0);
  }, [videoState, playing]);

  const handleManualRetry = useCallback(() => {
    setRetryCount(0);
    handleRetry();
  }, [handleRetry]);

  const seekToChapter = useCallback(
    (chapter: VideoChapter) => {
      controls.seek(chapter.startTime);
    },
    [controls],
  );

  // Auto-hide controls
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
      container.addEventListener('mousemove', showControlsTemporarily);
      container.addEventListener('mouseenter', showControlsTemporarily);
      container.addEventListener('mouseleave', () => {
        if (playing) setShowControls(false);
      });
    }

    return () => {
      clearTimeout(timeout);
      if (container) {
        container.removeEventListener('mousemove', showControlsTemporarily);
        container.removeEventListener('mouseenter', showControlsTemporarily);
      }
    };
  }, [playing, isFullscreen]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // PiP listeners
  useEffect(() => {
    setPipSupported(document.pictureInPictureEnabled ?? false);

    const video = videoRef.current;
    if (!video) return;

    const handleEnterPiP = () => setIsPiP(true);
    const handleLeavePiP = () => setIsPiP(false);

    video.addEventListener('enterpictureinpicture', handleEnterPiP);
    video.addEventListener('leavepictureinpicture', handleLeavePiP);

    return () => {
      video.removeEventListener('enterpictureinpicture', handleEnterPiP);
      video.removeEventListener('leavepictureinpicture', handleLeavePiP);
    };
  }, []);

  // Cleanup retry timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  const showPlayButton = (videoState === 'ready' || videoState === 'paused' || videoState === 'idle') && !playing;

  return (
    <div
      ref={containerRef}
      className={cn('relative aspect-video bg-black rounded-lg overflow-hidden group', className)}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: role="application" makes this a valid interactive region for keyboard controls
      tabIndex={0}
      role="application"
      aria-label={`Video player: ${title}`}
    >
      {/* Video Element */}
      {/* biome-ignore lint/a11y/useMediaCaption: Captions are dynamically provided via availableCaptionTracks */}
      <video
        ref={videoRef}
        src={currentUrl}
        poster={thumbnailUrl}
        className="w-full h-full object-contain"
        preload="metadata"
        playsInline
        crossOrigin="anonymous"
        onClick={controls.handleVideoClick}
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
        {captions.availableCaptionTracks.map((track) => (
          <track
            key={track.code}
            kind="captions"
            src={track.src}
            srcLang={track.code}
            label={track.label}
            default={track.default && captions.captionsEnabled}
          />
        ))}
      </video>

      {/* Overlays */}
      <LoadingOverlay visible={videoState === 'loading'} />
      <ErrorOverlay visible={videoState === 'error'} message={errorMessage} onRetry={handleManualRetry} />
      <PlayButtonOverlay visible={showPlayButton} onPlay={controls.togglePlay} />
      <ChapterDisplay chapter={currentChapter} visible={showControls} />
      <LoopIndicator isLooping={isLooping} />
      <KeyboardHelpModal visible={showKeyboardHelp} onClose={() => setShowKeyboardHelp(false)} />

      {/* Touch Skip Feedback */}
      {isTouchDevice && <TouchSkipFeedback feedback={touchFeedback} />}

      {/* Presence Indicator - Top Right */}
      {videoId && (
        <div
          className={cn(
            'absolute top-4 right-4 z-10',
            'transition-opacity duration-300',
            showControls || !playing ? 'opacity-100' : 'opacity-0',
          )}
        >
          <VideoPresence videoId={videoId} />
        </div>
      )}

      {/* Controls Overlay */}
      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 p-4',
          'bg-gradient-to-t from-black/80 via-black/40 to-transparent',
          'transition-opacity duration-300',
          showControls || !playing ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      >
        <VideoProgressBar
          progressBarRef={progressBarRef}
          videoUrl={url}
          duration={duration}
          currentTime={currentTime}
          buffered={buffered}
          chapters={chapters}
          onSeek={controls.seek}
          onSeekToChapter={seekToChapter}
        />

        <VideoControls
          playing={playing}
          currentTime={currentTime}
          duration={duration}
          volume={volume}
          muted={muted}
          playbackRate={playbackRate}
          isFullscreen={isFullscreen}
          isPiP={isPiP}
          pipSupported={pipSupported}
          isLooping={isLooping}
          captionsEnabled={captions.captionsEnabled}
          selectedCaptionTrack={captions.selectedCaptionTrack}
          availableCaptionTracks={captions.availableCaptionTracks}
          onTogglePlay={controls.togglePlay}
          onSeekForward={controls.seekForward}
          onSeekBackward={controls.seekBackward}
          onVolumeChange={controls.handleVolumeChange}
          onToggleMute={controls.toggleMute}
          onPlaybackRateChange={controls.handlePlaybackRateChange}
          onToggleFullscreen={controls.toggleFullscreen}
          onTogglePiP={controls.togglePictureInPicture}
          onToggleLoop={controls.toggleLoop}
          onSelectCaptionTrack={captions.selectCaptionTrack}
        />
      </div>
    </div>
  );
}
