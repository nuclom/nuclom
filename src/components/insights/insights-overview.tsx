"use client";

import { CheckCircle2, FileVideo, Lightbulb, ListTodo, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface InsightsOverviewData {
  totalVideosAnalyzed: number;
  totalHoursAnalyzed: number;
  totalDecisions: number;
  avgConfidence: number;
  actionItems: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    completionRate: number;
  };
}

interface InsightsOverviewProps {
  data: InsightsOverviewData;
  trends?: {
    videosChange: number;
  };
}

export function InsightsOverview({ data, trends }: InsightsOverviewProps) {
  const metrics = [
    {
      title: "Videos Analyzed",
      value: data.totalVideosAnalyzed.toLocaleString(),
      icon: FileVideo,
      description: `${data.totalHoursAnalyzed} hours of content`,
      trend: trends?.videosChange,
    },
    {
      title: "Decisions Extracted",
      value: data.totalDecisions.toLocaleString(),
      icon: Lightbulb,
      description: `${data.avgConfidence}% avg. confidence`,
    },
    {
      title: "Action Items",
      value: data.actionItems.total.toLocaleString(),
      icon: ListTodo,
      description: `${data.actionItems.pending} pending`,
    },
    {
      title: "Completion Rate",
      value: `${data.actionItems.completionRate}%`,
      icon: CheckCircle2,
      description: `${data.actionItems.completed} completed`,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
              <metric.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold">{metric.value}</div>
                {metric.trend !== undefined && metric.trend !== 0 && (
                  <div className={`flex items-center text-xs ${metric.trend > 0 ? "text-green-600" : "text-red-600"}`}>
                    {metric.trend > 0 ? (
                      <TrendingUp className="h-3 w-3 mr-0.5" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-0.5" />
                    )}
                    {Math.abs(metric.trend)}%
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{metric.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Action Items Progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Action Item Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Progress value={data.actionItems.completionRate} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-yellow-500" />
                  Pending: {data.actionItems.pending}
                </span>
                <span className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  In Progress: {data.actionItems.inProgress}
                </span>
                <span className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  Completed: {data.actionItems.completed}
                </span>
              </div>
              <span>{data.actionItems.completionRate}% complete</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
