'use client';

import { cn } from '@nuclom/lib/utils';
import { Loader2, Plus, RefreshCw, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { TopicCard, type TopicData } from './topic-card';

// =============================================================================
// Types
// =============================================================================

interface TopicListProps {
  organizationId: string;
  organizationSlug: string;
  className?: string;
}

interface TopicItem {
  id: string;
  name: string;
  description: string | null;
  keywords: string[];
  contentCount: number;
  createdAt: string;
  updatedAt: string;
  parentId: string | null;
}

type TopicsResponse = TopicItem[];

// =============================================================================
// Fetcher
// =============================================================================

const fetcher = async (url: string): Promise<TopicsResponse> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch topics');
  }
  return response.json();
};

// =============================================================================
// Component
// =============================================================================

export function TopicList({ organizationId, organizationSlug, className }: TopicListProps) {
  const router = useRouter();
  const [isAutoClustering, setIsAutoClustering] = useState(false);

  const { data: topics, error, isLoading, mutate } = useSWR<TopicsResponse>(
    `/api/knowledge/topics?organizationId=${organizationId}`,
    fetcher,
  );

  const handleAutoCluster = async () => {
    setIsAutoClustering(true);
    try {
      const response = await fetch('/api/knowledge/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          autoCreate: true,
          minClusterSize: 3,
          maxClusters: 20,
          useAI: true,
        }),
      });

      if (response.ok) {
        mutate();
      }
    } finally {
      setIsAutoClustering(false);
    }
  };

  const handleTopicClick = (topic: TopicData) => {
    router.push(`/org/${organizationSlug}/topics/${topic.id}`);
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Topics</h1>
          <p className="text-muted-foreground">
            Explore topics discovered from your content
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isLoading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleAutoCluster} disabled={isAutoClustering}>
            <Sparkles className={cn('h-4 w-4 mr-2', isAutoClustering && 'animate-pulse')} />
            Auto-Discover
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="text-center py-12">
          <p className="text-sm text-destructive">Failed to load topics. Please try again.</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => mutate()}>
            Retry
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && topics?.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            No topics discovered yet. Click "Auto-Discover" to automatically cluster your content into topics.
          </p>
          <Button onClick={handleAutoCluster} disabled={isAutoClustering}>
            <Sparkles className="h-4 w-4 mr-2" />
            Discover Topics
          </Button>
        </div>
      )}

      {/* Topic grid */}
      {!isLoading && !error && topics && topics.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {topics.map((topic) => (
            <TopicCard
              key={topic.id}
              topic={topic}
              onClick={() => handleTopicClick(topic)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
