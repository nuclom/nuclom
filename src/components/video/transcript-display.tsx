'use client';

/**
 * Transcript Display Component
 *
 * Displays video transcript with interactive features:
 * - Click on segment to seek to timestamp
 * - Highlight current segment during playback
 * - Auto-scroll to current segment
 * - Search within transcript
 */

import { FileText, MessageSquarePlus, Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { TranscriptSegment } from '@/lib/db/schema';
import { formatTime } from '@/lib/format-utils';
import { findSegmentIndexByTime } from '@/lib/subtitles';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

export interface SpeakerInfo {
  /** Speaker ID (from diarization or assignment) */
  id: string;
  /** Display label (e.g., "A", "B" or actual name) */
  label: string;
  /** Optional display name if assigned */
  name?: string;
  /** Optional avatar URL */
  avatarUrl?: string;
  /** Color for visual distinction */
  color?: string;
}

export interface VocabularyTerm {
  /** The term as it appears in text */
  term: string;
  /** Category for styling */
  category?: 'product' | 'person' | 'technical' | 'acronym' | 'company';
  /** Optional description for tooltip */
  description?: string;
}

export interface TranscriptDisplayProps {
  /** Transcript segments to display */
  segments: TranscriptSegment[];
  /** Current playback time in seconds */
  currentTime?: number;
  /** Callback when a segment is clicked to seek */
  onSeek?: (time: number) => void;
  /** Callback when comment button is clicked on a segment */
  onAddComment?: (segment: TranscriptSegment) => void;
  /** Whether to auto-scroll to current segment */
  autoScroll?: boolean;
  /** Whether transcript is still loading */
  isLoading?: boolean;
  /** Processing status message */
  processingStatus?: 'pending' | 'transcribing' | 'diarizing' | 'analyzing' | 'completed' | 'failed';
  /** Maximum height for the transcript container */
  maxHeight?: string;
  /** Optional className */
  className?: string;
  /** Speaker information for segments (keyed by speaker ID) */
  speakers?: Map<string, SpeakerInfo>;
  /** Vocabulary terms to highlight */
  vocabularyTerms?: VocabularyTerm[];
  /** Whether to show speaker labels */
  showSpeakers?: boolean;
  /** Whether to highlight vocabulary terms */
  highlightVocabulary?: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

const VOCABULARY_CATEGORY_COLORS: Record<string, string> = {
  product: 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200',
  person: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200',
  technical: 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200',
  acronym: 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200',
  company: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200',
};

function highlightTextWithVocabulary(
  text: string,
  searchTerm: string,
  vocabularyTerms?: VocabularyTerm[],
  highlightVocabulary?: boolean,
): React.ReactNode {
  // First apply vocabulary highlighting
  let result: React.ReactNode = text;

  if (highlightVocabulary && vocabularyTerms && vocabularyTerms.length > 0) {
    // Build regex pattern for all vocabulary terms
    const termPatterns = vocabularyTerms.map((v) => ({
      pattern: new RegExp(`\\b(${escapeRegExp(v.term)})\\b`, 'gi'),
      term: v,
    }));

    let segments: Array<{ text: string; isVocab: boolean; term?: VocabularyTerm }> = [{ text, isVocab: false }];

    for (const { pattern, term } of termPatterns) {
      segments = segments.flatMap((seg) => {
        if (seg.isVocab) return [seg];

        const parts: Array<{ text: string; isVocab: boolean; term?: VocabularyTerm }> = [];
        let lastIndex = 0;
        let match: RegExpExecArray | null = pattern.exec(seg.text);

        while (match !== null) {
          if (match.index > lastIndex) {
            parts.push({ text: seg.text.slice(lastIndex, match.index), isVocab: false });
          }
          parts.push({ text: match[0], isVocab: true, term });
          lastIndex = match.index + match[0].length;
          match = pattern.exec(seg.text);
        }

        if (lastIndex < seg.text.length) {
          parts.push({ text: seg.text.slice(lastIndex), isVocab: false });
        }

        return parts.length > 0 ? parts : [seg];
      });
    }

    result = segments.map((seg, idx) => {
      if (seg.isVocab && seg.term) {
        const colorClass =
          VOCABULARY_CATEGORY_COLORS[seg.term.category ?? 'technical'] ?? VOCABULARY_CATEGORY_COLORS.technical;
        return (
          <span
            key={idx}
            className={cn('rounded px-0.5', colorClass)}
            title={seg.term.description ?? `${seg.term.category ?? 'term'}: ${seg.term.term}`}
          >
            {seg.text}
          </span>
        );
      }
      return seg.text;
    });
  }

  // Then apply search term highlighting
  if (searchTerm.trim()) {
    if (typeof result === 'string') {
      const parts = result.split(new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi'));
      result = parts.map((part, index) =>
        part.toLowerCase() === searchTerm.toLowerCase() ? (
          <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
            {part}
          </mark>
        ) : (
          part
        ),
      );
    }
  }

  return result;
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// =============================================================================
// Transcript Segment Component
// =============================================================================

interface TranscriptSegmentItemProps {
  segment: TranscriptSegment;
  index: number;
  isActive: boolean;
  searchTerm: string;
  onSeek?: (time: number) => void;
  onAddComment?: (segment: TranscriptSegment) => void;
  /** Speaker info for this segment */
  speaker?: SpeakerInfo;
  /** Whether to show speaker label */
  showSpeaker?: boolean;
  /** Vocabulary terms to highlight */
  vocabularyTerms?: VocabularyTerm[];
  /** Whether to highlight vocabulary */
  highlightVocabulary?: boolean;
}

function TranscriptSegmentItem({
  segment,
  index,
  isActive,
  searchTerm,
  onSeek,
  onAddComment,
  speaker,
  showSpeaker,
  vocabularyTerms,
  highlightVocabulary,
}: TranscriptSegmentItemProps) {
  return (
    <div
      id={`transcript-segment-${index}`}
      className={cn(
        'group relative flex gap-2 sm:gap-4 p-2.5 sm:p-3 rounded-lg transition-colors cursor-pointer touch-manipulation',
        isActive
          ? 'bg-primary/10 border-l-2 border-primary'
          : 'hover:bg-muted/50 active:bg-muted/70 border-l-2 border-transparent',
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
      aria-label={`Jump to ${formatTime(segment.startTime)}: ${segment.text}`}
    >
      {/* Speaker indicator */}
      {showSpeaker && speaker && (
        <div className="flex-shrink-0 flex items-start">
          <div
            className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium',
              speaker.color || 'bg-gray-500',
            )}
            title={speaker.name || `Speaker ${speaker.label}`}
          >
            {speaker.name ? speaker.name.charAt(0).toUpperCase() : speaker.label}
          </div>
        </div>
      )}

      {/* Timestamp */}
      <div className="flex-shrink-0 w-12 sm:w-16">
        <span
          className={cn(
            'font-mono text-[11px] sm:text-xs',
            isActive ? 'text-primary font-medium' : 'text-muted-foreground',
          )}
        >
          {formatTime(segment.startTime)}
        </span>
      </div>

      {/* Text content */}
      <div className="flex-1 min-w-0 pr-6 sm:pr-0">
        {/* Speaker name (if available and different from label) */}
        {showSpeaker && speaker?.name && (
          <span className="text-xs font-medium text-muted-foreground mb-0.5 block">{speaker.name}</span>
        )}
        <p className={cn('text-sm leading-relaxed', isActive && 'text-foreground font-medium')}>
          {highlightTextWithVocabulary(segment.text, searchTerm, vocabularyTerms, highlightVocabulary)}
        </p>
      </div>

      {/* Comment button (visible on hover/always on touch) */}
      {onAddComment && (
        <div className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 sm:h-7 sm:w-7 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onAddComment(segment);
            }}
            aria-label="Add comment at this timestamp"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Confidence indicator (if available and low) */}
      {segment.confidence !== undefined && segment.confidence < 0.8 && (
        <div
          className="absolute right-2 bottom-1 text-[10px] text-muted-foreground/50"
          title={`Confidence: ${Math.round(segment.confidence * 100)}%`}
        >
          ⚠
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function TranscriptDisplay({
  segments,
  currentTime = 0,
  onSeek,
  onAddComment,
  autoScroll = true,
  isLoading = false,
  processingStatus,
  maxHeight = '24rem',
  className,
  speakers,
  vocabularyTerms,
  showSpeakers = false,
  highlightVocabulary = false,
}: TranscriptDisplayProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [userHasScrolled, setUserHasScrolled] = useState(false);

  // Find current segment index
  const currentSegmentIndex = useMemo(() => {
    if (!segments || segments.length === 0) return -1;
    return findSegmentIndexByTime(segments, currentTime);
  }, [segments, currentTime]);

  // Filter segments by search term
  const filteredSegments = useMemo(() => {
    if (!searchTerm.trim()) return segments;
    return segments.filter((segment) => segment.text.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [segments, searchTerm]);

  // Search match count
  const searchMatchCount = searchTerm.trim() ? filteredSegments.length : 0;

  // Auto-scroll to current segment
  useEffect(() => {
    if (!autoScroll || userHasScrolled || currentSegmentIndex < 0) return;

    const element = document.getElementById(`transcript-segment-${currentSegmentIndex}`);
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentSegmentIndex, autoScroll, userHasScrolled]);

  // Reset user scroll flag when playback jumps (more than 5 seconds)
  const lastTimeRef = useRef(currentTime);
  useEffect(() => {
    const timeDiff = Math.abs(currentTime - lastTimeRef.current);
    if (timeDiff > 5) {
      setUserHasScrolled(false);
    }
    lastTimeRef.current = currentTime;
  }, [currentTime]);

  // Handle scroll event to detect user scrolling
  const handleScroll = useCallback(() => {
    setUserHasScrolled(true);
  }, []);

  // Reset user scroll flag after 3 seconds of inactivity
  useEffect(() => {
    if (!userHasScrolled) return;

    const timeout = setTimeout(() => {
      setUserHasScrolled(false);
    }, 3000);

    return () => clearTimeout(timeout);
  }, [userHasScrolled]);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchTerm('');
  }, []);

  // Handle segment click with mapping back to original index
  const handleSegmentClick = useCallback(
    (time: number) => {
      setUserHasScrolled(false);
      onSeek?.(time);
    },
    [onSeek],
  );

  // Show loading state
  const isProcessing =
    isLoading ||
    processingStatus === 'pending' ||
    processingStatus === 'transcribing' ||
    processingStatus === 'diarizing' ||
    processingStatus === 'analyzing';

  if (isProcessing) {
    const statusMessages: Record<string, string> = {
      pending: 'Preparing transcript...',
      transcribing: 'Transcribing audio...',
      diarizing: 'Identifying speakers...',
      analyzing: 'Analyzing content...',
    };
    const statusMessage = statusMessages[processingStatus ?? 'pending'] ?? 'Processing...';

    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
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
            <p className="text-sm mt-4">{statusMessage}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show error state
  if (processingStatus === 'failed') {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Transcript
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-sm text-red-500">Failed to generate transcript.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show empty state
  if (!segments || segments.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
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
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Transcript
            <span className="text-xs text-muted-foreground font-normal">({segments.length} segments)</span>
          </CardTitle>

          {/* Search toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setShowSearch((prev) => !prev)}
            aria-label={showSearch ? 'Close search' : 'Search transcript'}
          >
            {showSearch ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        {/* Search input */}
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
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={clearSearch} aria-label="Clear search">
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        <ScrollArea ref={scrollAreaRef} className="pr-4" style={{ maxHeight }} onScrollCapture={handleScroll}>
          <div className="space-y-1">
            {filteredSegments.map((segment, displayIndex) => {
              // Find original index for active state
              const originalIndex = segments.findIndex(
                (s) => s.startTime === segment.startTime && s.text === segment.text,
              );

              // Get speaker info if available (using segment's speaker field if it exists)
              const segmentWithSpeaker = segment as TranscriptSegment & { speaker?: string };
              const speakerInfo = segmentWithSpeaker.speaker ? speakers?.get(segmentWithSpeaker.speaker) : undefined;

              return (
                <TranscriptSegmentItem
                  key={`${segment.startTime}-${displayIndex}`}
                  segment={segment}
                  index={originalIndex}
                  isActive={currentSegmentIndex === originalIndex}
                  searchTerm={searchTerm}
                  onSeek={handleSegmentClick}
                  onAddComment={onAddComment}
                  speaker={speakerInfo}
                  showSpeaker={showSpeakers}
                  vocabularyTerms={vocabularyTerms}
                  highlightVocabulary={highlightVocabulary}
                />
              );
            })}
          </div>

          {/* No results message */}
          {searchTerm && filteredSegments.length === 0 && (
            <div className="py-8 text-center text-muted-foreground text-sm">No matches found for "{searchTerm}"</div>
          )}
        </ScrollArea>

        {/* Auto-scroll indicator */}
        {autoScroll && userHasScrolled && (
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

// =============================================================================
// Export Types
// =============================================================================

export type { TranscriptSegment };
