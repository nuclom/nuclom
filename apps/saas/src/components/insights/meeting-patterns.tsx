'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nuclom/ui/card';
import { Progress } from '@nuclom/ui/progress';
import { Calendar, Clock, TrendingUp, Users } from 'lucide-react';

interface HeatmapHour {
  hour: number;
  count: number;
}

interface HeatmapDay {
  day: string;
  hours: HeatmapHour[];
}

interface PeakTime {
  day: string;
  hour: number;
  count: number;
}

interface Participant {
  name: string;
  videoCount: number;
  totalSpeakingTime: number;
  avgSpeakingPercent: number;
}

interface CoAppearance {
  speaker1: string;
  speaker2: string;
  count: number;
}

interface WeeklyData {
  week: string;
  count: number;
  totalDuration: number;
}

interface MeetingStats {
  avgDurationMinutes: number;
  minDurationMinutes: number;
  maxDurationMinutes: number;
  totalMeetings: number;
}

interface MeetingPatternsProps {
  timeDistribution: {
    heatmap: HeatmapDay[];
    peakTimes: PeakTime[];
  };
  speakerPatterns: {
    participants: Participant[];
    coAppearances: CoAppearance[];
    participationBalance: number;
  };
  meetingFrequency: {
    weekly: WeeklyData[];
    stats: MeetingStats;
  };
}

function formatHour(hour: number): string {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}${ampm}`;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function HeatmapCell({ count, maxCount }: { count: number; maxCount: number }) {
  const intensity = maxCount > 0 ? count / maxCount : 0;

  return (
    <div
      className="w-3 h-3 rounded-sm transition-colors"
      style={{
        backgroundColor: count === 0 ? 'var(--muted)' : `hsl(var(--primary) / ${0.2 + intensity * 0.8})`,
      }}
      title={`${count} meetings`}
    />
  );
}

export function MeetingPatterns({ timeDistribution, speakerPatterns, meetingFrequency }: MeetingPatternsProps) {
  // Find max count for heatmap normalization
  const maxCount = Math.max(...timeDistribution.heatmap.flatMap((day) => day.hours.map((h) => h.count)), 1);

  // Get max for weekly chart
  const maxWeeklyCount = Math.max(...meetingFrequency.weekly.map((w) => w.count), 1);

  return (
    <div className="space-y-6">
      {/* Meeting Time Heatmap */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Meeting Time Patterns
          </CardTitle>
          <CardDescription>When your team typically meets</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Hour labels */}
            <div className="flex gap-[2px] ml-20">
              {[0, 3, 6, 9, 12, 15, 18, 21].map((hour) => (
                <div key={hour} className="text-[10px] text-muted-foreground" style={{ width: '36px' }}>
                  {formatHour(hour)}
                </div>
              ))}
            </div>

            {/* Heatmap grid */}
            <div className="space-y-[2px]">
              {timeDistribution.heatmap.map((day) => (
                <div key={day.day} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-16 text-right">{day.day.slice(0, 3)}</span>
                  <div className="flex gap-[2px]">
                    {day.hours.map((hour) => (
                      <HeatmapCell key={hour.hour} count={hour.count} maxCount={maxCount} />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Peak times */}
            {timeDistribution.peakTimes.length > 0 && (
              <div className="pt-4 border-t">
                <p className="text-xs font-medium mb-2">Peak Meeting Times</p>
                <div className="flex flex-wrap gap-2">
                  {timeDistribution.peakTimes.slice(0, 3).map((peak, index) => (
                    <div key={index} className="text-xs px-2 py-1 bg-primary/10 rounded-md">
                      {peak.day} {formatHour(peak.hour)} ({peak.count} meetings)
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Speaker Participation */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team Participation
            </CardTitle>
            <CardDescription>Balance score: {speakerPatterns.participationBalance}%</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Progress value={speakerPatterns.participationBalance} className="h-2" />

              <div className="space-y-3 mt-4">
                {speakerPatterns.participants.slice(0, 5).map((participant) => (
                  <div key={participant.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate max-w-[120px]">{participant.name}</span>
                      <span className="text-muted-foreground">{formatTime(participant.totalSpeakingTime)}</span>
                    </div>
                    <Progress value={participant.avgSpeakingPercent} className="h-1" />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Co-appearance Network */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Frequent Collaborators
            </CardTitle>
            <CardDescription>Who meets together most often</CardDescription>
          </CardHeader>
          <CardContent>
            {speakerPatterns.coAppearances.length > 0 ? (
              <div className="space-y-3">
                {speakerPatterns.coAppearances.slice(0, 5).map((pair, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium truncate max-w-[80px]">{pair.speaker1}</span>
                      <span className="text-muted-foreground">+</span>
                      <span className="font-medium truncate max-w-[80px]">{pair.speaker2}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{pair.count} meetings</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not enough data to show collaboration patterns</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Meeting Frequency Trend */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Weekly Meeting Frequency
          </CardTitle>
          <CardDescription>
            {meetingFrequency.stats.totalMeetings} total meetings • {meetingFrequency.stats.avgDurationMinutes} min
            average
          </CardDescription>
        </CardHeader>
        <CardContent>
          {meetingFrequency.weekly.length > 0 ? (
            <div className="flex items-end justify-between h-32 gap-1">
              {meetingFrequency.weekly.slice(-12).map((week) => {
                const height = (week.count / maxWeeklyCount) * 100;
                return (
                  <div key={week.week} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex items-end justify-center h-24">
                      <div
                        className="w-full max-w-8 bg-primary rounded-t transition-all duration-300 hover:bg-primary/80"
                        style={{ height: `${Math.max(height, 4)}%` }}
                        title={`Week of ${week.week}: ${week.count} meetings, ${Math.round(week.totalDuration / 60)} min total`}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(week.week).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              No meeting frequency data available
            </div>
          )}

          {/* Stats row */}
          <div className="flex justify-between mt-4 pt-4 border-t text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Avg duration:</span>
              <span className="font-medium">{meetingFrequency.stats.avgDurationMinutes} min</span>
            </div>
            <div className="flex items-center gap-4 text-muted-foreground">
              <span>Min: {meetingFrequency.stats.minDurationMinutes} min</span>
              <span>Max: {meetingFrequency.stats.maxDurationMinutes} min</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
