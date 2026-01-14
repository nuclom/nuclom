/**
 * Video Components
 *
 * Export all video-related components from this file.
 */

export { ChapteredTranscript, type ChapteredTranscriptProps } from './chaptered-transcript';
export {
  getSpeakerColor,
  type Speaker,
  SpeakerLegend,
  type SpeakerLegendProps,
} from './speaker-legend';
export {
  SpeakerTimeline,
  type SpeakerTimelineProps,
  type TimelineSegment,
} from './speaker-timeline';
export { TalkTimeChart, type TalkTimeChartProps } from './talk-time-chart';
export { TranscriptDisplay, type TranscriptDisplayProps } from './transcript-display';
export { TranscriptEditor, type TranscriptEditorProps } from './transcript-editor';
export { VideoActions, type VideoActionsProps } from './video-actions';
export {
  VideoDetailClient,
  type VideoDetailClientProps,
  VideoWithTranscript,
  type VideoWithTranscriptProps,
} from './video-detail-client';
export {
  type CaptionTrack,
  type VideoChapter,
  VideoPlayer,
  type VideoPlayerProps,
  type VideoProgress,
} from './video-player';
export {
  SimpleVideoPlayer,
  type SimpleVideoPlayerProps,
  VideoPlayerWithProgress,
  type VideoPlayerWithProgressProps,
} from './video-player-with-progress';
export { VideoPresence, type VideoPresenceProps } from './video-presence';
