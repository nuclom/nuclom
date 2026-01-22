'use client';

import { BarChart3 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { AnalyticsOverview } from '@/components/analytics/analytics-overview';
import { TopVideosTable } from '@/components/analytics/top-videos-table';
import { ViewsChart } from '@/components/analytics/views-chart';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AnalyticsData {
  overview: {
    totalViews: number;
    uniqueViewers: number;
    totalWatchTime: number;
    avgCompletionPercent: number;
    totalVideos: number;
  };
  topVideos: Array<{
    videoId: string;
    viewCount: number;
    totalWatchTime: number;
    avgCompletion: number;
    video?: {
      id: string;
      title: string;
      thumbnailUrl: string | null;
      duration: string;
    };
  }>;
  viewsByDay: Array<{
    date: string;
    viewCount: number;
  }>;
  period: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface AnalyticsContentProps {
  organization: Organization;
  initialPeriod: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-9 w-48 bg-muted animate-pulse rounded" />
          <div className="h-4 w-64 bg-muted animate-pulse rounded mt-2" />
        </div>
        <div className="h-10 w-[150px] bg-muted animate-pulse rounded" />
      </div>
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={`skeleton-${i}`} className="h-32 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
        <div className="h-[300px] rounded-lg bg-muted animate-pulse" />
        <div className="h-[400px] rounded-lg bg-muted animate-pulse" />
      </div>
    </div>
  );
}

export function AnalyticsContent({ organization, initialPeriod }: AnalyticsContentProps) {
  const router = useRouter();

  // Fetch analytics directly using org.id - NO waterfall since org is passed from server
  const { data, error, isLoading } = useSWR<{ success: boolean; data: AnalyticsData }>(
    `/api/organizations/${organization.id}/analytics?period=${initialPeriod}`,
    fetcher,
    { refreshInterval: 60000 },
  );

  const handlePeriodChange = (newPeriod: string) => {
    router.push(`/org/${organization.slug}/analytics?period=${newPeriod}`);
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <BarChart3 className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Failed to load analytics</h2>
        <p className="text-muted-foreground">Please try again later</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BarChart3 className="h-8 w-8" />
            Analytics
          </h1>
          <p className="text-muted-foreground mt-1">Track video performance and viewer engagement</p>
        </div>

        <Select value={initialPeriod} onValueChange={handlePeriodChange}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          {/* Overview skeleton */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={`skeleton-${i}`} className="h-32 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
          {/* Chart skeleton */}
          <div className="h-[300px] rounded-lg bg-muted animate-pulse" />
          {/* Table skeleton */}
          <div className="h-[400px] rounded-lg bg-muted animate-pulse" />
        </div>
      ) : data?.data ? (
        <div className="space-y-6">
          <AnalyticsOverview data={data.data.overview} />
          <ViewsChart data={data.data.viewsByDay} period={data.data.period} />
          <TopVideosTable videos={data.data.topVideos} organizationSlug={organization.slug} />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <BarChart3 className="h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold">No analytics data yet</h2>
          <p className="text-muted-foreground">Start sharing videos to see analytics data here</p>
        </div>
      )}
    </div>
  );
}
