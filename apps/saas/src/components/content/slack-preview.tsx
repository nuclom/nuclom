'use client';

/**
 * Slack Message Preview Component
 *
 * Renders Slack messages and threads with appropriate styling:
 * - Thread structure with reply count
 * - User avatars and names
 * - Reaction emoji display
 * - Channel name and timestamp
 * - File attachment indicators
 */

import type { ContentItem, ContentItemMetadata } from '@nuclom/lib/db/schema';
import { formatRelativeTimeCompact, getInitials } from '@nuclom/lib/format-utils';
import { cn } from '@nuclom/lib/utils';
import { Hash, MessageSquare, Paperclip, Reply } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { ContentPreviewVariant } from './content-preview';
import { InteractiveCard } from './interactive-card';

// =============================================================================
// Types
// =============================================================================

interface SlackMetadata extends ContentItemMetadata {
  channelId?: string;
  channelName?: string;
  threadTs?: string;
  replyCount?: number;
  reactions?: Array<{ emoji?: string; name?: string; count: number; users?: string[] }>;
  files?: Array<{ id: string; name: string; type: string; storageKey?: string }>;
  authorAvatar?: string;
}

export interface SlackPreviewProps {
  item: ContentItem;
  variant?: ContentPreviewVariant;
  showSource?: boolean;
  showAuthor?: boolean;
  showTimestamp?: boolean;
  className?: string;
  onClick?: () => void;
}

// =============================================================================
// Component
// =============================================================================

export function SlackPreview({
  item,
  variant = 'default',
  showSource = true,
  showAuthor = true,
  showTimestamp = true,
  className,
  onClick,
}: SlackPreviewProps) {
  const metadata = item.metadata as SlackMetadata;
  const isThread = item.type === 'thread' || (metadata.replyCount && metadata.replyCount > 0);
  const hasAttachments = metadata.files && metadata.files.length > 0;

  // Compact variant
  if (variant === 'compact') {
    return (
      <InteractiveCard variant="compact" onClick={onClick} className={className}>
        {showAuthor && (
          <Avatar className="h-6 w-6">
            <AvatarImage src={metadata.authorAvatar} alt={item.authorName || 'User'} />
            <AvatarFallback className="text-xs">{getInitials(item.authorName)}</AvatarFallback>
          </Avatar>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate">{item.title || item.content?.slice(0, 100)}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {showSource && metadata.channelName && (
              <span className="flex items-center gap-0.5">
                <Hash className="h-3 w-3" />
                {metadata.channelName}
              </span>
            )}
            {showTimestamp && item.createdAtSource && <span>{formatRelativeTimeCompact(item.createdAtSource)}</span>}
          </div>
        </div>
        {isThread && (
          <Badge variant="secondary" className="text-xs">
            <Reply className="h-3 w-3 mr-1" />
            {metadata.replyCount}
          </Badge>
        )}
      </InteractiveCard>
    );
  }

  // Default and expanded variants
  return (
    <InteractiveCard onClick={onClick} className={className}>
      {/* Header */}
      <div className="flex items-start gap-3">
        {showAuthor && (
          <Avatar className="h-10 w-10">
            <AvatarImage src={metadata.authorAvatar} alt={item.authorName || 'User'} />
            <AvatarFallback>{getInitials(item.authorName)}</AvatarFallback>
          </Avatar>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {showAuthor && item.authorName && <span className="font-medium text-sm">{item.authorName}</span>}
            {showSource && metadata.channelName && (
              <Badge variant="outline" className="text-xs font-normal">
                <Hash className="h-3 w-3 mr-0.5" />
                {metadata.channelName}
              </Badge>
            )}
            {showTimestamp && item.createdAtSource && (
              <span className="text-xs text-muted-foreground">{formatRelativeTimeCompact(item.createdAtSource)}</span>
            )}
          </div>

          {/* Content */}
          <div className="mt-2">
            {item.title && item.title !== item.content?.slice(0, 100) && (
              <p className="font-medium text-sm mb-1">{item.title}</p>
            )}
            <p className={cn('text-sm text-foreground/90', variant === 'default' && 'line-clamp-3')}>{item.content}</p>
          </div>

          {/* Attachments */}
          {hasAttachments && (
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <Paperclip className="h-3 w-3" />
              <span>
                {metadata.files?.length ?? 0} attachment{metadata.files?.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {/* Reactions */}
          {metadata.reactions && metadata.reactions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {metadata.reactions.map((reaction, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs px-2 py-0.5 gap-1">
                  <span>{reaction.emoji || `:${reaction.name}:`}</span>
                  <span className="text-muted-foreground">{reaction.count}</span>
                </Badge>
              ))}
            </div>
          )}

          {/* Thread indicator */}
          {isThread && (
            <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
              <span>
                {metadata.replyCount} repl{metadata.replyCount !== 1 ? 'ies' : 'y'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Expanded: Show summary if available */}
      {variant === 'expanded' && item.summary && (
        <div className="mt-4 pt-4 border-t">
          <p className="text-xs font-medium text-muted-foreground mb-1">Summary</p>
          <p className="text-sm">{item.summary}</p>
        </div>
      )}
    </InteractiveCard>
  );
}

export default SlackPreview;
