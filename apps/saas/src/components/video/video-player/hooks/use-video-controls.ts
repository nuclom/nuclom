'use client';

import { logger } from '@nuclom/lib/client-logger';
import { useCallback, useRef } from 'react';
import type { VideoRefs } from '../types';

interface UseVideoControlsOptions {
  refs: VideoRefs;
  playing: boolean;
  muted: boolean;
  isLooping: boolean;
  currentTime: number;
  setCurrentTime: (time: number) => void;
  setPlaying: (playing: boolean) => void;
  setMuted: (muted: boolean) => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  setIsFullscreen: (isFullscreen: boolean) => void;
  setIsPiP: (isPiP: boolean) => void;
  setIsLooping: (isLooping: boolean) => void;
  setVideoState: (state: 'error') => void;
  setErrorMessage: (message: string) => void;
}

export function useVideoControls({
  refs,
  playing,
  muted,
  isLooping,
  currentTime,
  setCurrentTime,
  setPlaying: _setPlaying,
  setMuted,
  setVolume,
  setPlaybackRate,
  setIsFullscreen,
  setIsPiP,
  setIsLooping,
  setVideoState,
  setErrorMessage,
}: UseVideoControlsOptions) {
  const lastClickRef = useRef<number>(0);
  const SKIP_SECONDS = 10;

  const togglePlay = useCallback(() => {
    const video = refs.video.current;
    if (!video) return;

    if (playing) {
      video.pause();
    } else {
      video.play().catch((err) => {
        logger.error('Failed to play video', err);
        setErrorMessage('Failed to play video');
        setVideoState('error');
      });
    }
  }, [playing, refs.video, setErrorMessage, setVideoState]);

  const play = useCallback(() => {
    const video = refs.video.current;
    if (!video || playing) return;

    video.play().catch((err) => {
      logger.error('Failed to play video', err);
      setErrorMessage('Failed to play video');
      setVideoState('error');
    });
  }, [playing, refs.video, setErrorMessage, setVideoState]);

  const seek = useCallback(
    (time: number) => {
      const video = refs.video.current;
      if (!video || !Number.isFinite(video.duration)) return;

      const newTime = Math.max(0, Math.min(time, video.duration));
      video.currentTime = newTime;
      setCurrentTime(newTime);
    },
    [refs.video, setCurrentTime],
  );

  const seekForward = useCallback(() => {
    seek(currentTime + SKIP_SECONDS);
  }, [currentTime, seek]);

  const seekBackward = useCallback(() => {
    seek(currentTime - SKIP_SECONDS);
  }, [currentTime, seek]);

  const handleVolumeChange = useCallback(
    (value: number[]) => {
      const newVolume = value[0];
      const video = refs.video.current;
      if (!video) return;

      video.volume = newVolume;
      setVolume(newVolume);
      setMuted(newVolume === 0);
    },
    [refs.video, setVolume, setMuted],
  );

  const toggleMute = useCallback(() => {
    const video = refs.video.current;
    if (!video) return;

    const newMuted = !muted;
    video.muted = newMuted;
    setMuted(newMuted);
  }, [muted, refs.video, setMuted]);

  const handlePlaybackRateChange = useCallback(
    (rate: number) => {
      const video = refs.video.current;
      if (!video) return;

      video.playbackRate = rate;
      setPlaybackRate(rate);
    },
    [refs.video, setPlaybackRate],
  );

  const toggleFullscreen = useCallback(async () => {
    const container = refs.container.current;
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
      logger.error('Fullscreen error', err);
    }
  }, [refs.container, setIsFullscreen]);

  const togglePictureInPicture = useCallback(async () => {
    const video = refs.video.current;
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
      logger.error('Picture-in-Picture error', err);
    }
  }, [refs.video, setIsPiP]);

  const toggleLoop = useCallback(() => {
    const video = refs.video.current;
    if (!video) return;

    const newLoopState = !isLooping;
    video.loop = newLoopState;
    setIsLooping(newLoopState);
  }, [isLooping, refs.video, setIsLooping]);

  const handleVideoClick = useCallback(() => {
    const now = Date.now();
    const timeDiff = now - lastClickRef.current;

    if (timeDiff < 300) {
      toggleFullscreen();
      lastClickRef.current = 0;
    } else {
      togglePlay();
      lastClickRef.current = now;
    }
  }, [toggleFullscreen, togglePlay]);

  return {
    togglePlay,
    play,
    seek,
    seekForward,
    seekBackward,
    handleVolumeChange,
    toggleMute,
    handlePlaybackRateChange,
    toggleFullscreen,
    togglePictureInPicture,
    toggleLoop,
    handleVideoClick,
  };
}
