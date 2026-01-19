'use client';

/**
 * Speaker Timeline Component
 *
 * Displays a visual timeline showing when each speaker talked during the video.
 * Users can click on timeline segments to seek to specific moments.
 */

import { cn } from '@nuclom/lib/utils';
import { Play } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getSpeakerColor, type Speaker } from './speaker-legend';

// =============================================================================
// Types
// =============================================================================

export interface TimelineSegment {
  /** Segment ID */
  id: string;
  /** Speaker ID */
  speakerId: string;
  /** Speaker label (e.g., "A", "B") */
  speakerLabel: string;
  /** Start time in seconds */
  startTime: number;
  /** End time in seconds */
  endTime: number;
  /** Segment text */
  text: string;
}

export interface SpeakerTimelineProps {
  /** List of speakers */
  speakers: Speaker[];
  /** Timeline segments */
  segments: TimelineSegment[];
  /** Total video duration in seconds */
  duration: number;
  /** Current playback time in seconds */
  currentTime?: number;
  /** Callback when a segment is clicked */
  onSeek?: (time: number) => void;
  /** Currently selected speaker ID (for filtering) */
  selectedSpeakerId?: string | null;
  /** Additional className */
  className?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// =============================================================================
// Timeline Row Component
// =============================================================================

interface TimelineRowProps {
  speaker: Speaker;
  segments: TimelineSegment[];
  duration: number;
  currentTime: number;
  speakerIndex: number;
  onSeek?: (time: number) => void;
  isHighlighted: boolean;
}

function TimelineRow({
  speaker,
  segments,
  duration,
  currentTime,
  speakerIndex,
  onSeek,
  isHighlighted,
}: TimelineRowProps) {
  const color = getSpeakerColor(speakerIndex);

  return (
    <div className={cn('flex items-center gap-3 py-1.5 transition-opacity', !isHighlighted && 'opacity-40')}>
      {/* Speaker label */}
      <div className="w-24 flex-shrink-0 truncate">
        <span className="text-xs font-medium">{speaker.displayName}</span>
      </div>

      {/* Timeline bar */}
      <div className="flex-1 relative h-6 bg-muted/50 rounded overflow-hidden">
        {/* Segments */}
        {segments.map((segment) => {
          const startPercent = (segment.startTime / duration) * 100;
          const widthPercent = ((segment.endTime - segment.startTime) / duration) * 100;
          const isCurrentSegment = currentTime >= segment.startTime && currentTime < segment.endTime;

          return (
            <TooltipProvider key={segment.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'absolute top-0 bottom-0 rounded-sm transition-all hover:brightness-110 cursor-pointer',
                      color.bg,
                      isCurrentSegment && 'ring-2 ring-white ring-offset-1',
                    )}
                    style={{
                      left: `${startPercent}%`,
                      width: `${Math.max(widthPercent, 0.5)}%`,
                    }}
                    onClick={() => onSeek?.(segment.startTime)}
                    aria-label={`${speaker.displayName} speaking from ${formatTime(segment.startTime)}`}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{speaker.displayName}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
                      </span>
                    </div>
                    <p className="text-xs line-clamp-2">{segment.text}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}

        {/* Current time indicator */}
        {currentTime > 0 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-primary z-10 pointer-events-none"
            style={{ left: `${(currentTime / duration) * 100}%` }}
          />
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function SpeakerTimeline({
  speakers,
  segments,
  duration,
  currentTime = 0,
  onSeek,
  selectedSpeakerId,
  className,
}: SpeakerTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);

  // Group segments by speaker
  const segmentsBySpeaker = useMemo(() => {
    const grouped = new Map<string, TimelineSegment[]>();
    for (const speaker of speakers) {
      grouped.set(speaker.id, []);
    }
    for (const segment of segments) {
      const speakerSegments = grouped.get(segment.speakerId);
      if (speakerSegments) {
        speakerSegments.push(segment);
      }
    }
    return grouped;
  }, [speakers, segments]);

  // Create speaker index map for consistent colors
  const speakerIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    speakers.forEach((speaker, index) => {
      map.set(speaker.id, index);
    });
    return map;
  }, [speakers]);

  // Handle click on the overall timeline
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !onSeek) return;

    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const time = percentage * duration;

    onSeek(Math.max(0, Math.min(time, duration)));
  };

  // Handle mouse move for time preview
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const percentage = mouseX / rect.width;
    const time = percentage * duration;

    setHoveredTime(Math.max(0, Math.min(time, duration)));
  };

  if (!speakers || speakers.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Play className="h-4 w-4" />
            Speaker Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm text-center py-8">No speaker data available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Play className="h-4 w-4" />
            Speaker Timeline
          </CardTitle>
          <span className="text-xs text-muted-foreground">{formatTime(duration)}</span>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Speaker timelines */}
        <div className="space-y-1">
          {speakers.map((speaker) => {
            const speakerSegments = segmentsBySpeaker.get(speaker.id) || [];
            const speakerIndex = speakerIndexMap.get(speaker.id) ?? 0;
            const isHighlighted = !selectedSpeakerId || selectedSpeakerId === speaker.id;

            return (
              <TimelineRow
                key={speaker.id}
                speaker={speaker}
                segments={speakerSegments}
                duration={duration}
                currentTime={currentTime}
                speakerIndex={speakerIndex}
                onSeek={onSeek}
                isHighlighted={isHighlighted}
              />
            );
          })}
        </div>

        {/* Combined timeline with click handler */}
        <div
          ref={containerRef}
          className="mt-4 relative h-2 bg-muted rounded-full cursor-pointer group"
          onClick={handleTimelineClick}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') {
              e.preventDefault();
              onSeek?.(Math.min(duration, currentTime + 5));
            } else if (e.key === 'ArrowLeft') {
              e.preventDefault();
              onSeek?.(Math.max(0, currentTime - 5));
            }
          }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredTime(null)}
          role="slider"
          aria-label="Video timeline"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={currentTime}
          tabIndex={0}
        >
          {/* Progress fill */}
          <div
            className="absolute top-0 bottom-0 left-0 bg-primary/30 rounded-full"
            style={{ width: `${(currentTime / duration) * 100}%` }}
          />

          {/* Current time indicator */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full shadow-md transition-transform group-hover:scale-110"
            style={{ left: `calc(${(currentTime / duration) * 100}% - 6px)` }}
          />

          {/* Hover time preview */}
          {hoveredTime !== null && (
            <div
              className="absolute -top-8 -translate-x-1/2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-md pointer-events-none"
              style={{ left: `${(hoveredTime / duration) * 100}%` }}
            >
              {formatTime(Math.floor(hoveredTime))}
            </div>
          )}
        </div>

        {/* Time markers */}
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-muted-foreground">0:00</span>
          <span className="text-[10px] text-muted-foreground">{formatTime(duration)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
