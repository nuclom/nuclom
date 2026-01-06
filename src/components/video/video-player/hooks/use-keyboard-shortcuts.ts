'use client';

import { useEffect } from 'react';

interface UseKeyboardShortcutsOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  duration: number;
  volume: number;
  togglePlay: () => void;
  seekForward: () => void;
  seekBackward: () => void;
  seek: (time: number) => void;
  handleVolumeChange: (value: number[]) => void;
  toggleFullscreen: () => void;
  toggleMute: () => void;
  togglePictureInPicture: () => void;
  toggleLoop: () => void;
  toggleCaptions: () => void;
  setShowKeyboardHelp: (show: boolean | ((prev: boolean) => boolean)) => void;
}

export function useKeyboardShortcuts({
  containerRef,
  duration,
  volume,
  togglePlay,
  seekForward,
  seekBackward,
  seek,
  handleVolumeChange,
  toggleFullscreen,
  toggleMute,
  togglePictureInPicture,
  toggleLoop,
  toggleCaptions,
  setShowKeyboardHelp,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const container = containerRef.current;
      if (!container?.contains(document.activeElement) && document.activeElement !== document.body) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'arrowleft':
        case 'j':
          e.preventDefault();
          seekBackward();
          break;
        case 'arrowright':
        case 'l':
          e.preventDefault();
          seekForward();
          break;
        case 'arrowup':
          e.preventDefault();
          handleVolumeChange([Math.min(1, volume + 0.1)]);
          break;
        case 'arrowdown':
          e.preventDefault();
          handleVolumeChange([Math.max(0, volume - 0.1)]);
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'p':
          e.preventDefault();
          togglePictureInPicture();
          break;
        case 'c':
          e.preventDefault();
          toggleCaptions();
          break;
        case 'r':
          e.preventDefault();
          toggleLoop();
          break;
        case '?':
          e.preventDefault();
          setShowKeyboardHelp((prev: boolean) => !prev);
          break;
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          e.preventDefault();
          seek((Number.parseInt(e.key, 10) / 10) * duration);
          break;
        case 'home':
          e.preventDefault();
          seek(0);
          break;
        case 'end':
          e.preventDefault();
          seek(duration);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    containerRef,
    togglePlay,
    seekBackward,
    seekForward,
    handleVolumeChange,
    toggleFullscreen,
    toggleMute,
    togglePictureInPicture,
    toggleLoop,
    toggleCaptions,
    setShowKeyboardHelp,
    seek,
    volume,
    duration,
  ]);
}
