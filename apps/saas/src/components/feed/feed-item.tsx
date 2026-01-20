'use client';

import { cn } from '@nuclom/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import {
  CheckCircle,
  Clock,
  FileText,
  GitBranch,
  GitPullRequest,
  Hash,
  MessageSquare,
  Tags,
  Video,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

// =============================================================================
// Types
// =============================================================================

export interface FeedItemData {
  id: string;
  type: 'content' | 'decision' | 'topic';
  title: string;
  summary?: string;
  sourceType?: string;
  contentType?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  metadata?: Record<string, unknown>;
}

interface FeedItemProps {
  item: FeedItemData;
  onClick?: () => void;
  className?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getContentIcon(contentType?: string) {
  switch (contentType) {
    case 'message':
    case 'thread':
      return MessageSquare;
    case 'document':
      return FileText;
    case 'issue':
      return GitBranch;
    case 'pull_request':
      return GitPullRequest;
    case 'video':
      return Video;
    default:
      return FileText;
  }
}

function getSourceColor(sourceType?: string): string {
  switch (sourceType) {
    case 'slack':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
    case 'notion':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    case 'github':
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  }
}

function getDecisionStatusColor(status?: string): string {
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

// =============================================================================
// Component
// =============================================================================

export function FeedItem({ item, onClick, className }: FeedItemProps) {
  const createdAt = typeof item.createdAt === 'string' ? new Date(item.createdAt) : item.createdAt;

  // Render content item
  if (item.type === 'content') {
    const Icon = getContentIcon(item.contentType);
    const sourceColor = getSourceColor(item.sourceType);
    const sourceName = (item.metadata?.sourceName as string) || item.sourceType;
    const authorName = item.metadata?.authorName as string | undefined;
    const externalUrl = item.metadata?.externalUrl as string | undefined;

    return (
      <Card className={cn('p-4 hover:bg-accent/50 transition-colors cursor-pointer', className)} onClick={onClick}>
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {item.sourceType && (
                <Badge variant="secondary" className={cn('text-xs', sourceColor)}>
                  {sourceName}
                </Badge>
              )}
              {item.contentType && (
                <Badge variant="outline" className="text-xs capitalize">
                  {item.contentType.replace('_', ' ')}
                </Badge>
              )}
            </div>
            <h3 className="font-medium text-sm line-clamp-2">
              {externalUrl ? (
                <a
                  href={externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {item.title}
                </a>
              ) : (
                item.title
              )}
            </h3>
            {item.summary && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.summary}</p>}
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              {authorName && <span>{authorName}</span>}
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(createdAt, { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // Render decision item
  if (item.type === 'decision') {
    const status = item.metadata?.status as string | undefined;
    const decisionType = item.metadata?.decisionType as string | undefined;
    const tags = item.metadata?.tags as string[] | undefined;

    return (
      <Card
        className={cn(
          'p-4 hover:bg-accent/50 transition-colors cursor-pointer border-l-4 border-l-green-500',
          className,
        )}
        onClick={onClick}
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="text-xs">
                Decision
              </Badge>
              {status && (
                <Badge variant="secondary" className={cn('text-xs capitalize', getDecisionStatusColor(status))}>
                  {status}
                </Badge>
              )}
              {decisionType && (
                <Badge variant="outline" className="text-xs capitalize">
                  {decisionType}
                </Badge>
              )}
            </div>
            <h3 className="font-medium text-sm line-clamp-2">{item.title}</h3>
            {item.summary && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.summary}</p>}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {tags && tags.length > 0 && (
                <div className="flex items-center gap-1">
                  {tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(createdAt, { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // Render topic item
  if (item.type === 'topic') {
    const keywords = item.metadata?.keywords as string[] | undefined;
    const memberCount = item.metadata?.memberCount as number | undefined;
    const color = item.metadata?.color as string | undefined;

    return (
      <Card
        className={cn('p-4 hover:bg-accent/50 transition-colors cursor-pointer border-l-4', className)}
        style={{ borderLeftColor: color || '#6366f1' }}
        onClick={onClick}
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
            <Tags className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="text-xs">
                Topic
              </Badge>
              {memberCount !== undefined && (
                <Badge variant="outline" className="text-xs">
                  <Hash className="h-3 w-3 mr-1" />
                  {memberCount} items
                </Badge>
              )}
            </div>
            <h3 className="font-medium text-sm">{item.title}</h3>
            {item.summary && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.summary}</p>}
            {keywords && keywords.length > 0 && (
              <div className="flex items-center gap-1 mt-2 flex-wrap">
                {keywords.slice(0, 5).map((keyword) => (
                  <Badge key={keyword} variant="outline" className="text-xs">
                    {keyword}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  }

  return null;
}
