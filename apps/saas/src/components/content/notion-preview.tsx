'use client';

/**
 * Notion Page Preview Component
 *
 * Renders Notion pages and database entries with appropriate styling:
 * - Breadcrumb trail (page hierarchy)
 * - Page icon display
 * - Formatted content preview
 * - Database properties display
 * - Last edited timestamp
 */

import type { ContentItem, ContentItemMetadata } from '@nuclom/lib/db/schema';
import { formatRelativeTimeCompact } from '@nuclom/lib/format-utils';
import { cn } from '@nuclom/lib/utils';
import { ChevronRight, Database, FileText, PenLine } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ContentPreviewVariant } from './content-preview';
import { InteractiveCard } from './interactive-card';

// =============================================================================
// Types
// =============================================================================

interface NotionMetadata extends ContentItemMetadata {
  pageId?: string;
  databaseId?: string;
  parentId?: string;
  breadcrumbs?: string[];
  icon?: string;
  cover?: string;
  properties?: Record<string, unknown>;
  lastEditedBy?: string;
  isDatabase?: boolean;
}

export interface NotionPreviewProps {
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
 * Render an icon from Notion's icon format
 */
function renderIcon(icon: string | undefined, size: 'sm' | 'md' | 'lg' = 'md'): React.ReactNode {
  if (!icon) return null;

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl',
  };

  // Emoji icons
  if (icon.length <= 4) {
    return <span className={sizeClasses[size]}>{icon}</span>;
  }

  // URL icons (external images)
  if (icon.startsWith('http')) {
    const imgSize = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-8 w-8' : 'h-5 w-5';
    return <img src={icon} alt="" className={cn(imgSize, 'rounded')} />;
  }

  return null;
}

/**
 * Truncate content while preserving word boundaries
 */
function truncateContent(content: string | null, maxLength: number): string {
  if (!content) return '';
  if (content.length <= maxLength) return content;
  const truncated = content.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return `${lastSpace > maxLength * 0.7 ? truncated.slice(0, lastSpace) : truncated}...`;
}

// =============================================================================
// Component
// =============================================================================

export function NotionPreview({
  item,
  variant = 'default',
  showSource = true,
  showAuthor = true,
  showTimestamp = true,
  className,
  onClick,
}: NotionPreviewProps) {
  const metadata = item.metadata as NotionMetadata;
  const isDatabase = metadata.isDatabase ?? false;
  const hasBreadcrumbs = metadata.breadcrumbs && metadata.breadcrumbs.length > 0;

  // Compact variant
  if (variant === 'compact') {
    return (
      <InteractiveCard variant="compact" onClick={onClick} className={className}>
        <div className="h-6 w-6 flex items-center justify-center">
          {metadata.icon ? (
            renderIcon(metadata.icon, 'sm')
          ) : isDatabase ? (
            <Database className="h-4 w-4 text-blue-500" />
          ) : (
            <FileText className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate">{item.title || 'Untitled'}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {isDatabase && (
              <Badge variant="outline" className="text-xs px-1 py-0">
                Database
              </Badge>
            )}
            {showTimestamp && item.updatedAtSource && (
              <span>Edited {formatRelativeTimeCompact(item.updatedAtSource)}</span>
            )}
          </div>
        </div>
      </InteractiveCard>
    );
  }

  // Default and expanded variants
  return (
    <InteractiveCard onClick={onClick} className={className}>
      {/* Breadcrumbs */}
      {hasBreadcrumbs && showSource && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2 flex-wrap">
          {metadata.breadcrumbs?.map((crumb, idx) => (
            <span key={idx} className="flex items-center">
              {idx > 0 && <ChevronRight className="h-3 w-3 mx-0.5" />}
              <span className="truncate max-w-[120px]">{crumb}</span>
            </span>
          ))}
        </div>
      )}

      {/* Title */}
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 flex items-center justify-center shrink-0">
          {metadata.icon ? (
            renderIcon(metadata.icon, 'md')
          ) : isDatabase ? (
            <Database className="h-5 w-5 text-blue-500" />
          ) : (
            <FileText className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-base">{item.title || 'Untitled'}</h3>

          {/* Metadata line */}
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            {isDatabase && (
              <Badge variant="secondary" className="text-xs">
                <Database className="h-3 w-3 mr-1" />
                Database
              </Badge>
            )}
            {showTimestamp && item.updatedAtSource && (
              <span className="flex items-center gap-1">
                <PenLine className="h-3 w-3" />
                Edited {formatRelativeTimeCompact(item.updatedAtSource)}
              </span>
            )}
            {showAuthor && metadata.lastEditedBy && <span>by {metadata.lastEditedBy}</span>}
          </div>
        </div>
      </div>

      {/* Content preview */}
      {item.content && (
        <div className="mt-3">
          <p className={cn('text-sm text-muted-foreground', variant === 'default' && 'line-clamp-3')}>
            {variant === 'expanded' ? item.content : truncateContent(item.content, 200)}
          </p>
        </div>
      )}

      {/* Database properties (for database entries) */}
      {isDatabase && metadata.properties && variant === 'expanded' && (
        <div className="mt-4 pt-3 border-t">
          <p className="text-xs font-medium text-muted-foreground mb-2">Properties</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(metadata.properties)
              .slice(0, 6)
              .map(([key, value]) => (
                <Badge key={key} variant="outline" className="text-xs">
                  <span className="font-medium">{key}:</span>
                  <span className="ml-1">{String(value)}</span>
                </Badge>
              ))}
          </div>
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
                <span>{point.text || String(point)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </InteractiveCard>
  );
}

export default NotionPreview;
