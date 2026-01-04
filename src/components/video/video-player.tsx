/**
 * Video Player Component
 *
 * Re-exported from video-player/ module for backwards compatibility.
 * The video player has been refactored into smaller components and hooks
 * for better maintainability.
 */

export {
  type CaptionTrack,
  ChapterDisplay,
  ErrorOverlay,
  formatTime,
  KeyboardHelpModal,
  LoadingOverlay,
  LoopIndicator,
  PlayButtonOverlay,
  useCaptions,
  useKeyboardShortcuts,
  useVideoControls,
  useViewTracking,
  type VideoChapter,
  VideoControls,
  VideoPlayer,
  type VideoPlayerProps,
  type VideoProgress,
  VideoProgressBar,
  type VideoState,
} from "./video-player/index";
