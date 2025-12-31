"use client";

import { BarChart3, Loader2 } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { AnalyticsOverview } from "@/components/analytics/analytics-overview";
import { TopVideosTable } from "@/components/analytics/top-videos-table";
import { ViewsChart } from "@/components/analytics/views-chart";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

interface OrganizationData {
  id: string;
  name: string;
  slug: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AnalyticsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const organizationSlug = params.organization as string;

  const period = searchParams.get("period") || "30d";

  // First fetch organization by slug
  const { data: orgData, isLoading: isOrgLoading } = useSWR<{ success: boolean; data: OrganizationData }>(
    `/api/organizations/slug/${organizationSlug}`,
    fetcher,
  );

  const organization = orgData?.data;

  // Then fetch analytics
  const { data, error, isLoading } = useSWR<{ success: boolean; data: AnalyticsData }>(
    organization ? `/api/organizations/${organization.id}/analytics?period=${period}` : null,
    fetcher,
    { refreshInterval: 60000 }, // Refresh every minute
  );

  const handlePeriodChange = (newPeriod: string) => {
    router.push(`/${organizationSlug}/analytics?period=${newPeriod}`);
  };

  if (isOrgLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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

        <Select value={period} onValueChange={handlePeriodChange}>
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
          <TopVideosTable videos={data.data.topVideos} organizationSlug={organizationSlug} />
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
