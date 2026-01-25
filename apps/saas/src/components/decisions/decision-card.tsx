'use client';

import { cn } from '@nuclom/lib/utils';
import { Badge } from '@nuclom/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@nuclom/ui/card';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircle, Clock, HelpCircle, RotateCcw, XCircle } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export interface DecisionData {
  id: string;
  summary: string;
  context: string | null;
  reasoning: string | null;
  status: 'proposed' | 'decided' | 'revisited' | 'superseded';
  decisionType: 'technical' | 'process' | 'product' | 'team' | 'other';
  confidence: number | null;
  tags: string[];
  createdAt: Date | string;
  videoId?: string;
}

interface DecisionCardProps {
  decision: DecisionData;
  onClick?: () => void;
  className?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getStatusIcon(status: DecisionData['status']) {
  switch (status) {
    case 'proposed':
      return HelpCircle;
    case 'decided':
      return CheckCircle;
    case 'revisited':
      return RotateCcw;
    case 'superseded':
      return XCircle;
    default:
      return HelpCircle;
  }
}

function getStatusColor(status: DecisionData['status']): string {
  switch (status) {
    case 'proposed':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
    case 'decided':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
    case 'revisited':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    case 'superseded':
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  }
}

function getTypeColor(type: DecisionData['decisionType']): string {
  switch (type) {
    case 'technical':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
    case 'process':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    case 'product':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
    case 'team':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  }
}

function getStatusBorderColor(status: DecisionData['status']): string {
  switch (status) {
    case 'proposed':
      return 'border-l-yellow-500';
    case 'decided':
      return 'border-l-green-500';
    case 'revisited':
      return 'border-l-blue-500';
    case 'superseded':
      return 'border-l-gray-400';
    default:
      return 'border-l-gray-400';
  }
}

// =============================================================================
// Component
// =============================================================================

export function DecisionCard({ decision, onClick, className }: DecisionCardProps) {
  const createdAt = typeof decision.createdAt === 'string' ? new Date(decision.createdAt) : decision.createdAt;
  const StatusIcon = getStatusIcon(decision.status);

  return (
    <Card
      className={cn(
        'hover:bg-accent/50 transition-colors cursor-pointer border-l-4',
        getStatusBorderColor(decision.status),
        className,
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <StatusIcon className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <CardTitle className="text-sm font-medium line-clamp-2">{decision.summary}</CardTitle>
          </div>
          {decision.confidence !== null && (
            <Badge variant="outline" className="text-xs flex-shrink-0">
              {decision.confidence}% confident
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Badge variant="secondary" className={cn('text-xs capitalize', getStatusColor(decision.status))}>
            {decision.status}
          </Badge>
          <Badge variant="secondary" className={cn('text-xs capitalize', getTypeColor(decision.decisionType))}>
            {decision.decisionType}
          </Badge>
        </div>
        {decision.context && <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{decision.context}</p>}
        {decision.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {decision.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {decision.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{decision.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDistanceToNow(createdAt, { addSuffix: true })}
        </p>
      </CardContent>
    </Card>
  );
}
