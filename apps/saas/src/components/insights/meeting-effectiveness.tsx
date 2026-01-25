'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nuclom/ui/card';
import { Progress } from '@nuclom/ui/progress';
import { BarChart3, CheckCircle2, Clock, Eye, Lightbulb, ListTodo, Target, TrendingUp, Video } from 'lucide-react';

interface EffectivenessMetrics {
  totalMeetings: number;
  avgDurationMinutes: number;
  totalDecisions: number;
  avgDecisionsPerMeeting: number;
  decisionRate: number;
  totalActionItems: number;
  completedActionItems: number;
  avgActionItemsPerMeeting: number;
  actionItemCompletionRate: number;
  avgEngagement: number;
  totalViews: number;
}

interface ScoreBreakdown {
  decisionMaking: number;
  followThrough: number;
  engagement: number;
  consistency: number;
}

interface WeeklyTrend {
  week: string;
  meetingCount: number;
  avgDurationMinutes: number;
}

interface MeetingEffectivenessProps {
  metrics: EffectivenessMetrics;
  effectivenessScore: number;
  scoreBreakdown: ScoreBreakdown;
  weeklyTrends?: WeeklyTrend[];
}

function ScoreRing({ score, label }: { score: number; label: string }) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return 'bg-green-600';
    if (score >= 60) return 'bg-yellow-600';
    if (score >= 40) return 'bg-orange-600';
    return 'bg-red-600';
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-24 w-24">
        <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100" role="img" aria-label={`Score: ${score}%`}>
          <title>
            {label}: {score}%
          </title>
          <circle className="stroke-muted" strokeWidth="10" fill="none" r="40" cx="50" cy="50" />
          <circle
            className={`${getProgressColor(score)} transition-all duration-500`}
            strokeWidth="10"
            strokeLinecap="round"
            fill="none"
            r="40"
            cx="50"
            cy="50"
            style={{
              strokeDasharray: `${2 * Math.PI * 40}`,
              strokeDashoffset: `${2 * Math.PI * 40 * (1 - score / 100)}`,
              stroke: 'currentColor',
            }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-2xl font-bold ${getScoreColor(score)}`}>{score}</span>
        </div>
      </div>
      <p className="text-sm font-medium mt-2">{label}</p>
    </div>
  );
}

function MetricRow({
  icon: Icon,
  label,
  value,
  subValue,
}: {
  icon: typeof Video;
  label: string;
  value: string | number;
  subValue?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm">{label}</span>
      </div>
      <div className="text-right">
        <span className="font-medium">{value}</span>
        {subValue && <span className="text-xs text-muted-foreground ml-1">{subValue}</span>}
      </div>
    </div>
  );
}

export function MeetingEffectiveness({
  metrics,
  effectivenessScore,
  scoreBreakdown,
  weeklyTrends,
}: MeetingEffectivenessProps) {
  const breakdownItems = [
    { label: 'Decision Making', value: scoreBreakdown.decisionMaking, icon: Lightbulb },
    { label: 'Follow-through', value: scoreBreakdown.followThrough, icon: CheckCircle2 },
    { label: 'Engagement', value: scoreBreakdown.engagement, icon: Eye },
    { label: 'Consistency', value: scoreBreakdown.consistency, icon: TrendingUp },
  ];

  // Calculate max for trend chart normalization
  const maxMeetings = weeklyTrends ? Math.max(...weeklyTrends.map((w) => w.meetingCount), 1) : 1;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Overall Score */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="h-4 w-4" />
            Meeting Effectiveness Score
          </CardTitle>
          <CardDescription>Composite score based on key metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <ScoreRing score={effectivenessScore} label="Overall Score" />
          </div>

          <div className="space-y-3 mt-4">
            {breakdownItems.map((item) => (
              <div key={item.label} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <item.icon className="h-3 w-3 text-muted-foreground" />
                    {item.label}
                  </span>
                  <span className="font-medium">{item.value}%</span>
                </div>
                <Progress value={item.value} className="h-1.5" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Metrics */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Meeting Metrics
          </CardTitle>
          <CardDescription>Detailed breakdown of meeting performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            <MetricRow icon={Video} label="Total Meetings" value={metrics.totalMeetings} subValue="analyzed" />
            <MetricRow icon={Clock} label="Avg. Duration" value={`${metrics.avgDurationMinutes} min`} />
            <MetricRow
              icon={Lightbulb}
              label="Decisions"
              value={metrics.totalDecisions}
              subValue={`${metrics.avgDecisionsPerMeeting}/meeting`}
            />
            <MetricRow
              icon={Target}
              label="Decision Rate"
              value={`${metrics.decisionRate}%`}
              subValue="meetings with decisions"
            />
            <MetricRow
              icon={ListTodo}
              label="Action Items"
              value={metrics.totalActionItems}
              subValue={`${metrics.avgActionItemsPerMeeting}/meeting`}
            />
            <MetricRow
              icon={CheckCircle2}
              label="Completion Rate"
              value={`${metrics.actionItemCompletionRate}%`}
              subValue={`${metrics.completedActionItems} done`}
            />
            <MetricRow
              icon={Eye}
              label="Engagement"
              value={`${metrics.avgEngagement}%`}
              subValue={`${metrics.totalViews} views`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Weekly Trend */}
      {weeklyTrends && weeklyTrends.length > 0 && (
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Weekly Activity
            </CardTitle>
            <CardDescription>Meetings analyzed over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between h-32 gap-1">
              {weeklyTrends.slice(-12).map((week, index) => {
                const height = (week.meetingCount / maxMeetings) * 100;
                return (
                  <div key={week.week} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex items-end justify-center h-24">
                      <div
                        className="w-full max-w-8 bg-primary rounded-t transition-all duration-300 hover:bg-primary/80"
                        style={{ height: `${Math.max(height, 4)}%` }}
                        title={`${week.meetingCount} meetings, ${week.avgDurationMinutes} min avg`}
                      />
                    </div>
                    {index % 2 === 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(week.week).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
