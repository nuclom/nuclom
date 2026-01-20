'use client';

/**
 * Content Preview Component
 *
 * A polymorphic component that renders content items with source-specific
 * styling and features. Routes to the appropriate preview component based
 * on source type.
 */

import type { ContentItem, ContentSource } from '@nuclom/lib/db/schema';
import { cn } from '@nuclom/lib/utils';
import { GenericContentPreview } from './generic-preview';
import { GitHubPreview } from './github-preview';
import { NotionPreview } from './notion-preview';
import { SlackPreview } from './slack-preview';

// =============================================================================
// Types
// =============================================================================

export type ContentPreviewVariant = 'compact' | 'default' | 'expanded';

export interface ContentPreviewProps {
  item: ContentItem;
  source?: ContentSource | null;
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
 * Determine the source type from a content item
 */
function getSourceType(item: ContentItem, source?: ContentSource | null): string | null {
  // First check the source if provided
  if (source?.type) {
    return source.type;
  }

  // Infer from item type
  const type = item.type;
  if (type === 'message' || type === 'thread') {
    return 'slack';
  }
  if (type === 'document') {
    return 'notion';
  }
  if (type === 'pull_request' || type === 'issue') {
    return 'github';
  }
  if (type === 'video') {
    return 'video';
  }

  // Check metadata for hints
  const metadata = item.metadata;
  if (metadata?.channelId || metadata?.threadTs) {
    return 'slack';
  }
  if (metadata?.pageId || metadata?.databaseId) {
    return 'notion';
  }
  if (metadata?.repoOwner || metadata?.prNumber || metadata?.issueNumber) {
    return 'github';
  }

  return null;
}

// =============================================================================
// Main Component
// =============================================================================

export function ContentPreview({
  item,
  source,
  variant = 'default',
  showSource = true,
  showAuthor = true,
  showTimestamp = true,
  className,
  onClick,
}: ContentPreviewProps) {
  const sourceType = getSourceType(item, source);

  const commonProps = {
    item,
    variant,
    showSource,
    showAuthor,
    showTimestamp,
    className,
    onClick,
  };

  switch (sourceType) {
    case 'slack':
      return <SlackPreview {...commonProps} />;
    case 'notion':
      return <NotionPreview {...commonProps} />;
    case 'github':
      return <GitHubPreview {...commonProps} />;
    default:
      return <GenericContentPreview {...commonProps} />;
  }
}

// =============================================================================
// Skeleton Component
// =============================================================================

export function ContentPreviewSkeleton({
  variant = 'default',
  className,
}: {
  variant?: ContentPreviewVariant;
  className?: string;
}) {
  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-3 p-2', className)}>
        <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
        <div className="flex-1 space-y-1">
          <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
          <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('p-4 space-y-3', className)}>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
        <div className="flex-1 space-y-1">
          <div className="h-4 w-32 bg-muted rounded animate-pulse" />
          <div className="h-3 w-24 bg-muted rounded animate-pulse" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-4 w-full bg-muted rounded animate-pulse" />
        <div className="h-4 w-5/6 bg-muted rounded animate-pulse" />
        <div className="h-4 w-4/6 bg-muted rounded animate-pulse" />
      </div>
      {variant === 'expanded' && (
        <div className="flex gap-2 mt-3">
          <div className="h-6 w-16 bg-muted rounded animate-pulse" />
          <div className="h-6 w-16 bg-muted rounded animate-pulse" />
          <div className="h-6 w-16 bg-muted rounded animate-pulse" />
        </div>
      )}
    </div>
  );
}

export default ContentPreview;
