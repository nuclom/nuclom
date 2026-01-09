'use client';

/**
 * Chaptered Transcript Component
 *
 * Displays transcript segments grouped by video chapters with:
 * - Chapter headers as collapsible groups
 * - Real-time highlighting of current segment during playback
 * - Auto-scroll to current segment
 * - Click to seek functionality
 * - Search across all segments
 */

import { ChevronDown, ChevronRight, FileText, Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { TranscriptSegment } from '@/lib/db/schema';
import { formatTime } from '@/lib/format-utils';
import { findSegmentIndexByTime } from '@/lib/subtitles';
import { cn } from '@/lib/utils';
import type { VideoChapter } from './video-player/types';

// =============================================================================
// Types
// =============================================================================

export interface ChapteredTranscriptProps {
  /** Video chapters */
  chapters: VideoChapter[];
  /** Transcript segments */
  segments: TranscriptSegment[];
  /** Current playback time in seconds */
  currentTime: number;
  /** Total video duration in seconds */
  duration: number;
  /** Callback when seeking to a time */
  onSeek?: (time: number) => void;
  /** Processing status */
  processingStatus?: 'pending' | 'transcribing' | 'analyzing' | 'completed' | 'failed';
  /** Optional className */
  className?: string;
}

interface ChapterGroup {
  chapter: VideoChapter | null;
  segments: TranscriptSegment[];
  startTime: number;
  endTime: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

function groupSegmentsByChapter(
  segments: TranscriptSegment[],
  chapters: VideoChapter[],
  duration: number,
): ChapterGroup[] {
  if (chapters.length === 0) {
    // No chapters - return all segments in a single group
    return [
      {
        chapter: null,
        segments,
        startTime: 0,
        endTime: duration,
      },
    ];
  }

  // Sort chapters by start time
  const sortedChapters = [...chapters].sort((a, b) => a.startTime - b.startTime);
  const groups: ChapterGroup[] = [];

  // Handle segments before first chapter
  const firstChapterStart = sortedChapters[0].startTime;
  const beforeFirstChapter = segments.filter((s) => s.startTime < firstChapterStart);
  if (beforeFirstChapter.length > 0) {
    groups.push({
      chapter: null,
      segments: beforeFirstChapter,
      startTime: 0,
      endTime: firstChapterStart,
    });
  }

  // Group segments by chapter
  for (let i = 0; i < sortedChapters.length; i++) {
    const chapter = sortedChapters[i];
    const nextChapter = sortedChapters[i + 1];
    const chapterEnd = chapter.endTime ?? nextChapter?.startTime ?? duration;

    const chapterSegments = segments.filter((s) => s.startTime >= chapter.startTime && s.startTime < chapterEnd);

    groups.push({
      chapter,
      segments: chapterSegments,
      startTime: chapter.startTime,
      endTime: chapterEnd,
    });
  }

  return groups;
}

function highlightSearchTerm(text: string, searchTerm: string): React.ReactNode {
  if (!searchTerm.trim()) return text;

  const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));

  return parts.map((part, index) =>
    part.toLowerCase() === searchTerm.toLowerCase() ? (
      <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

// =============================================================================
// Segment Item Component
// =============================================================================

interface SegmentItemProps {
  segment: TranscriptSegment;
  index: number;
  isActive: boolean;
  searchTerm: string;
  onSeek?: (time: number) => void;
}

function SegmentItem({ segment, index, isActive, searchTerm, onSeek }: SegmentItemProps) {
  return (
    <div
      id={`transcript-segment-${index}`}
      className={cn(
        'group relative flex gap-2 sm:gap-4 p-2 sm:p-2.5 rounded-md transition-colors cursor-pointer',
        isActive ? 'bg-primary/10 border-l-2 border-primary' : 'hover:bg-muted/50 border-l-2 border-transparent',
      )}
      onClick={() => onSeek?.(segment.startTime)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSeek?.(segment.startTime);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`Jump to ${formatTime(segment.startTime)}`}
    >
      <span
        className={cn(
          'font-mono text-[11px] sm:text-xs w-10 sm:w-12 shrink-0',
          isActive ? 'text-primary font-medium' : 'text-muted-foreground',
        )}
      >
        {formatTime(segment.startTime)}
      </span>
      <p className={cn('flex-1 text-sm leading-relaxed', isActive && 'font-medium')}>
        {highlightSearchTerm(segment.text, searchTerm)}
      </p>
    </div>
  );
}

// =============================================================================
// Chapter Group Component
// =============================================================================

interface ChapterGroupItemProps {
  group: ChapterGroup;
  segments: TranscriptSegment[];
  currentSegmentIndex: number;
  searchTerm: string;
  isCurrentChapter: boolean;
  defaultExpanded: boolean;
  onSeek?: (time: number) => void;
}

function ChapterGroupItem({
  group,
  segments,
  currentSegmentIndex,
  searchTerm,
  isCurrentChapter,
  defaultExpanded,
  onSeek,
}: ChapterGroupItemProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Auto-expand when chapter becomes current
  useEffect(() => {
    if (isCurrentChapter && !isExpanded) {
      setIsExpanded(true);
    }
  }, [isCurrentChapter, isExpanded]);

  if (!group.chapter) {
    // No chapter header - just render segments
    return (
      <div className="space-y-0.5">
        {group.segments.map((segment) => {
          const originalIndex = segments.findIndex((s) => s.startTime === segment.startTime && s.text === segment.text);
          return (
            <SegmentItem
              key={`${segment.startTime}-${originalIndex}`}
              segment={segment}
              index={originalIndex}
              isActive={currentSegmentIndex === originalIndex}
              searchTerm={searchTerm}
              onSeek={onSeek}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="mb-2">
      {/* Chapter Header */}
      <button
        type="button"
        className={cn(
          'w-full flex items-center gap-2 p-2.5 rounded-lg transition-colors text-left',
          isCurrentChapter ? 'bg-primary/15 text-primary' : 'bg-muted/50 hover:bg-muted text-foreground',
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{group.chapter.title}</span>
            <span className="text-xs text-muted-foreground font-mono shrink-0">{formatTime(group.startTime)}</span>
          </div>
          {group.chapter.summary && !isExpanded && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{group.chapter.summary}</p>
          )}
        </div>
        {isCurrentChapter && <div className="h-2 w-2 rounded-full bg-primary shrink-0" />}
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-background/50"
          onClick={(e) => {
            e.stopPropagation();
            onSeek?.(group.startTime);
          }}
        >
          Jump
        </button>
      </button>

      {/* Chapter Segments */}
      {isExpanded && group.segments.length > 0 && (
        <div className="ml-4 mt-1 border-l border-border pl-2 space-y-0.5">
          {group.segments.map((segment) => {
            const originalIndex = segments.findIndex(
              (s) => s.startTime === segment.startTime && s.text === segment.text,
            );
            return (
              <SegmentItem
                key={`${segment.startTime}-${originalIndex}`}
                segment={segment}
                index={originalIndex}
                isActive={currentSegmentIndex === originalIndex}
                searchTerm={searchTerm}
                onSeek={onSeek}
              />
            );
          })}
        </div>
      )}

      {isExpanded && group.segments.length === 0 && (
        <p className="ml-6 mt-1 text-xs text-muted-foreground italic">No transcript for this chapter</p>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function ChapteredTranscript({
  chapters,
  segments,
  currentTime,
  duration,
  onSeek,
  processingStatus,
  className,
}: ChapteredTranscriptProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [userHasScrolled, setUserHasScrolled] = useState(false);

  // Group segments by chapter
  const chapterGroups = useMemo(
    () => groupSegmentsByChapter(segments, chapters, duration),
    [segments, chapters, duration],
  );

  // Find current segment index
  const currentSegmentIndex = useMemo(() => {
    if (!segments || segments.length === 0) return -1;
    return findSegmentIndexByTime(segments, currentTime);
  }, [segments, currentTime]);

  // Find current chapter
  const currentChapterId = useMemo(() => {
    if (chapters.length === 0) return null;
    const sortedChapters = [...chapters].sort((a, b) => a.startTime - b.startTime);
    for (let i = sortedChapters.length - 1; i >= 0; i--) {
      if (currentTime >= sortedChapters[i].startTime) {
        return sortedChapters[i].id;
      }
    }
    return null;
  }, [chapters, currentTime]);

  // Filter segments by search term
  const filteredGroups = useMemo(() => {
    if (!searchTerm.trim()) return chapterGroups;

    return chapterGroups
      .map((group) => ({
        ...group,
        segments: group.segments.filter((s) => s.text.toLowerCase().includes(searchTerm.toLowerCase())),
      }))
      .filter((group) => group.segments.length > 0 || !group.chapter);
  }, [chapterGroups, searchTerm]);

  // Count search matches
  const searchMatchCount = useMemo(() => {
    if (!searchTerm.trim()) return 0;
    return filteredGroups.reduce((acc, group) => acc + group.segments.length, 0);
  }, [filteredGroups, searchTerm]);

  // Auto-scroll to current segment
  useEffect(() => {
    if (userHasScrolled || currentSegmentIndex < 0) return;

    const element = document.getElementById(`transcript-segment-${currentSegmentIndex}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentSegmentIndex, userHasScrolled]);

  // Reset user scroll flag when playback jumps
  const lastTimeRef = useRef(currentTime);
  useEffect(() => {
    const timeDiff = Math.abs(currentTime - lastTimeRef.current);
    if (timeDiff > 5) {
      setUserHasScrolled(false);
    }
    lastTimeRef.current = currentTime;
  }, [currentTime]);

  // Handle scroll to detect user scrolling
  const handleScroll = useCallback(() => {
    setUserHasScrolled(true);
  }, []);

  // Reset scroll flag after inactivity
  useEffect(() => {
    if (!userHasScrolled) return;
    const timeout = setTimeout(() => setUserHasScrolled(false), 3000);
    return () => clearTimeout(timeout);
  }, [userHasScrolled]);

  // Handle seek with scroll reset
  const handleSeek = useCallback(
    (time: number) => {
      setUserHasScrolled(false);
      onSeek?.(time);
    },
    [onSeek],
  );

  // Loading state
  if (processingStatus === 'pending' || processingStatus === 'transcribing') {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Transcript
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <div className="animate-pulse flex space-x-1">
              <div className="h-2 w-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="h-2 w-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="h-2 w-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <p className="text-sm mt-4">
              {processingStatus === 'transcribing' ? 'Transcribing audio...' : 'Preparing transcript...'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (processingStatus === 'failed') {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Transcript
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-500 text-center py-8">Failed to generate transcript.</p>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (!segments || segments.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Transcript
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm text-center py-8">No transcript available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Transcript
            {chapters.length > 0 && (
              <span className="text-xs text-muted-foreground font-normal">({chapters.length} chapters)</span>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowSearch(!showSearch)}
            aria-label={showSearch ? 'Close search' : 'Search transcript'}
          >
            {showSearch ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        {showSearch && (
          <div className="relative mt-2">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search transcript..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-20 h-9"
              autoFocus
            />
            {searchTerm && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {searchMatchCount} match{searchMatchCount !== 1 ? 'es' : ''}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => setSearchTerm('')}
                  aria-label="Clear search"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        <ScrollArea ref={scrollAreaRef} className="pr-4" style={{ maxHeight: '500px' }} onScrollCapture={handleScroll}>
          <div className="space-y-1">
            {filteredGroups.map((group, groupIndex) => (
              <ChapterGroupItem
                key={group.chapter?.id ?? `ungrouped-${groupIndex}`}
                group={group}
                segments={segments}
                currentSegmentIndex={currentSegmentIndex}
                searchTerm={searchTerm}
                isCurrentChapter={group.chapter?.id === currentChapterId}
                defaultExpanded={groupIndex === 0 || group.chapter?.id === currentChapterId}
                onSeek={handleSeek}
              />
            ))}
          </div>

          {searchTerm && searchMatchCount === 0 && (
            <div className="py-8 text-center text-muted-foreground text-sm">No matches found for "{searchTerm}"</div>
          )}
        </ScrollArea>

        {userHasScrolled && (
          <div className="flex justify-center mt-2">
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setUserHasScrolled(false)}>
              Resume auto-scroll
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
