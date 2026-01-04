"use client";

import { Calendar, CheckCircle, Clock, FileVideo, Lightbulb, Sparkles, TrendingUp, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface SummaryStats {
  totalVideos: number;
  totalHours: number;
  totalDecisions: number;
  actionItems: {
    total: number;
    completed: number;
    pending: number;
    completionRate: number;
  };
}

interface TopSpeaker {
  name: string;
  speakingTime: number;
  videoCount: number;
}

interface TopVideo {
  id: string;
  title: string;
  views: number;
}

interface InsightsSummaryProps {
  summary: {
    period: string;
    periodLabel: string;
    generatedAt: string;
  };
  stats: SummaryStats;
  highlights: string[];
  recommendations: string[];
  topSpeakers: TopSpeaker[];
  topVideos: TopVideo[];
}

function formatSpeakingTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export function InsightsSummary({
  summary,
  stats,
  highlights,
  recommendations,
  topSpeakers,
  topVideos,
}: InsightsSummaryProps) {
  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle>Weekly Insights Summary</CardTitle>
            </div>
            <Badge variant="secondary" className="text-xs">
              <Calendar className="h-3 w-3 mr-1" />
              {summary.periodLabel}
            </Badge>
          </div>
          <CardDescription>
            Generated on{" "}
            {new Date(summary.generatedAt).toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileVideo className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalVideos}</p>
                <p className="text-xs text-muted-foreground">Videos Analyzed</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Clock className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalHours}h</p>
                <p className="text-xs text-muted-foreground">Content Hours</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Lightbulb className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalDecisions}</p>
                <p className="text-xs text-muted-foreground">Decisions Made</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <CheckCircle className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.actionItems.completionRate}%</p>
                <p className="text-xs text-muted-foreground">Tasks Completed</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Key Highlights */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Key Highlights
            </CardTitle>
          </CardHeader>
          <CardContent>
            {highlights.length > 0 ? (
              <ul className="space-y-2">
                {highlights.map((highlight, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <span className="text-primary mt-1">•</span>
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No highlights for this period</p>
            )}
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              AI Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recommendations.length > 0 ? (
              <ul className="space-y-2">
                {recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <span className="text-yellow-500 mt-1">→</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground text-green-600">
                Great job! No recommendations at this time.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Speakers */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              Top Contributors
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topSpeakers.length > 0 ? (
              <div className="space-y-3">
                {topSpeakers.map((speaker, index) => (
                  <div key={speaker.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-muted-foreground w-4">{index + 1}.</span>
                      <span className="text-sm font-medium">{speaker.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatSpeakingTime(speaker.speakingTime)}</span>
                      <span>•</span>
                      <span>{speaker.videoCount} videos</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No speaker data available</p>
            )}
          </CardContent>
        </Card>

        {/* Top Videos */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileVideo className="h-4 w-4" />
              Most Viewed
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topVideos.length > 0 ? (
              <div className="space-y-3">
                {topVideos.map((video, index) => (
                  <div key={video.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-muted-foreground w-4">{index + 1}.</span>
                      <span className="text-sm font-medium truncate max-w-[200px]">{video.title}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {video.views} views
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No video data available</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
