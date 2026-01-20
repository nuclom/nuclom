'use client';

import { cn } from '@nuclom/lib/utils';
import { Loader2, RefreshCw } from 'lucide-react';
import { useCallback, useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { FeedFilters, type FeedFilterType, type SourceFilter } from './feed-filters';
import { FeedItem, type FeedItemData } from './feed-item';

// =============================================================================
// Types
// =============================================================================

interface FeedResponse {
  items: FeedItemData[];
  total: number;
  contentCount: number;
  decisionCount: number;
  topicCount: number;
}

interface KnowledgeFeedProps {
  organizationId: string;
  className?: string;
}

// =============================================================================
// Fetcher
// =============================================================================

const fetcher = async (url: string): Promise<FeedResponse> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch feed');
  }
  return response.json();
};

// =============================================================================
// Component
// =============================================================================

export function KnowledgeFeed({ organizationId, className }: KnowledgeFeedProps) {
  const [typeFilter, setTypeFilter] = useState<FeedFilterType>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');

  // Build URL with filters
  const buildUrl = useCallback(() => {
    const params = new URLSearchParams({ organizationId, limit: '30' });
    if (sourceFilter !== 'all') {
      params.set('sourceType', sourceFilter);
    }
    return `/api/feed?${params.toString()}`;
  }, [organizationId, sourceFilter]);

  const { data, error, isLoading, mutate } = useSWR<FeedResponse>(buildUrl(), fetcher, {
    refreshInterval: 60000, // Refresh every minute
    revalidateOnFocus: true,
  });

  // Filter items based on type filter
  const filteredItems = data?.items.filter((item) => {
    if (typeFilter === 'all') return true;
    if (typeFilter === 'content') return item.type === 'content';
    if (typeFilter === 'decisions') return item.type === 'decision';
    if (typeFilter === 'topics') return item.type === 'topic';
    return true;
  });

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header with filters */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Knowledge Feed</h2>
          <p className="text-sm text-muted-foreground">
            Recent activity from all your sources
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => mutate()} disabled={isLoading}>
          <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <FeedFilters
        selectedType={typeFilter}
        selectedSource={sourceFilter}
        onTypeChange={setTypeFilter}
        onSourceChange={setSourceFilter}
      />

      {/* Stats */}
      {data && (
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{data.contentCount} content items</span>
          <span>{data.decisionCount} decisions</span>
          <span>{data.topicCount} topics</span>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="text-center py-8">
          <p className="text-sm text-destructive">Failed to load feed. Please try again.</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => mutate()}>
            Retry
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && filteredItems?.length === 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">
            No items found. Connect some sources to start seeing content here.
          </p>
        </div>
      )}

      {/* Feed items */}
      {!isLoading && !error && filteredItems && filteredItems.length > 0 && (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <FeedItem key={`${item.type}-${item.id}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
