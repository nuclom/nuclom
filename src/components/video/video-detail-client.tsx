'use client';

/**
 * Video Detail Client Component
 *
 * Client-side wrapper for video detail page that provides:
 * - Interactive transcript with click-to-seek
 * - Current segment highlighting during playback
 * - Synced video player and transcript
 */

import { useCallback, useState } from 'react';
import type { TranscriptSegment, VideoChapter } from '@/lib/db/schema';
import { TranscriptDisplay } from './transcript-display';
import { VideoPlayerWithProgress } from './video-player-with-progress';

// =============================================================================
// Types
// =============================================================================

export interface VideoDetailClientProps {
  /** Video ID */
  videoId: string;
  /** Video URL */
  videoUrl: string;
  /** Video title */
  title: string;
  /** Thumbnail URL */
  thumbnailUrl?: string;
  /** Duration string (HH:MM:SS or MM:SS) */
  duration: string;
  /** Transcript segments */
  transcriptSegments: TranscriptSegment[];
  /** Video chapters */
  chapters: VideoChapter[];
  /** Processing status */
  processingStatus: string;
  /** Optional callback when video ends */
  onEnded?: () => void;
  /** Optional callback when a comment should be added at a segment */
  onAddComment?: (segment: TranscriptSegment) => void;
}

// =============================================================================
// Component
// =============================================================================

export function VideoDetailClient({
  videoId,
  videoUrl,
  title,
  thumbnailUrl,
  duration,
  transcriptSegments,
  chapters,
  processingStatus,
  onEnded,
  onAddComment,
}: VideoDetailClientProps) {
  // Track current playback time for transcript sync
  const [currentTime, setCurrentTime] = useState(0);
  const [_videoPlayerRef, _setVideoPlayerRef] = useState<HTMLVideoElement | null>(null);

  // Handle time updates from video player
  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  // Handle seeking when transcript segment is clicked
  const handleSeek = useCallback((time: number) => {
    // Find the video element and seek
    const videoElement = document.querySelector('video');
    if (videoElement) {
      videoElement.currentTime = time;
      if (videoElement.paused) {
        videoElement.play();
      }
    }
  }, []);

  // Format chapters for the video player
  const formattedChapters = chapters.map((c) => ({
    id: c.id,
    title: c.title,
    startTime: c.startTime,
    endTime: c.endTime ?? undefined,
    summary: c.summary ?? undefined,
  }));

  return (
    <div className="space-y-6">
      {/* Video Player */}
      <VideoPlayerWithProgress
        videoId={videoId}
        url={videoUrl}
        title={title}
        thumbnailUrl={thumbnailUrl}
        duration={duration}
        chapters={formattedChapters}
        onEnded={onEnded}
        onTimeUpdate={handleTimeUpdate}
      />

      {/* Interactive Transcript */}
      {transcriptSegments && transcriptSegments.length > 0 && (
        <TranscriptDisplay
          segments={transcriptSegments}
          currentTime={currentTime}
          onSeek={handleSeek}
          onAddComment={onAddComment}
          autoScroll={true}
          processingStatus={processingStatus as 'pending' | 'transcribing' | 'analyzing' | 'completed' | 'failed'}
          maxHeight="24rem"
        />
      )}
    </div>
  );
}

// =============================================================================
// Compact Video Player with Transcript Panel
// =============================================================================

export interface VideoWithTranscriptProps {
  /** Video ID */
  videoId: string;
  /** Video URL */
  videoUrl: string;
  /** Video title */
  title: string;
  /** Thumbnail URL */
  thumbnailUrl?: string;
  /** Duration string */
  duration: string;
  /** Transcript segments */
  transcriptSegments: TranscriptSegment[];
  /** Video chapters */
  chapters?: VideoChapter[];
  /** Processing status */
  processingStatus?: string;
  /** Layout: side-by-side or stacked */
  layout?: 'side-by-side' | 'stacked';
  /** Optional className */
  className?: string;
}

export function VideoWithTranscript({
  videoId,
  videoUrl,
  title,
  thumbnailUrl,
  duration,
  transcriptSegments,
  chapters = [],
  processingStatus = 'completed',
  layout = 'side-by-side',
  className,
}: VideoWithTranscriptProps) {
  const [currentTime, setCurrentTime] = useState(0);

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleSeek = useCallback((time: number) => {
    const videoElement = document.querySelector('video');
    if (videoElement) {
      videoElement.currentTime = time;
      if (videoElement.paused) {
        videoElement.play();
      }
    }
  }, []);

  const formattedChapters = chapters.map((c) => ({
    id: c.id,
    title: c.title,
    startTime: c.startTime,
    endTime: c.endTime ?? undefined,
    summary: c.summary ?? undefined,
  }));

  if (layout === 'side-by-side') {
    return (
      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${className || ''}`}>
        {/* Video Player */}
        <div>
          <VideoPlayerWithProgress
            videoId={videoId}
            url={videoUrl}
            title={title}
            thumbnailUrl={thumbnailUrl}
            duration={duration}
            chapters={formattedChapters}
            onTimeUpdate={handleTimeUpdate}
          />
        </div>

        {/* Transcript Panel */}
        <div>
          <TranscriptDisplay
            segments={transcriptSegments}
            currentTime={currentTime}
            onSeek={handleSeek}
            autoScroll={true}
            processingStatus={processingStatus as 'pending' | 'transcribing' | 'analyzing' | 'completed' | 'failed'}
            maxHeight="400px"
          />
        </div>
      </div>
    );
  }

  // Stacked layout
  return (
    <div className={`space-y-6 ${className || ''}`}>
      <VideoPlayerWithProgress
        videoId={videoId}
        url={videoUrl}
        title={title}
        thumbnailUrl={thumbnailUrl}
        duration={duration}
        chapters={formattedChapters}
        onTimeUpdate={handleTimeUpdate}
      />

      <TranscriptDisplay
        segments={transcriptSegments}
        currentTime={currentTime}
        onSeek={handleSeek}
        autoScroll={true}
        processingStatus={processingStatus as 'pending' | 'transcribing' | 'analyzing' | 'completed' | 'failed'}
        maxHeight="24rem"
      />
    </div>
  );
}
