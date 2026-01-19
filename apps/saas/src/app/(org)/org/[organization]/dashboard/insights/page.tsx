'use client';

import { Brain, Download, Loader2, RefreshCw } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useState } from 'react';
import useSWR from 'swr';
import { ActionItemTracker } from '@/components/insights/action-item-tracker';
import { InsightsOverview } from '@/components/insights/insights-overview';
import { InsightsSummary } from '@/components/insights/insights-summary';
import { KeywordCloud } from '@/components/insights/keyword-cloud';
import { MeetingEffectiveness } from '@/components/insights/meeting-effectiveness';
import { MeetingPatterns } from '@/components/insights/meeting-patterns';
import { TopicTrends } from '@/components/insights/topic-trends';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface OrganizationData {
  id: string;
  name: string;
  slug: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function InsightsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-9 w-56 bg-muted animate-pulse rounded" />
          <div className="h-4 w-80 bg-muted animate-pulse rounded mt-2" />
        </div>
        <div className="h-10 w-[150px] bg-muted animate-pulse rounded" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={`skeleton-${i}`} className="h-32 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
      <div className="h-16 rounded-lg bg-muted animate-pulse" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-64 rounded-lg bg-muted animate-pulse" />
        <div className="h-64 rounded-lg bg-muted animate-pulse" />
      </div>
    </div>
  );
}

function InsightsContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const organizationSlug = params.organization as string;

  const period = searchParams.get('period') || '30d';
  const tab = searchParams.get('tab') || 'overview';

  // First fetch organization by slug
  const { data: orgData, isLoading: isOrgLoading } = useSWR<{ success: boolean; data: OrganizationData }>(
    `/api/organizations/slug/${organizationSlug}`,
    fetcher,
  );

  const organization = orgData?.data;
  const organizationId = organization?.id;

  // Fetch insights data
  const {
    data: overviewData,
    isLoading: isOverviewLoading,
    mutate: mutateOverview,
  } = useSWR(
    organizationId ? `/api/insights/overview?organizationId=${organizationId}&period=${period}` : null,
    fetcher,
    { refreshInterval: 120000 },
  );

  const {
    data: topicsData,
    isLoading: isTopicsLoading,
    mutate: mutateTopics,
  } = useSWR(
    organizationId ? `/api/insights/topics?organizationId=${organizationId}&period=${period}` : null,
    fetcher,
    { refreshInterval: 120000 },
  );

  const {
    data: actionItemsData,
    isLoading: isActionItemsLoading,
    mutate: mutateActionItems,
  } = useSWR(
    organizationId ? `/api/insights/action-items?organizationId=${organizationId}&period=${period}&limit=50` : null,
    fetcher,
    { refreshInterval: 60000 },
  );

  const {
    data: effectivenessData,
    isLoading: isEffectivenessLoading,
    mutate: mutateEffectiveness,
  } = useSWR(
    organizationId ? `/api/insights/effectiveness?organizationId=${organizationId}&period=${period}` : null,
    fetcher,
    { refreshInterval: 120000 },
  );

  const {
    data: keywordsData,
    isLoading: isKeywordsLoading,
    mutate: mutateKeywords,
  } = useSWR(
    organizationId ? `/api/insights/keywords?organizationId=${organizationId}&period=${period}` : null,
    fetcher,
    { refreshInterval: 120000 },
  );

  const {
    data: summaryData,
    isLoading: isSummaryLoading,
    mutate: mutateSummary,
  } = useSWR(
    organizationId ? `/api/insights/summary?organizationId=${organizationId}&period=${period}` : null,
    fetcher,
    { refreshInterval: 120000 },
  );

  const {
    data: patternsData,
    isLoading: isPatternsLoading,
    mutate: mutatePatterns,
  } = useSWR(
    organizationId ? `/api/insights/patterns?organizationId=${organizationId}&period=${period}` : null,
    fetcher,
    { refreshInterval: 120000 },
  );

  const [isExporting, setIsExporting] = useState(false);

  const handlePeriodChange = (newPeriod: string) => {
    router.push(`/org/${organizationSlug}/dashboard/insights?period=${newPeriod}&tab=${tab}`);
  };

  const handleTabChange = (newTab: string) => {
    router.push(`/org/${organizationSlug}/dashboard/insights?period=${period}&tab=${newTab}`);
  };

  const handleRefresh = useCallback(() => {
    mutateOverview();
    mutateTopics();
    mutateActionItems();
    mutateEffectiveness();
    mutateKeywords();
    mutateSummary();
    mutatePatterns();
  }, [
    mutateOverview,
    mutateTopics,
    mutateActionItems,
    mutateEffectiveness,
    mutateKeywords,
    mutateSummary,
    mutatePatterns,
  ]);

  const handleExport = async (format: 'csv' | 'json', type: string = 'all') => {
    if (!organizationId) return;

    setIsExporting(true);
    try {
      const response = await fetch(
        `/api/insights/export?organizationId=${organizationId}&period=${period}&format=${format}&type=${type}`,
      );

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `insights-export-${type}-${period}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleActionItemStatusChange = async (id: string, status: string) => {
    try {
      const response = await fetch(`/api/insights/action-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        mutateActionItems();
        mutateOverview();
      }
    } catch (error) {
      console.error('Failed to update action item:', error);
    }
  };

  const isLoading =
    isOrgLoading ||
    isOverviewLoading ||
    isTopicsLoading ||
    isActionItemsLoading ||
    isEffectivenessLoading ||
    isKeywordsLoading ||
    isSummaryLoading ||
    isPatternsLoading;

  if (isOrgLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const overview = overviewData?.data;
  const topics = topicsData?.data;
  const actionItems = actionItemsData?.data;
  const effectiveness = effectivenessData?.data;
  const keywords = keywordsData?.data;
  const summary = summaryData?.data;
  const patterns = patternsData?.data;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Brain className="h-8 w-8" />
            AI Insights Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">Actionable intelligence from your team&apos;s video meetings</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>

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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={isExporting}>
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('csv', 'all')}>Export All (CSV)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('json', 'all')}>Export All (JSON)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('csv', 'videos')}>Videos Only (CSV)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('csv', 'decisions')}>Decisions Only (CSV)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('csv', 'action-items')}>
                Action Items (CSV)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Overview Section - Always visible */}
      {overview && <InsightsOverview data={overview.overview} trends={overview.trends} />}

      {/* Tabbed Content */}
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 lg:w-auto lg:inline-grid">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="overview">Topics</TabsTrigger>
          <TabsTrigger value="patterns">Patterns</TabsTrigger>
          <TabsTrigger value="action-items">Action Items</TabsTrigger>
          <TabsTrigger value="effectiveness">Effectiveness</TabsTrigger>
          <TabsTrigger value="keywords">Keywords</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-6">
          {isSummaryLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : summary ? (
            <InsightsSummary
              summary={summary.summary}
              stats={summary.stats}
              highlights={summary.highlights}
              recommendations={summary.recommendations}
              topSpeakers={summary.topSpeakers}
              topVideos={summary.topVideos}
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">No summary data available</div>
          )}
        </TabsContent>

        <TabsContent value="overview" className="mt-6">
          {isTopicsLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : topics ? (
            <TopicTrends topics={topics.topics} trending={topics.trending} summary={topics.summary} />
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">No topic data available</div>
          )}
        </TabsContent>

        <TabsContent value="patterns" className="mt-6">
          {isPatternsLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : patterns ? (
            <MeetingPatterns
              timeDistribution={patterns.timeDistribution}
              speakerPatterns={patterns.speakerPatterns}
              meetingFrequency={patterns.meetingFrequency}
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              No patterns data available
            </div>
          )}
        </TabsContent>

        <TabsContent value="action-items" className="mt-6">
          {isActionItemsLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : actionItems ? (
            <ActionItemTracker
              actionItems={actionItems.actionItems}
              stats={actionItems.stats}
              onStatusChange={handleActionItemStatusChange}
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">No action items found</div>
          )}
        </TabsContent>

        <TabsContent value="effectiveness" className="mt-6">
          {isEffectivenessLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : effectiveness ? (
            <MeetingEffectiveness
              metrics={effectiveness.metrics}
              effectivenessScore={effectiveness.effectivenessScore}
              scoreBreakdown={effectiveness.scoreBreakdown}
              weeklyTrends={effectiveness.weeklyTrends}
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              No effectiveness data available
            </div>
          )}
        </TabsContent>

        <TabsContent value="keywords" className="mt-6">
          {isKeywordsLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : keywords ? (
            <KeywordCloud keywords={keywords.keywords} categories={keywords.categories} summary={keywords.summary} />
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">No keywords found</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function InsightsPage() {
  return (
    <Suspense fallback={<InsightsSkeleton />}>
      <InsightsContent />
    </Suspense>
  );
}
