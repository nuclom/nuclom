'use client';

import { useCallback, useState } from 'react';
import type { VideoChapter } from '../types';
import { formatTime } from '../utils';

interface VideoProgressBarProps {
  progressBarRef: React.RefObject<HTMLDivElement | null>;
  duration: number;
  currentTime: number;
  buffered: number;
  chapters: VideoChapter[];
  onSeek: (time: number) => void;
  onSeekToChapter: (chapter: VideoChapter) => void;
}

export function VideoProgressBar({
  progressBarRef,
  duration,
  currentTime,
  buffered,
  chapters,
  onSeek,
  onSeekToChapter,
}: VideoProgressBarProps) {
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleProgressHover = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const progressBar = progressBarRef.current;
      if (!progressBar || !duration) return;

      const rect = progressBar.getBoundingClientRect();
      const position = (e.clientX - rect.left) / rect.width;
      const time = position * duration;

      setHoverTime(Math.max(0, Math.min(time, duration)));
      setHoverPosition(e.clientX - rect.left);
    },
    [duration, progressBarRef],
  );

  const handleProgressLeave = useCallback(() => {
    setHoverTime(null);
  }, []);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const progressBar = progressBarRef.current;
      if (!progressBar || !duration) return;

      const rect = progressBar.getBoundingClientRect();
      const position = (e.clientX - rect.left) / rect.width;
      const newTime = position * duration;

      onSeek(Math.max(0, Math.min(newTime, duration)));
    },
    [duration, onSeek, progressBarRef],
  );

  const getHoveredChapter = () => {
    if (hoverTime === null || !chapters.length) return null;
    return chapters.find((c, i) => {
      const nextChapter = chapters[i + 1];
      const endTime = c.endTime || nextChapter?.startTime || duration;
      return hoverTime >= c.startTime && hoverTime < endTime;
    });
  };

  return (
    // biome-ignore lint/a11y/useFocusableInteractive: Keyboard navigation handled by parent container
    // biome-ignore lint/a11y/useKeyWithClickEvents: Keyboard navigation handled by parent container
    <div
      ref={progressBarRef}
      className="relative mb-3 h-1.5 bg-white/30 rounded-full cursor-pointer group/progress hover:h-2.5 transition-all"
      onClick={handleProgressClick}
      onMouseMove={handleProgressHover}
      onMouseLeave={handleProgressLeave}
      role="slider"
      aria-label="Video progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
    >
      {/* Buffered Progress */}
      <div
        className="absolute top-0 left-0 h-full bg-white/40 rounded-full transition-all"
        style={{ width: `${buffered}%` }}
      />

      {/* Played Progress */}
      <div
        className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all"
        style={{ width: `${progress}%` }}
      />

      {/* Progress Handle */}
      <div
        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full shadow-md opacity-0 group-hover/progress:opacity-100 transition-opacity"
        style={{ left: `calc(${progress}% - 6px)` }}
      />

      {/* Chapter Markers */}
      {chapters.map((chapter) => {
        const chapterPosition = duration > 0 ? (chapter.startTime / duration) * 100 : 0;
        return (
          <button
            key={chapter.id}
            type="button"
            className="absolute top-1/2 -translate-y-1/2 w-1 h-3 bg-white/80 rounded-sm hover:bg-white hover:scale-125 transition-transform z-10"
            style={{ left: `${chapterPosition}%` }}
            onClick={(e) => {
              e.stopPropagation();
              onSeekToChapter(chapter);
            }}
            title={chapter.title}
            aria-label={`Jump to chapter: ${chapter.title}`}
          />
        );
      })}

      {/* Hover Time Preview */}
      {hoverTime !== null && (
        <div
          className="absolute -top-10 px-2 py-1 bg-black/90 text-white text-xs rounded pointer-events-none whitespace-nowrap transform -translate-x-1/2"
          style={{ left: hoverPosition }}
        >
          {formatTime(hoverTime)}
          {chapters.length > 0 && (
            <span className="block text-white/60 text-[10px]">{getHoveredChapter()?.title || ''}</span>
          )}
        </div>
      )}
    </div>
  );
}
