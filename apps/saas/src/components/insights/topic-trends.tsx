'use client';

import { Badge } from '@nuclom/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nuclom/ui/card';
import { ArrowDown, ArrowUp, Minus, TrendingDown, TrendingUp } from 'lucide-react';

interface Topic {
  id: string | null;
  name: string;
  mentionCount: number;
  videoCount: number | null;
  trend: 'rising' | 'stable' | 'declining';
  trendScore: number;
  keywords: string[];
  lastMentionedAt: string | null;
}

interface TopicTrendsProps {
  topics: Topic[];
  trending?: {
    rising: Topic[];
    declining: Topic[];
  };
  summary?: {
    totalTopics: number;
    risingCount: number;
    decliningCount: number;
  };
}

function TrendIcon({ trend, score }: { trend: 'rising' | 'stable' | 'declining'; score: number }) {
  if (trend === 'rising') {
    return (
      <div className="flex items-center text-green-600">
        <ArrowUp className="h-4 w-4" />
        {score > 0 && <span className="text-xs ml-0.5">+{score}</span>}
      </div>
    );
  }
  if (trend === 'declining') {
    return (
      <div className="flex items-center text-red-600">
        <ArrowDown className="h-4 w-4" />
        {score < 0 && <span className="text-xs ml-0.5">{score}</span>}
      </div>
    );
  }
  return (
    <div className="flex items-center text-muted-foreground">
      <Minus className="h-4 w-4" />
    </div>
  );
}

function getTrendBadgeVariant(trend: 'rising' | 'stable' | 'declining') {
  switch (trend) {
    case 'rising':
      return 'default';
    case 'declining':
      return 'destructive';
    default:
      return 'secondary';
  }
}

export function TopicTrends({ topics, trending, summary }: TopicTrendsProps) {
  const displayTopics = topics.slice(0, 10);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Rising Topics */}
      {trending && trending.rising.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              Rising Topics
            </CardTitle>
            <CardDescription>Topics gaining traction recently</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {trending.rising.slice(0, 5).map((topic, index) => (
                <div key={topic.id || topic.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-4">{index + 1}.</span>
                    <span className="font-medium text-sm">{topic.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {topic.mentionCount} mentions
                    </Badge>
                    <TrendIcon trend={topic.trend} score={topic.trendScore} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Declining Topics */}
      {trending && trending.declining.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-600" />
              Declining Topics
            </CardTitle>
            <CardDescription>Topics with reduced discussion</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {trending.declining.slice(0, 5).map((topic, index) => (
                <div key={topic.id || topic.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-4">{index + 1}.</span>
                    <span className="font-medium text-sm">{topic.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {topic.mentionCount} mentions
                    </Badge>
                    <TrendIcon trend={topic.trend} score={topic.trendScore} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Topics */}
      <Card className="md:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">All Topics</CardTitle>
          <CardDescription>
            {summary?.totalTopics || topics.length} topics tracked
            {summary && (
              <span className="ml-2">
                ({summary.risingCount} rising, {summary.decliningCount} declining)
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {displayTopics.map((topic) => (
              <div
                key={topic.id || topic.name}
                className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{topic.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {topic.mentionCount} mentions
                    {topic.videoCount && ` in ${topic.videoCount} videos`}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <Badge variant={getTrendBadgeVariant(topic.trend)} className="text-xs">
                    {topic.trend}
                  </Badge>
                  <TrendIcon trend={topic.trend} score={topic.trendScore} />
                </div>
              </div>
            ))}
          </div>
          {topics.length > 10 && (
            <p className="text-xs text-muted-foreground text-center mt-4">Showing top 10 of {topics.length} topics</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
