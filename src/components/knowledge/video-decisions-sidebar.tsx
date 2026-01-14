'use client';

/**
 * Video Decisions Sidebar Component
 *
 * Displays decisions extracted from a specific video.
 * Integrates with video player for seeking to decision timestamps.
 */

import { ChevronDown, ChevronUp, Clock, Lightbulb, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import type { DecisionStatus, DecisionType } from '@/lib/db/schema';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

export interface VideoDecision {
  id: string;
  summary: string;
  context?: string | null;
  reasoning?: string | null;
  timestampStart: number | null;
  timestampEnd: number | null;
  decisionType: DecisionType;
  status: DecisionStatus;
  confidence: number | null;
  tags: string[];
  participants?: Array<{
    id: string;
    userId: string | null;
    speakerName: string | null;
    role: 'decider' | 'participant' | 'mentioned';
    attributedText: string | null;
    user?: {
      id: string;
      name: string;
      image: string | null;
    } | null;
  }>;
}

export interface VideoDecisionsSidebarProps {
  /** Video ID to fetch decisions for */
  videoId: string;
  /** Current video playback time */
  currentTime?: number;
  /** Callback when user wants to seek to a timestamp */
  onSeek?: (time: number) => void;
  /** Optional className */
  className?: string;
  /** If true, returns null when there are no decisions */
  hideWhenEmpty?: boolean;
  /** Callback when decisions are loaded, reports the count */
  onLoad?: (count: number) => void;
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatTimestamp(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const decisionTypeColors: Record<DecisionType, string> = {
  technical: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  process: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  product: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  team: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

const statusColors: Record<DecisionStatus, string> = {
  proposed: 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20',
  decided: 'border-green-400 bg-green-50 dark:bg-green-900/20',
  revisited: 'border-blue-400 bg-blue-50 dark:bg-blue-900/20',
  superseded: 'border-gray-400 bg-gray-50 dark:bg-gray-800/50',
};

// =============================================================================
// Decision Card Component
// =============================================================================

interface DecisionCardProps {
  decision: VideoDecision;
  isActive: boolean;
  onSeek?: (time: number) => void;
}

function DecisionCard({ decision, isActive, onSeek }: DecisionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSeek = useCallback(() => {
    if (decision.timestampStart !== null && onSeek) {
      onSeek(decision.timestampStart);
    }
  }, [decision.timestampStart, onSeek]);

  return (
    <Card className={cn('transition-all border-l-4', statusColors[decision.status], isActive && 'ring-2 ring-primary')}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="pb-2 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm font-medium leading-tight flex-1">{decision.summary}</CardTitle>
            <Badge
              variant="secondary"
              className={cn('shrink-0 text-xs capitalize', decisionTypeColors[decision.decisionType])}
            >
              {decision.decisionType}
            </Badge>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {decision.timestampStart !== null && (
              <button
                type="button"
                onClick={handleSeek}
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <Clock className="h-3 w-3" />
                {formatTimestamp(decision.timestampStart)}
              </button>
            )}
            {decision.participants && decision.participants.length > 0 && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {decision.participants.length}
              </span>
            )}
            <Badge variant="outline" className="text-xs capitalize py-0">
              {decision.status}
            </Badge>
          </div>
        </CardHeader>

        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full rounded-none h-6">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <span className="sr-only">{isExpanded ? 'Hide details' : 'Show details'}</span>
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-2 space-y-3">
            {/* Reasoning */}
            {decision.reasoning && (
              <div className="text-xs">
                <p className="font-medium text-muted-foreground mb-1">Reasoning</p>
                <p className="text-foreground">{decision.reasoning}</p>
              </div>
            )}

            {/* Context */}
            {decision.context && (
              <div className="text-xs">
                <p className="font-medium text-muted-foreground mb-1">Context</p>
                <p className="text-foreground">{decision.context}</p>
              </div>
            )}

            {/* Participants */}
            {decision.participants && decision.participants.length > 0 && (
              <div className="text-xs">
                <p className="font-medium text-muted-foreground mb-2">Participants</p>
                <div className="space-y-2">
                  {decision.participants.map((p) => (
                    <div key={p.id} className="flex items-start gap-2">
                      <Avatar className="h-5 w-5 shrink-0">
                        {p.user?.image && <AvatarImage src={p.user.image} alt={p.user.name} />}
                        <AvatarFallback className="text-[10px]">
                          {(p.user?.name || p.speakerName || '?').charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {p.user?.name || p.speakerName}
                          <Badge variant="outline" className="ml-1 text-[10px] py-0 capitalize">
                            {p.role}
                          </Badge>
                        </p>
                        {p.attributedText && (
                          <p className="text-muted-foreground italic truncate">&ldquo;{p.attributedText}&rdquo;</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {decision.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {decision.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs py-0">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Confidence indicator */}
            {decision.confidence !== null && (
              <div className="text-xs text-muted-foreground">Confidence: {decision.confidence}%</div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// =============================================================================
// Loading Skeleton
// =============================================================================

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-2/3 mt-2" />
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

// =============================================================================
// Empty State
// =============================================================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center px-4">
      <Lightbulb className="h-10 w-10 text-muted-foreground mb-3" />
      <h3 className="text-sm font-semibold">No decisions extracted</h3>
      <p className="text-xs text-muted-foreground mt-1">Decisions will appear here once the video has been analyzed.</p>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function VideoDecisionsSidebar({
  videoId,
  currentTime = 0,
  onSeek,
  className,
  hideWhenEmpty = false,
  onLoad,
}: VideoDecisionsSidebarProps) {
  const [decisions, setDecisions] = useState<VideoDecision[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch decisions for the video
  useEffect(() => {
    async function fetchDecisions() {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/videos/${videoId}/decisions`);
        if (response.ok) {
          const data = await response.json();
          const fetchedDecisions = data.decisions || [];
          setDecisions(fetchedDecisions);
          onLoad?.(fetchedDecisions.length);
        } else {
          onLoad?.(0);
        }
      } catch {
        // Silently fail - decisions are supplementary
        onLoad?.(0);
      } finally {
        setIsLoading(false);
      }
    }

    fetchDecisions();
  }, [videoId, onLoad]);

  // Sort decisions by timestamp
  const sortedDecisions = useMemo(
    () =>
      [...decisions].sort((a, b) => {
        const aTime = a.timestampStart ?? 0;
        const bTime = b.timestampStart ?? 0;
        return aTime - bTime;
      }),
    [decisions],
  );

  // Find currently active decision based on playback time
  const activeDecisionId = useMemo(() => {
    for (let i = sortedDecisions.length - 1; i >= 0; i--) {
      const decision = sortedDecisions[i];
      if (decision.timestampStart !== null && currentTime >= decision.timestampStart) {
        const endTime = decision.timestampEnd ?? decision.timestampStart + 60;
        if (currentTime <= endTime) {
          return decision.id;
        }
      }
    }
    return null;
  }, [sortedDecisions, currentTime]);

  // Hide component entirely when empty and hideWhenEmpty is true
  if (hideWhenEmpty && !isLoading && decisions.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Lightbulb className="h-4 w-4" />
          Decisions ({decisions.length})
        </h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {isLoading ? (
            <LoadingSkeleton />
          ) : sortedDecisions.length === 0 ? (
            <EmptyState />
          ) : (
            sortedDecisions.map((decision) => (
              <DecisionCard
                key={decision.id}
                decision={decision}
                isActive={decision.id === activeDecisionId}
                onSeek={onSeek}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default VideoDecisionsSidebar;
