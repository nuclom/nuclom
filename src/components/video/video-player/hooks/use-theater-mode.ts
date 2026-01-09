'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'video-theater-mode';

interface UseTheaterModeOptions {
  onToggle?: (isTheater: boolean) => void;
}

interface UseTheaterModeResult {
  isTheaterMode: boolean;
  toggleTheaterMode: () => void;
  exitTheaterMode: () => void;
}

export function useTheaterMode({ onToggle }: UseTheaterModeOptions = {}): UseTheaterModeResult {
  const [isTheaterMode, setIsTheaterMode] = useState(false);

  // Initialize from localStorage after mount (avoid SSR mismatch)
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') {
      setIsTheaterMode(true);
    }
  }, []);

  // Persist preference to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(isTheaterMode));
    onToggle?.(isTheaterMode);
  }, [isTheaterMode, onToggle]);

  // Escape key handler to exit theater mode
  useEffect(() => {
    if (!isTheaterMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsTheaterMode(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTheaterMode]);

  // Prevent body scroll when in theater mode
  useEffect(() => {
    if (isTheaterMode) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isTheaterMode]);

  const toggleTheaterMode = useCallback(() => {
    setIsTheaterMode((prev) => !prev);
  }, []);

  const exitTheaterMode = useCallback(() => {
    setIsTheaterMode(false);
  }, []);

  return {
    isTheaterMode,
    toggleTheaterMode,
    exitTheaterMode,
  };
}
