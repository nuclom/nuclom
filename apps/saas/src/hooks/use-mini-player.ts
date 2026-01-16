'use client';

import * as React from 'react';

// =============================================================================
// Types
// =============================================================================

export interface MiniPlayerState {
  isActive: boolean;
  videoUrl: string | null;
  videoId: string | null;
  title: string | null;
  organizationSlug: string | null;
  thumbnailUrl: string | null;
  currentTime: number;
  duration: number;
  playing: boolean;
  volume: number;
  muted: boolean;
}

export interface MiniPlayerConfig {
  videoUrl: string;
  videoId: string;
  title: string;
  organizationSlug: string;
  thumbnailUrl?: string;
  currentTime: number;
  duration: number;
  playing: boolean;
  volume: number;
  muted: boolean;
}

type ActionType =
  | { type: 'ACTIVATE'; config: MiniPlayerConfig }
  | { type: 'DEACTIVATE' }
  | { type: 'UPDATE_TIME'; currentTime: number }
  | { type: 'SET_PLAYING'; playing: boolean }
  | { type: 'SET_VOLUME'; volume: number; muted: boolean }
  | { type: 'SET_DURATION'; duration: number };

// =============================================================================
// State Management
// =============================================================================

const initialState: MiniPlayerState = {
  isActive: false,
  videoUrl: null,
  videoId: null,
  title: null,
  organizationSlug: null,
  thumbnailUrl: null,
  currentTime: 0,
  duration: 0,
  playing: false,
  volume: 1,
  muted: false,
};

function reducer(state: MiniPlayerState, action: ActionType): MiniPlayerState {
  switch (action.type) {
    case 'ACTIVATE':
      return {
        isActive: true,
        videoUrl: action.config.videoUrl,
        videoId: action.config.videoId,
        title: action.config.title,
        organizationSlug: action.config.organizationSlug,
        thumbnailUrl: action.config.thumbnailUrl ?? null,
        currentTime: action.config.currentTime,
        duration: action.config.duration,
        playing: action.config.playing,
        volume: action.config.volume,
        muted: action.config.muted,
      };
    case 'DEACTIVATE':
      return initialState;
    case 'UPDATE_TIME':
      return { ...state, currentTime: action.currentTime };
    case 'SET_PLAYING':
      return { ...state, playing: action.playing };
    case 'SET_VOLUME':
      return { ...state, volume: action.volume, muted: action.muted };
    case 'SET_DURATION':
      return { ...state, duration: action.duration };
    default:
      return state;
  }
}

// =============================================================================
// Global State (Closure Pattern)
// =============================================================================

const listeners: Array<(state: MiniPlayerState) => void> = [];
let memoryState: MiniPlayerState = initialState;

// Store the current video registration for activation on route change
let pendingVideoConfig: MiniPlayerConfig | null = null;

function dispatch(action: ActionType) {
  memoryState = reducer(memoryState, action);
  for (const listener of listeners) {
    listener(memoryState);
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Register a video for potential mini-player activation
 * Called by VideoPlayer when playing
 */
function registerVideo(config: MiniPlayerConfig) {
  pendingVideoConfig = config;
}

/**
 * Update the registered video's state
 */
function updateRegisteredVideo(updates: Partial<MiniPlayerConfig>) {
  if (pendingVideoConfig) {
    pendingVideoConfig = { ...pendingVideoConfig, ...updates };
  }
}

/**
 * Clear the registered video
 * Called when video ends or is paused
 */
function unregisterVideo() {
  pendingVideoConfig = null;
}

/**
 * Activate mini-player with the registered video
 * Called on route change detection
 */
function activateMiniPlayer(): boolean {
  if (pendingVideoConfig?.playing) {
    dispatch({ type: 'ACTIVATE', config: pendingVideoConfig });
    pendingVideoConfig = null;
    return true;
  }
  return false;
}

/**
 * Deactivate mini-player
 */
function deactivateMiniPlayer() {
  dispatch({ type: 'DEACTIVATE' });
}

/**
 * Update playback time
 */
function updateTime(currentTime: number) {
  dispatch({ type: 'UPDATE_TIME', currentTime });
}

/**
 * Set playing state
 */
function setPlaying(playing: boolean) {
  dispatch({ type: 'SET_PLAYING', playing });
}

/**
 * Set volume state
 */
function setVolume(volume: number, muted: boolean) {
  dispatch({ type: 'SET_VOLUME', volume, muted });
}

/**
 * Get the URL to navigate to when expanding
 */
function getExpandUrl(): string | null {
  if (!memoryState.isActive || !memoryState.organizationSlug || !memoryState.videoId) {
    return null;
  }
  const time = Math.floor(memoryState.currentTime);
  return `/org/${memoryState.organizationSlug}/videos/${memoryState.videoId}?t=${time}`;
}

/**
 * Check if mini-player should be shown for this video
 */
function shouldShowForVideo(videoId: string): boolean {
  return memoryState.isActive && memoryState.videoId === videoId;
}

// =============================================================================
// React Hook
// =============================================================================

export function useMiniPlayer() {
  const [state, setState] = React.useState<MiniPlayerState>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, []);

  return {
    state,
    registerVideo,
    updateRegisteredVideo,
    unregisterVideo,
    activateMiniPlayer,
    deactivateMiniPlayer,
    updateTime,
    setPlaying,
    setVolume,
    getExpandUrl,
    shouldShowForVideo,
  };
}

// Export for imperative use outside React
export const miniPlayer = {
  getState: () => memoryState,
  registerVideo,
  updateRegisteredVideo,
  unregisterVideo,
  activateMiniPlayer,
  deactivateMiniPlayer,
  updateTime,
  setPlaying,
  setVolume,
  getExpandUrl,
  shouldShowForVideo,
};
