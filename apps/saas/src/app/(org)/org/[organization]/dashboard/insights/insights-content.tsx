'use client';

import { Brain, Download, Loader2, RefreshCw } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import useSWR from 'swr';
import { InsightsOverview } from '@/components/insights/insights-overview';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Dynamic imports for tab content - only loads when tab is active
const InsightsSummary = dynamic(() => import('@/components/insights/insights-summary').then((m) => m.InsightsSummary), {
  loading: () => <TabContentLoader />,
});
const TopicTrends = dynamic(() => import('@/components/insights/topic-trends').then((m) => m.TopicTrends), {
  loading: () => <TabContentLoader />,
});
const MeetingPatterns = dynamic(() => import('@/components/insights/meeting-patterns').then((m) => m.MeetingPatterns), {
  loading: () => <TabContentLoader />,
});
const ActionItemTracker = dynamic(
  () => import('@/components/insights/action-item-tracker').then((m) => m.ActionItemTracker),
  { loading: () => <TabContentLoader /> },
);
const MeetingEffectiveness = dynamic(
  () => import('@/components/insights/meeting-effectiveness').then((m) => m.MeetingEffectiveness),
  { loading: () => <TabContentLoader /> },
);
const KeywordCloud = dynamic(() => import('@/components/insights/keyword-cloud').then((m) => m.KeywordCloud), {
  loading: () => <TabContentLoader />,
});

function TabContentLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface InsightsContentProps {
  organization: Organization;
  initialPeriod: string;
  initialTab: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function InsightsSkeleton() {
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

export function InsightsContent({ organization, initialPeriod, initialTab }: InsightsContentProps) {
  const router = useRouter();
  const [isExporting, setIsExporting] = useState(false);

  // All data fetches start immediately - NO waterfall since org is passed from server
  const {
    data: overviewData,
    isLoading: isOverviewLoading,
    mutate: mutateOverview,
  } = useSWR(`/api/insights/overview?organizationId=${organization.id}&period=${initialPeriod}`, fetcher, {
    refreshInterval: 120000,
  });

  const {
    data: topicsData,
    isLoading: isTopicsLoading,
    mutate: mutateTopics,
  } = useSWR(`/api/insights/topics?organizationId=${organization.id}&period=${initialPeriod}`, fetcher, {
    refreshInterval: 120000,
  });

  const {
    data: actionItemsData,
    isLoading: isActionItemsLoading,
    mutate: mutateActionItems,
  } = useSWR(`/api/insights/action-items?organizationId=${organization.id}&period=${initialPeriod}&limit=50`, fetcher, {
    refreshInterval: 60000,
  });

  const {
    data: effectivenessData,
    isLoading: isEffectivenessLoading,
    mutate: mutateEffectiveness,
  } = useSWR(`/api/insights/effectiveness?organizationId=${organization.id}&period=${initialPeriod}`, fetcher, {
    refreshInterval: 120000,
  });

  const {
    data: keywordsData,
    isLoading: isKeywordsLoading,
    mutate: mutateKeywords,
  } = useSWR(`/api/insights/keywords?organizationId=${organization.id}&period=${initialPeriod}`, fetcher, {
    refreshInterval: 120000,
  });

  const {
    data: summaryData,
    isLoading: isSummaryLoading,
    mutate: mutateSummary,
  } = useSWR(`/api/insights/summary?organizationId=${organization.id}&period=${initialPeriod}`, fetcher, {
    refreshInterval: 120000,
  });

  const {
    data: patternsData,
    isLoading: isPatternsLoading,
    mutate: mutatePatterns,
  } = useSWR(`/api/insights/patterns?organizationId=${organization.id}&period=${initialPeriod}`, fetcher, {
    refreshInterval: 120000,
  });

  const handlePeriodChange = (newPeriod: string) => {
    router.push(`/org/${organization.slug}/dashboard/insights?period=${newPeriod}&tab=${initialTab}`);
  };

  const handleTabChange = (newTab: string) => {
    router.push(`/org/${organization.slug}/dashboard/insights?period=${initialPeriod}&tab=${newTab}`);
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
    setIsExporting(true);
    try {
      const response = await fetch(
        `/api/insights/export?organizationId=${organization.id}&period=${initialPeriod}&format=${format}&type=${type}`,
      );

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `insights-export-${type}-${initialPeriod}.${format}`;
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
    isOverviewLoading ||
    isTopicsLoading ||
    isActionItemsLoading ||
    isEffectivenessLoading ||
    isKeywordsLoading ||
    isSummaryLoading ||
    isPatternsLoading;

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
      <Tabs value={initialTab} onValueChange={handleTabChange}>
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
            <TabContentLoader />
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
            <TabContentLoader />
          ) : topics ? (
            <TopicTrends topics={topics.topics} trending={topics.trending} summary={topics.summary} />
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">No topic data available</div>
          )}
        </TabsContent>

        <TabsContent value="patterns" className="mt-6">
          {isPatternsLoading ? (
            <TabContentLoader />
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
            <TabContentLoader />
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
            <TabContentLoader />
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
            <TabContentLoader />
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
