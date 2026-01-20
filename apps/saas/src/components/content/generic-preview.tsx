'use client';

/**
 * Generic Content Preview Component
 *
 * A fallback preview component for content items that don't have a
 * source-specific preview. Provides a clean, universal display.
 */

import type { ContentItem } from '@nuclom/lib/db/schema';
import { cn } from '@nuclom/lib/utils';
import { FileText } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { ContentPreviewVariant } from './content-preview';

// =============================================================================
// Types
// =============================================================================

export interface GenericContentPreviewProps {
  item: ContentItem;
  variant?: ContentPreviewVariant;
  showSource?: boolean;
  showAuthor?: boolean;
  showTimestamp?: boolean;
  className?: string;
  onClick?: () => void;
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatRelativeTime(date: Date | string | null): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    message: 'Message',
    thread: 'Thread',
    document: 'Document',
    page: 'Page',
    database_entry: 'Entry',
    pull_request: 'Pull Request',
    issue: 'Issue',
    discussion: 'Discussion',
    commit: 'Commit',
    video: 'Video',
    meeting: 'Meeting',
    recording: 'Recording',
  };
  return labels[type] || type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
}

// =============================================================================
// Component
// =============================================================================

export function GenericContentPreview({
  item,
  variant = 'default',
  showSource = true,
  showAuthor = true,
  showTimestamp = true,
  className,
  onClick,
}: GenericContentPreviewProps) {
  const metadata = item.metadata || {};

  // Compact variant
  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer',
          className,
        )}
        onClick={onClick}
      >
        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
          <FileText className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate">{item.title || item.content?.slice(0, 80) || 'Untitled'}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-xs">{getTypeLabel(item.type)}</Badge>
            {showTimestamp && item.createdAtSource && <span>{formatRelativeTime(item.createdAtSource)}</span>}
          </div>
        </div>
      </div>
    );
  }

  // Default and expanded variants
  return (
    <div
      className={cn(
        'p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors',
        onClick && 'cursor-pointer',
        className,
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        {showAuthor && item.authorName ? (
          <Avatar className="h-10 w-10">
            <AvatarImage
              src={(metadata as { authorAvatar?: string }).authorAvatar}
              alt={item.authorName}
            />
            <AvatarFallback>{getInitials(item.authorName)}</AvatarFallback>
          </Avatar>
        ) : (
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
            <FileText className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-base">{item.title || 'Untitled'}</h3>

          {/* Meta line */}
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
            <Badge variant="secondary" className="text-xs">
              {getTypeLabel(item.type)}
            </Badge>
            {showAuthor && item.authorName && <span>{item.authorName}</span>}
            {showTimestamp && item.createdAtSource && <span>{formatRelativeTime(item.createdAtSource)}</span>}
          </div>
        </div>
      </div>

      {/* Content preview */}
      {item.content && (
        <div className="mt-3">
          <p className={cn('text-sm text-muted-foreground', variant === 'default' && 'line-clamp-3')}>
            {item.content}
          </p>
        </div>
      )}

      {/* Tags */}
      {item.tags && item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {item.tags.slice(0, 5).map((tag, idx) => (
            <Badge key={idx} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
          {item.tags.length > 5 && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              +{item.tags.length - 5} more
            </Badge>
          )}
        </div>
      )}

      {/* Summary (expanded only) */}
      {variant === 'expanded' && item.summary && (
        <div className="mt-4 pt-3 border-t">
          <p className="text-xs font-medium text-muted-foreground mb-1">Summary</p>
          <p className="text-sm">{item.summary}</p>
        </div>
      )}

      {/* Key points (expanded only) */}
      {variant === 'expanded' && item.keyPoints && item.keyPoints.length > 0 && (
        <div className="mt-4 pt-3 border-t">
          <p className="text-xs font-medium text-muted-foreground mb-2">Key Points</p>
          <ul className="space-y-1">
            {item.keyPoints.map((point, idx) => (
              <li key={idx} className="text-sm flex items-start gap-2">
                <span className="text-muted-foreground">•</span>
                <span>{typeof point === 'string' ? point : point.text || JSON.stringify(point)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sentiment (expanded only) */}
      {variant === 'expanded' && item.sentiment && (
        <div className="mt-4 pt-3 border-t">
          <p className="text-xs font-medium text-muted-foreground mb-1">Sentiment</p>
          <Badge
            variant="outline"
            className={cn(
              'text-xs',
              item.sentiment === 'positive' && 'text-green-600 border-green-300',
              item.sentiment === 'negative' && 'text-red-600 border-red-300',
              item.sentiment === 'neutral' && 'text-gray-600 border-gray-300',
              item.sentiment === 'mixed' && 'text-yellow-600 border-yellow-300',
            )}
          >
            {item.sentiment.charAt(0).toUpperCase() + item.sentiment.slice(1)}
          </Badge>
        </div>
      )}
    </div>
  );
}

export default GenericContentPreview;
