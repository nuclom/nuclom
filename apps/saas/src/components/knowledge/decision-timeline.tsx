'use client';

/**
 * Decision Timeline Component
 *
 * Displays a chronological timeline of decisions extracted from videos.
 * Features:
 * - Click on decision to navigate to video timestamp
 * - Filter by topic, type, or person
 * - Color-coded by decision type
 * - Shows participants and confidence scores
 */

import type { DecisionStatus, DecisionType } from '@nuclom/lib/db/schema';
import { formatRelativeTime } from '@nuclom/lib/format-utils';
import { cn } from '@nuclom/lib/utils';
import { Link } from '@vercel/microfrontends/next/client';
import { Calendar, ChevronRight, Clock, Lightbulb, MessageSquare, Settings, Users, Wrench } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// =============================================================================
// Types
// =============================================================================

export interface DecisionTimelineItem {
  id: string;
  summary: string;
  decisionType: DecisionType;
  status: DecisionStatus;
  timestampStart: number | null;
  confidence: number | null;
  createdAt: Date;
  video: {
    id: string;
    title: string;
    thumbnailUrl: string | null;
  };
  participantCount: number;
  tags: string[];
}

export interface DecisionTimelineProps {
  /** List of decisions to display */
  decisions: DecisionTimelineItem[];
  /** Whether data is loading */
  isLoading?: boolean;
  /** Callback when a decision is clicked */
  onDecisionClick?: (decision: DecisionTimelineItem) => void;
  /** Callback when load more is requested */
  onLoadMore?: () => void;
  /** Whether there are more decisions to load */
  hasMore?: boolean;
  /** Maximum height for the timeline */
  maxHeight?: string;
  /** Optional className */
  className?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

const decisionTypeConfig: Record<DecisionType, { icon: React.ElementType; label: string; color: string }> = {
  technical: {
    icon: Wrench,
    label: 'Technical',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  },
  process: {
    icon: Settings,
    label: 'Process',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  },
  product: {
    icon: Lightbulb,
    label: 'Product',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  team: {
    icon: Users,
    label: 'Team',
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  },
  resource: {
    icon: Settings,
    label: 'Resource',
    color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  },
  other: {
    icon: MessageSquare,
    label: 'Other',
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  },
};

const statusConfig: Record<DecisionStatus, { label: string; color: string }> = {
  proposed: { label: 'Proposed', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  decided: { label: 'Decided', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  implemented: {
    label: 'Implemented',
    color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  },
  revisited: { label: 'Revisited', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  superseded: { label: 'Superseded', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' },
};

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// =============================================================================
// Decision Item Component
// =============================================================================

interface DecisionItemProps {
  decision: DecisionTimelineItem;
  onClick?: () => void;
}

function DecisionItem({ decision, onClick }: DecisionItemProps) {
  const typeConfig = decisionTypeConfig[decision.decisionType];
  const statusCfg = statusConfig[decision.status];
  const TypeIcon = typeConfig.icon;

  return (
    <div
      className={cn(
        'relative pl-8 pb-8 group cursor-pointer',
        'before:absolute before:left-3 before:top-2 before:h-full before:w-px',
        'before:bg-border group-last:before:hidden',
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      {/* Timeline dot */}
      <div
        className={cn(
          'absolute left-0 top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 bg-background',
          decision.status === 'decided' ? 'border-green-500' : 'border-muted-foreground',
        )}
      >
        <TypeIcon className="h-3 w-3" />
      </div>

      {/* Decision card */}
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-sm font-medium line-clamp-2">{decision.summary}</CardTitle>
              <CardDescription className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatRelativeTime(decision.createdAt)}
                </span>
                {decision.timestampStart !== null && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTimestamp(decision.timestampStart)}
                  </span>
                )}
                {decision.participantCount > 0 && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {decision.participantCount}
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant="secondary" className={cn('text-xs', typeConfig.color)}>
                {typeConfig.label}
              </Badge>
              <Badge variant="outline" className={cn('text-xs', statusCfg.color)}>
                {statusCfg.label}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pb-3">
          <Link
            href={`/videos/${decision.video.id}${decision.timestampStart ? `?t=${decision.timestampStart}` : ''}`}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {decision.video.thumbnailUrl && (
              <Image
                src={decision.video.thumbnailUrl}
                alt=""
                width={48}
                height={32}
                className="h-8 w-12 rounded object-cover"
              />
            )}
            <span className="truncate flex-1">{decision.video.title}</span>
            <ChevronRight className="h-3 w-3 shrink-0" />
          </Link>
          {decision.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {decision.tags.slice(0, 4).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs py-0">
                  {tag}
                </Badge>
              ))}
              {decision.tags.length > 4 && (
                <Badge variant="outline" className="text-xs py-0">
                  +{decision.tags.length - 4}
                </Badge>
              )}
            </div>
          )}
          {decision.confidence !== null && decision.confidence < 80 && (
            <p className="mt-2 text-xs text-muted-foreground">Confidence: {decision.confidence}%</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// Empty State Component
// =============================================================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Lightbulb className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No decisions found</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        Decisions will appear here as they are extracted from your team&apos;s video recordings.
      </p>
    </div>
  );
}

// =============================================================================
// Loading Skeleton
// =============================================================================

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="relative pl-8">
          <div className="absolute left-0 top-2 h-6 w-6 rounded-full bg-muted" />
          <Card>
            <CardHeader className="pb-2">
              <div className="h-4 w-3/4 bg-muted rounded" />
              <div className="h-3 w-1/2 bg-muted rounded mt-2" />
            </CardHeader>
            <CardContent className="pb-3">
              <div className="h-8 w-full bg-muted rounded" />
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function DecisionTimeline({
  decisions,
  isLoading = false,
  onDecisionClick,
  onLoadMore,
  hasMore = false,
  maxHeight = '600px',
  className,
}: DecisionTimelineProps) {
  const [typeFilter, setTypeFilter] = useState<DecisionType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<DecisionStatus | 'all'>('all');

  // Filter decisions
  const filteredDecisions = decisions.filter((d) => {
    if (typeFilter !== 'all' && d.decisionType !== typeFilter) return false;
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    return true;
  });

  const handleDecisionClick = useCallback(
    (decision: DecisionTimelineItem) => {
      onDecisionClick?.(decision);
    },
    [onDecisionClick],
  );

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as DecisionType | 'all')}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="technical">Technical</SelectItem>
            <SelectItem value="process">Process</SelectItem>
            <SelectItem value="product">Product</SelectItem>
            <SelectItem value="team">Team</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as DecisionStatus | 'all')}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="decided">Decided</SelectItem>
            <SelectItem value="proposed">Proposed</SelectItem>
            <SelectItem value="revisited">Revisited</SelectItem>
            <SelectItem value="superseded">Superseded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Timeline */}
      <ScrollArea style={{ maxHeight }}>
        {isLoading ? (
          <LoadingSkeleton />
        ) : filteredDecisions.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="pr-4">
            {filteredDecisions.map((decision) => (
              <DecisionItem key={decision.id} decision={decision} onClick={() => handleDecisionClick(decision)} />
            ))}
            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button variant="outline" size="sm" onClick={onLoadMore}>
                  Load More
                </Button>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export default DecisionTimeline;
