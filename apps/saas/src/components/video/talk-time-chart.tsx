'use client';

/**
 * Talk Time Chart Component
 *
 * Displays a horizontal bar chart showing the talk time distribution
 * among speakers in a video.
 */

import { cn } from '@nuclom/lib/utils';
import { BarChart3, Clock } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getSpeakerColor, type Speaker } from './speaker-legend';

// =============================================================================
// Types
// =============================================================================

export interface TalkTimeChartProps {
  /** List of speakers with their stats */
  speakers: Speaker[];
  /** Video duration in seconds */
  videoDuration?: number;
  /** Balance score (0-100) */
  balanceScore?: number;
  /** Optional click handler for speaker */
  onSpeakerClick?: (speakerId: string) => void;
  /** Additional className */
  className?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getBalanceInfo(score: number): { label: string; color: string; bgColor: string; description: string } {
  if (score >= 80) {
    return {
      label: 'Excellent',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      description: 'Participation is well balanced',
    };
  }
  if (score >= 60) {
    return {
      label: 'Good',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      description: 'Most participants contributed meaningfully',
    };
  }
  if (score >= 40) {
    return {
      label: 'Fair',
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
      description: 'Some participants dominated the conversation',
    };
  }
  return {
    label: 'Poor',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    description: 'Conversation was dominated by few participants',
  };
}

// =============================================================================
// Main Component
// =============================================================================

export function TalkTimeChart({
  speakers,
  videoDuration,
  balanceScore,
  onSpeakerClick,
  className,
}: TalkTimeChartProps) {
  if (!speakers || speakers.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Talk Time Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm text-center py-8">No speaker data available.</p>
        </CardContent>
      </Card>
    );
  }

  const totalSpeakingTime = speakers.reduce((sum, s) => sum + s.totalSpeakingTime, 0);
  const balance = balanceScore !== undefined ? getBalanceInfo(balanceScore) : null;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Participation Distribution
          </CardTitle>

          {videoDuration && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatTime(videoDuration)}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-4">
        {/* Speaker bars */}
        <div className="space-y-3">
          {speakers.map((speaker, index) => {
            const color = getSpeakerColor(index);
            const percentage = speaker.speakingPercentage;

            return (
              <TooltipProvider key={speaker.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    {/* biome-ignore lint/a11y/noStaticElementInteractions: Interactive behavior is conditional based on onSpeakerClick prop */}
                    <div
                      className={cn(
                        'space-y-1.5',
                        onSpeakerClick && 'cursor-pointer hover:opacity-80 transition-opacity',
                      )}
                      onClick={() => onSpeakerClick?.(speaker.id)}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && onSpeakerClick) {
                          e.preventDefault();
                          onSpeakerClick(speaker.id);
                        }
                      }}
                      role={onSpeakerClick ? 'button' : undefined}
                      tabIndex={onSpeakerClick ? 0 : undefined}
                    >
                      {/* Speaker info row */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {speaker.linkedUser ? (
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={speaker.linkedUser.image || undefined} />
                              <AvatarFallback className="text-[8px]">
                                {speaker.linkedUser.name
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')
                                  .toUpperCase()
                                  .slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <div className={cn('h-5 w-5 rounded-full flex-shrink-0', color.bg)} />
                          )}
                          <span className="text-sm font-medium truncate">{speaker.displayName}</span>
                        </div>

                        <div className="flex items-center gap-2 text-sm flex-shrink-0">
                          <span className="font-semibold">{percentage}%</span>
                          <span className="text-muted-foreground text-xs">
                            ({formatTime(speaker.totalSpeakingTime)})
                          </span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="relative h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn('absolute inset-y-0 left-0 rounded-full transition-all', color.bg)}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <div className="space-y-1">
                      <p className="font-medium">{speaker.displayName}</p>
                      <p className="text-xs">Speaking time: {formatTime(speaker.totalSpeakingTime)}</p>
                      <p className="text-xs">Segments: {speaker.segmentCount}</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>

        {/* Balance score */}
        {balance && (
          <div className={cn('rounded-lg p-3 mt-4', balance.bgColor)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Balance Score</span>
                <span className={cn('text-sm font-bold', balance.color)}>{balanceScore}/100</span>
              </div>
              <span className={cn('text-sm font-medium', balance.color)}>{balance.label}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{balance.description}</p>
          </div>
        )}

        {/* Total speaking time */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <span>Total speaking time</span>
          <span>{formatTime(totalSpeakingTime)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
