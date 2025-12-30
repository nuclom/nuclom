/**
 * Video Components
 *
 * Export all video-related components from this file.
 */

export {
  type CaptionTrack,
  type VideoChapter,
  VideoPlayer,
  type VideoPlayerProps,
  type VideoProgress,
} from "./video-player";
export {
  SimpleVideoPlayer,
  type SimpleVideoPlayerProps,
  VideoPlayerWithProgress,
  type VideoPlayerWithProgressProps,
} from "./video-player-with-progress";
export { TranscriptDisplay, type TranscriptDisplayProps } from "./transcript-display";
export { TranscriptEditor, type TranscriptEditorProps } from "./transcript-editor";
export {
  VideoDetailClient,
  type VideoDetailClientProps,
  VideoWithTranscript,
  type VideoWithTranscriptProps,
} from "./video-detail-client";
