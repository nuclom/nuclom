'use client';

import { cn } from '@nuclom/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nuclom/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@nuclom/ui/tabs';
import { Lightbulb, Target, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import useSWR from 'swr';
import { InsightCards } from './insight-cards';
import { RecommendationsPanel } from './recommendations-panel';
import { TrendsSection } from './trends-section';

interface InsightsDashboardProps {
  organizationId: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function InsightsDashboard({ organizationId }: InsightsDashboardProps) {
  const [activeTab, setActiveTab] = useState('insights');

  const { data: insights, isLoading: insightsLoading } = useSWR(
    `/api/ai/insights?organizationId=${organizationId}`,
    fetcher,
  );

  const { data: recommendations, isLoading: recommendationsLoading } = useSWR(
    `/api/ai/insights/recommendations?organizationId=${organizationId}`,
    fetcher,
  );

  const { data: trends, isLoading: trendsLoading } = useSWR(
    `/api/ai/insights/trends?organizationId=${organizationId}`,
    fetcher,
  );

  const insightCount = Array.isArray(insights) ? insights.length : 0;
  const highImpactRecs = Array.isArray(recommendations)
    ? recommendations.filter((r: { impact: string }) => r.impact === 'high').length
    : 0;
  const trendCount = Array.isArray(trends) ? trends.length : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Insights</h1>
        <p className="text-muted-foreground">
          Proactive insights, recommendations, and trends from your knowledge base
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          className={cn(
            'cursor-pointer transition-colors hover:bg-muted/50',
            activeTab === 'insights' && 'border-primary',
          )}
          onClick={() => setActiveTab('insights')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              Proactive Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insightsLoading ? '-' : insightCount}</div>
            <p className="text-xs text-muted-foreground">Patterns detected</p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            'cursor-pointer transition-colors hover:bg-muted/50',
            activeTab === 'recommendations' && 'border-primary',
          )}
          onClick={() => setActiveTab('recommendations')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-green-500" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {recommendationsLoading ? '-' : Array.isArray(recommendations) ? recommendations.length : 0}
            </div>
            {highImpactRecs > 0 && (
              <p className="text-xs text-green-600 dark:text-green-400">{highImpactRecs} high impact</p>
            )}
          </CardContent>
        </Card>

        <Card
          className={cn(
            'cursor-pointer transition-colors hover:bg-muted/50',
            activeTab === 'trends' && 'border-primary',
          )}
          onClick={() => setActiveTab('trends')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trendsLoading ? '-' : trendCount}</div>
            <p className="text-xs text-muted-foreground">Topics tracked</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Proactive Insights</CardTitle>
              <CardDescription>
                AI-generated insights based on patterns and trends in your organization's knowledge
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InsightCards insights={insights} isLoading={insightsLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Recommendations</CardTitle>
              <CardDescription>Actionable recommendations to improve your knowledge management</CardDescription>
            </CardHeader>
            <CardContent>
              <RecommendationsPanel recommendations={recommendations} isLoading={recommendationsLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Topic Trends</CardTitle>
              <CardDescription>Track how topics are evolving over time in your organization</CardDescription>
            </CardHeader>
            <CardContent>
              <TrendsSection trends={trends} isLoading={trendsLoading} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
