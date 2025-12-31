"use client";

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ViewsChartProps {
  data: Array<{
    date: string;
    viewCount: number;
  }>;
  period: string;
}

export function ViewsChart({ data, period }: ViewsChartProps) {
  const maxViews = useMemo(() => Math.max(...data.map((d) => d.viewCount), 1), [data]);

  const periodLabel = useMemo(() => {
    switch (period) {
      case "7d":
        return "Last 7 days";
      case "30d":
        return "Last 30 days";
      case "90d":
        return "Last 90 days";
      default:
        return "All time";
    }
  }, [period]);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Views Over Time</CardTitle>
          <CardDescription>{periodLabel}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">No view data available</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Views Over Time</CardTitle>
        <CardDescription>{periodLabel}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] flex items-end gap-1">
          {data.map((day, index) => {
            const height = (day.viewCount / maxViews) * 100;
            const date = new Date(day.date);
            const formattedDate = date.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });

            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group">
                <div className="relative w-full flex justify-center">
                  <div
                    className="w-full max-w-8 bg-primary rounded-t transition-all hover:bg-primary/80"
                    style={{ height: `${Math.max(height, 4)}%` }}
                    title={`${formattedDate}: ${day.viewCount} views`}
                  />
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                    {day.viewCount} views
                  </div>
                </div>
                {(index === 0 || index === data.length - 1 || data.length <= 14) && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
