"use client";

import { Brain, Loader2, RefreshCw } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback } from "react";
import useSWR from "swr";
import {
  ActionItemTracker,
  InsightsOverview,
  KeywordCloud,
  MeetingEffectiveness,
  TopicTrends,
} from "@/components/insights";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

  const period = searchParams.get("period") || "30d";
  const tab = searchParams.get("tab") || "overview";

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

  const handlePeriodChange = (newPeriod: string) => {
    router.push(`/${organizationSlug}/dashboard/insights?period=${newPeriod}&tab=${tab}`);
  };

  const handleTabChange = (newTab: string) => {
    router.push(`/${organizationSlug}/dashboard/insights?period=${period}&tab=${newTab}`);
  };

  const handleRefresh = useCallback(() => {
    mutateOverview();
    mutateTopics();
    mutateActionItems();
    mutateEffectiveness();
    mutateKeywords();
  }, [mutateOverview, mutateTopics, mutateActionItems, mutateEffectiveness, mutateKeywords]);

  const handleActionItemStatusChange = async (id: string, status: string) => {
    try {
      const response = await fetch(`/api/insights/action-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        mutateActionItems();
        mutateOverview();
      }
    } catch (error) {
      console.error("Failed to update action item:", error);
    }
  };

  const isLoading =
    isOrgLoading ||
    isOverviewLoading ||
    isTopicsLoading ||
    isActionItemsLoading ||
    isEffectivenessLoading ||
    isKeywordsLoading;

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
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
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
        </div>
      </div>

      {/* Overview Section - Always visible */}
      {overview && <InsightsOverview data={overview.overview} trends={overview.trends} />}

      {/* Tabbed Content */}
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview">Topics</TabsTrigger>
          <TabsTrigger value="action-items">Action Items</TabsTrigger>
          <TabsTrigger value="effectiveness">Effectiveness</TabsTrigger>
          <TabsTrigger value="keywords">Keywords</TabsTrigger>
        </TabsList>

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
