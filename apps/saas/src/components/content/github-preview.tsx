'use client';

/**
 * GitHub Preview Component
 *
 * Renders GitHub PRs, issues, and discussions with appropriate styling:
 * - State badges (Open/Closed/Merged, Draft)
 * - Review status indicators
 * - Labels as colored badges
 * - File change summary
 * - Linked issues/PRs
 */

import type { ContentItem, ContentItemMetadata } from '@nuclom/lib/db/schema';
import { formatRelativeTimeCompact, getInitials } from '@nuclom/lib/format-utils';
import { cn } from '@nuclom/lib/utils';
import { Check, CircleDot, GitMerge, GitPullRequest, MessageSquare, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { ContentPreviewVariant } from './content-preview';
import { InteractiveCard } from './interactive-card';

// =============================================================================
// Types
// =============================================================================

interface GitHubMetadata extends ContentItemMetadata {
  repoOwner?: string;
  repoName?: string;
  issueNumber?: number;
  prNumber?: number;
  state?: 'open' | 'closed' | 'merged';
  isDraft?: boolean;
  labels?: Array<{ name: string; color?: string }>;
  assignees?: Array<{ login: string; avatarUrl?: string }>;
  reviewers?: Array<{ login: string; avatarUrl?: string; state?: string }>;
  additions?: number;
  deletions?: number;
  changedFiles?: number;
  comments?: number;
  linkedIssues?: Array<{ number: number; title: string }>;
  linkedPRs?: Array<{ number: number; title: string }>;
  authorAvatar?: string;
}

export interface GitHubPreviewProps {
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

/**
 * Get the state icon and color for a PR/Issue
 */
function getStateInfo(
  type: string,
  state?: string,
  isDraft?: boolean,
): { icon: React.ReactNode; color: string; label: string } {
  const isPR = type === 'pull_request';

  if (isPR) {
    if (isDraft) {
      return {
        icon: <GitPullRequest className="h-4 w-4" />,
        color: 'text-gray-500 bg-gray-100 dark:bg-gray-800',
        label: 'Draft',
      };
    }
    if (state === 'merged') {
      return {
        icon: <GitMerge className="h-4 w-4" />,
        color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30',
        label: 'Merged',
      };
    }
    if (state === 'closed') {
      return {
        icon: <GitPullRequest className="h-4 w-4" />,
        color: 'text-red-600 bg-red-100 dark:bg-red-900/30',
        label: 'Closed',
      };
    }
    return {
      icon: <GitPullRequest className="h-4 w-4" />,
      color: 'text-green-600 bg-green-100 dark:bg-green-900/30',
      label: 'Open',
    };
  }

  // Issue
  if (state === 'closed') {
    return {
      icon: <CircleDot className="h-4 w-4" />,
      color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30',
      label: 'Closed',
    };
  }
  return {
    icon: <CircleDot className="h-4 w-4" />,
    color: 'text-green-600 bg-green-100 dark:bg-green-900/30',
    label: 'Open',
  };
}

/**
 * Get review status summary
 */
function getReviewStatus(reviewers?: GitHubMetadata['reviewers']): {
  approved: number;
  changesRequested: number;
  pending: number;
} {
  if (!reviewers) return { approved: 0, changesRequested: 0, pending: 0 };

  return reviewers.reduce(
    (acc, r) => {
      if (r.state === 'APPROVED') acc.approved++;
      else if (r.state === 'CHANGES_REQUESTED') acc.changesRequested++;
      else acc.pending++;
      return acc;
    },
    { approved: 0, changesRequested: 0, pending: 0 },
  );
}

// =============================================================================
// Component
// =============================================================================

export function GitHubPreview({
  item,
  variant = 'default',
  showSource = true,
  showAuthor = true,
  showTimestamp = true,
  className,
  onClick,
}: GitHubPreviewProps) {
  const metadata = item.metadata as GitHubMetadata;
  const isPR = item.type === 'pull_request';
  const number = metadata.prNumber || metadata.issueNumber;
  const stateInfo = getStateInfo(item.type, metadata.state, metadata.isDraft);
  const repoPath = metadata.repoOwner && metadata.repoName ? `${metadata.repoOwner}/${metadata.repoName}` : null;

  // Compact variant
  if (variant === 'compact') {
    return (
      <InteractiveCard variant="compact" onClick={onClick} className={className}>
        <div className={cn('p-1 rounded', stateInfo.color)}>{stateInfo.icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate">
            {item.title}
            {number && <span className="text-muted-foreground ml-1">#{number}</span>}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {showSource && repoPath && <span>{repoPath}</span>}
            {showTimestamp && item.createdAtSource && <span>{formatRelativeTimeCompact(item.createdAtSource)}</span>}
          </div>
        </div>
        <Badge variant="secondary" className="text-xs">
          {stateInfo.label}
        </Badge>
      </InteractiveCard>
    );
  }

  // Default and expanded variants
  const reviewStatus = isPR ? getReviewStatus(metadata.reviewers) : null;
  const hasChanges = isPR && (metadata.additions !== undefined || metadata.deletions !== undefined);

  return (
    <InteractiveCard onClick={onClick} className={className}>
      {/* Repo path */}
      {showSource && repoPath && <p className="text-xs text-muted-foreground mb-2">{repoPath}</p>}

      {/* Title and state */}
      <div className="flex items-start gap-3">
        <div className={cn('p-1.5 rounded mt-0.5', stateInfo.color)}>{stateInfo.icon}</div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-base">
            {item.title}
            {number && <span className="text-muted-foreground ml-1.5">#{number}</span>}
          </h3>

          {/* Meta line */}
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
            <Badge variant="outline" className={cn('text-xs', stateInfo.color.replace('bg-', 'border-'))}>
              {stateInfo.label}
            </Badge>
            {showAuthor && item.authorName && (
              <span className="flex items-center gap-1">
                <Avatar className="h-4 w-4">
                  <AvatarImage src={metadata.authorAvatar} alt={item.authorName} />
                  <AvatarFallback className="text-[8px]">{getInitials(item.authorName)}</AvatarFallback>
                </Avatar>
                {item.authorName}
              </span>
            )}
            {showTimestamp && item.createdAtSource && <span>{formatRelativeTimeCompact(item.createdAtSource)}</span>}
          </div>
        </div>
      </div>

      {/* Labels */}
      {metadata.labels && metadata.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {metadata.labels.map((label, idx) => (
            <Badge
              key={idx}
              variant="outline"
              className="text-xs"
              style={
                label.color
                  ? {
                      borderColor: `#${label.color}`,
                      backgroundColor: `#${label.color}20`,
                    }
                  : undefined
              }
            >
              {label.name}
            </Badge>
          ))}
        </div>
      )}

      {/* PR-specific: Diff stats and review status */}
      {isPR && (
        <div className="flex items-center gap-4 mt-3 text-xs">
          {hasChanges && (
            <div className="flex items-center gap-2">
              <span className="text-green-600">+{metadata.additions || 0}</span>
              <span className="text-red-600">-{metadata.deletions || 0}</span>
              {metadata.changedFiles !== undefined && (
                <span className="text-muted-foreground">{metadata.changedFiles} files</span>
              )}
            </div>
          )}
          {reviewStatus && (reviewStatus.approved > 0 || reviewStatus.changesRequested > 0) && (
            <div className="flex items-center gap-2">
              {reviewStatus.approved > 0 && (
                <span className="flex items-center gap-1 text-green-600">
                  <Check className="h-3 w-3" />
                  {reviewStatus.approved}
                </span>
              )}
              {reviewStatus.changesRequested > 0 && (
                <span className="flex items-center gap-1 text-red-600">
                  <X className="h-3 w-3" />
                  {reviewStatus.changesRequested}
                </span>
              )}
            </div>
          )}
          {metadata.comments !== undefined && metadata.comments > 0 && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <MessageSquare className="h-3 w-3" />
              {metadata.comments}
            </span>
          )}
        </div>
      )}

      {/* Content preview */}
      {item.content && (
        <div className="mt-3">
          <p className={cn('text-sm text-muted-foreground', variant === 'default' && 'line-clamp-3')}>{item.content}</p>
        </div>
      )}

      {/* Linked issues/PRs (expanded only) */}
      {variant === 'expanded' && (
        <>
          {metadata.linkedIssues && metadata.linkedIssues.length > 0 && (
            <div className="mt-4 pt-3 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-2">Linked Issues</p>
              <div className="space-y-1">
                {metadata.linkedIssues.map((issue, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <CircleDot className="h-3 w-3 text-muted-foreground" />
                    <span>
                      #{issue.number} {issue.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          {item.summary && (
            <div className="mt-4 pt-3 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-1">Summary</p>
              <p className="text-sm">{item.summary}</p>
            </div>
          )}

          {/* Assignees */}
          {metadata.assignees && metadata.assignees.length > 0 && (
            <div className="mt-4 pt-3 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-2">Assignees</p>
              <div className="flex items-center gap-2">
                {metadata.assignees.map((assignee, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={assignee.avatarUrl} alt={assignee.login} />
                      <AvatarFallback className="text-[10px]">{getInitials(assignee.login)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{assignee.login}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </InteractiveCard>
  );
}

export default GitHubPreview;
