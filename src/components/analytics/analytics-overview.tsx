"use client";

import { BarChart3, Clock, Eye, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AnalyticsOverviewProps {
  data: {
    totalViews: number;
    uniqueViewers: number;
    totalWatchTime: number;
    avgCompletionPercent: number;
    totalVideos: number;
  };
}

function formatWatchTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export function AnalyticsOverview({ data }: AnalyticsOverviewProps) {
  const metrics = [
    {
      title: "Total Views",
      value: data.totalViews.toLocaleString(),
      icon: Eye,
      description: `Across ${data.totalVideos} videos`,
    },
    {
      title: "Unique Viewers",
      value: data.uniqueViewers.toLocaleString(),
      icon: Users,
      description: "Authenticated users",
    },
    {
      title: "Total Watch Time",
      value: formatWatchTime(data.totalWatchTime),
      icon: Clock,
      description: "Combined viewing time",
    },
    {
      title: "Avg. Completion",
      value: `${data.avgCompletionPercent}%`,
      icon: BarChart3,
      description: "Average video completion",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => (
        <Card key={metric.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
            <metric.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metric.value}</div>
            <p className="text-xs text-muted-foreground">{metric.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
