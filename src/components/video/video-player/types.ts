/**
 * Video Player Types and Constants
 */

// =============================================================================
// Types
// =============================================================================

export interface VideoChapter {
  id: string;
  title: string;
  startTime: number;
  endTime?: number;
  summary?: string;
}

export interface CaptionTrack {
  code: string;
  label: string;
  src: string;
  default?: boolean;
}

export interface VideoPlayerProps {
  url: string;
  title: string;
  videoId?: string;
  /** Organization slug for mini-player navigation */
  organizationSlug?: string;
  thumbnailUrl?: string;
  initialProgress?: number;
  chapters?: VideoChapter[];
  captionTracks?: CaptionTrack[];
  onProgress?: (progress: VideoProgress) => void;
  onEnded?: () => void;
  onError?: (error: string) => void;
  onTimeUpdate?: (currentTime: number) => void;
  /** Callback to register the seek function for external control */
  registerSeek?: (seekFn: (time: number) => void) => void;
  /** Callback to register the play function for external control */
  registerPlay?: (playFn: () => void) => void;
  /** Optional function to refresh the video URL (for expired signed URLs) */
  onRefreshUrl?: () => Promise<string | null>;
  className?: string;
}

export interface VideoProgress {
  currentTime: number;
  duration: number;
  played: number;
  completed: boolean;
}

export type VideoState = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'ended' | 'error';

export interface VideoRefs {
  video: React.RefObject<HTMLVideoElement | null>;
  container: React.RefObject<HTMLDivElement | null>;
  progressBar: React.RefObject<HTMLDivElement | null>;
}

// =============================================================================
// Constants
// =============================================================================

export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
export const SKIP_SECONDS = 10;
export const PROGRESS_SAVE_INTERVAL = 5000;
export const COMPLETION_THRESHOLD = 0.9;
export const VIEW_TRACKING_INTERVAL = 30000;

export const KEYBOARD_SHORTCUTS = [
  { key: 'Space / K', action: 'Play / Pause' },
  { key: 'J / ←', action: 'Skip back 10s' },
  { key: 'L / →', action: 'Skip forward 10s' },
  { key: '↑ / ↓', action: 'Volume up / down' },
  { key: 'M', action: 'Mute / Unmute' },
  { key: 'F', action: 'Fullscreen' },
  { key: 'T', action: 'Theater mode' },
  { key: 'P', action: 'Picture-in-Picture' },
  { key: 'C', action: 'Toggle captions' },
  { key: 'R', action: 'Toggle loop' },
  { key: '0-9', action: 'Jump to 0-90%' },
  { key: 'Home / End', action: 'Start / End' },
] as const;
