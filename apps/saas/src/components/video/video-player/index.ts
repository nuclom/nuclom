/**
 * Video Player Module
 *
 * A feature-rich video player with chapters, captions, keyboard shortcuts,
 * progress tracking, and view analytics.
 */

export { KeyboardHelpModal } from './components/keyboard-help-modal';
// Sub-components (for advanced customization)
export { VideoControls } from './components/video-controls';
export {
  ChapterDisplay,
  ErrorOverlay,
  LoadingOverlay,
  LoopIndicator,
  PlayButtonOverlay,
} from './components/video-overlays';
export { VideoProgressBar } from './components/video-progress-bar';
// Hooks (for building custom video players)
export { useCaptions } from './hooks/use-captions';
export { useKeyboardShortcuts } from './hooks/use-keyboard-shortcuts';
export { useVideoControls } from './hooks/use-video-controls';
export { useViewTracking } from './hooks/use-view-tracking';
export type {
  CaptionTrack,
  VideoChapter,
  VideoPlayerProps,
  VideoProgress,
  VideoState,
} from './types';
// Utilities
export { formatTime } from './utils';
export { VideoPlayer } from './video-player';
