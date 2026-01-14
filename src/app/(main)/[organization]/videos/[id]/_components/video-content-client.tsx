'use client';

/**
 * Video Content Client Component
 *
 * Client wrapper that manages video playback state and syncs
 * the transcript highlighting with video playback time.
 */

import {
  Bookmark,
  CheckCircle2,
  Clock,
  FileText,
  Lightbulb,
  ListTodo,
  Loader2,
  Play,
  RefreshCw,
  Share2,
  Sparkles,
  Tag,
  ThumbsUp,
  XCircle,
} from 'lucide-react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { Streamdown } from 'streamdown';
import { VideoDecisionsSidebar } from '@/components/knowledge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChapteredTranscript, VideoActions, VideoPlayerWithProgress } from '@/components/video';
import { useToast } from '@/hooks/use-toast';
import type { ActionItem, VideoChapter } from '@/lib/db/schema';
import { formatTime } from '@/lib/format-utils';
import type { VideoWithDetails } from '@/lib/types';

// =============================================================================
// Types
// =============================================================================

export interface VideoContentClientProps {
  video: VideoWithDetails;
  chapters: VideoChapter[];
  organizationSlug: string;
  currentUser?: {
    id: string;
    name?: string | null;
    image?: string | null;
  };
}

// =============================================================================
// Processing Status Component
// =============================================================================

interface ProcessingStatusProps {
  status: string;
  error?: string | null;
  createdAt: Date;
  onRetry: () => void;
  isRetrying: boolean;
}

const TEN_MINUTES_MS = 10 * 60 * 1000;

function ProcessingStatus({ status, error, createdAt, onRetry, isRetrying }: ProcessingStatusProps) {
  const statusConfig = {
    pending: { icon: Clock, color: 'text-muted-foreground', label: 'Pending', bg: 'bg-muted' },
    transcribing: { icon: Loader2, color: 'text-blue-500', label: 'Transcribing', bg: 'bg-blue-500/10' },
    analyzing: { icon: Sparkles, color: 'text-purple-500', label: 'Analyzing', bg: 'bg-purple-500/10' },
    completed: { icon: CheckCircle2, color: 'text-green-500', label: 'Completed', bg: 'bg-green-500/10' },
    failed: { icon: XCircle, color: 'text-red-500', label: 'Failed', bg: 'bg-red-500/10' },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
  const Icon = config.icon;

  // Show retry button if video is not completed and was created more than 10 minutes ago
  const isStuck = status !== 'completed' && Date.now() - new Date(createdAt).getTime() > TEN_MINUTES_MS;

  return (
    <div className="flex items-center gap-2">
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${config.bg}`}>
        <Icon
          className={`h-4 w-4 ${config.color} ${status === 'transcribing' || status === 'analyzing' ? 'animate-spin' : ''}`}
        />
        <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
        {error && <span className="text-xs text-red-500 ml-2">({error})</span>}
      </div>
      {isStuck && (
        <Button variant="outline" size="sm" onClick={onRetry} disabled={isRetrying} className="h-7 text-xs">
          {isRetrying ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1.5" />}
          Retry Processing
        </Button>
      )}
    </div>
  );
}

// =============================================================================
// Action Items Component
// =============================================================================

interface ActionItemsListProps {
  items: ActionItem[];
}

function ActionItemsList({ items }: ActionItemsListProps) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">No action items found.</p>;
  }

  const priorityColors = {
    high: 'border-red-500/50 bg-red-500/5',
    medium: 'border-yellow-500/50 bg-yellow-500/5',
    low: 'border-green-500/50 bg-green-500/5',
  };

  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li
          key={index}
          className={`flex items-start gap-3 p-3 rounded-lg border ${priorityColors[item.priority || 'low']}`}
        >
          <ListTodo className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div className="flex-1">
            <p className="text-sm">{item.text}</p>
            <div className="flex items-center gap-2 mt-1">
              {item.priority && (
                <Badge variant="outline" className="text-xs capitalize">
                  {item.priority}
                </Badge>
              )}
              {item.timestamp && (
                <span className="text-xs text-muted-foreground font-mono">{formatTime(item.timestamp)}</span>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

// =============================================================================
// Helper: Parse duration string to seconds
// =============================================================================

function parseDuration(duration: string): number {
  const parts = duration.split(':').map((p) => Number.parseInt(p, 10));
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

// =============================================================================
// Main Component
// =============================================================================

export function VideoContentClient({ video, chapters, organizationSlug, currentUser }: VideoContentClientProps) {
  // Parse ?t= query parameter for initial seek time
  const searchParams = useSearchParams();
  const initialTimeFromUrl = searchParams.get('t');
  const initialSeekTime = initialTimeFromUrl ? Number.parseInt(initialTimeFromUrl, 10) : 0;

  // Playback state
  const [currentTime, setCurrentTime] = useState(initialSeekTime);
  const seekFnRef = useRef<((time: number) => void) | null>(null);
  const [isRetrying, startRetryTransition] = useTransition();
  const hasSeenInitialTime = useRef(false);

  // Seek to initial time from URL when seek function is registered
  useEffect(() => {
    if (initialSeekTime > 0 && seekFnRef.current && !hasSeenInitialTime.current) {
      // Small delay to ensure video is ready
      const timer = setTimeout(() => {
        seekFnRef.current?.(initialSeekTime);
        hasSeenInitialTime.current = true;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [initialSeekTime]);

  // Handle time updates from video player
  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  // Register seek function from video player
  const handleRegisterSeek = useCallback(
    (seekFn: (time: number) => void) => {
      seekFnRef.current = seekFn;
      // Seek to initial time from URL immediately after registration
      if (initialSeekTime > 0 && !hasSeenInitialTime.current) {
        setTimeout(() => {
          seekFn(initialSeekTime);
          hasSeenInitialTime.current = true;
        }, 100);
      }
    },
    [initialSeekTime],
  );

  // Handle seek requests from transcript
  const handleSeek = useCallback((time: number) => {
    seekFnRef.current?.(time);
  }, []);

  // Handle retry processing
  const handleRetryProcessing = useCallback(() => {
    startRetryTransition(async () => {
      try {
        const response = await fetch(`/api/videos/${video.id}/process`, {
          method: 'POST',
        });
        if (response.ok) {
          // Refresh the page to show updated status
          window.location.reload();
        }
      } catch {
        // Silently fail - user can try again
      }
    });
  }, [video.id]);

  // Toast hook for notifications
  const { toast } = useToast();

  // Handle share button click
  const handleShare = useCallback(async () => {
    const shareUrl = window.location.href;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: 'Link copied',
        description: 'Video link has been copied to clipboard',
      });
    } catch {
      toast({
        title: 'Failed to copy',
        description: 'Could not copy link to clipboard',
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Video metadata
  const canDelete = currentUser?.id === video.authorId;
  const actionItems: ActionItem[] = video.aiActionItems || [];
  const tags: string[] = video.aiTags || [];
  const durationSeconds = parseDuration(video.duration);

  // Convert chapters to component format
  const playerChapters = chapters.map((c) => ({
    id: c.id,
    title: c.title,
    startTime: c.startTime,
    endTime: c.endTime ?? undefined,
    summary: c.summary ?? undefined,
  }));

  return (
    <div className="flex flex-col gap-6 lg:gap-8 max-w-7xl mx-auto">
      {/* Video Player + Transcript Sidebar */}
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* Video Player */}
        <div className="w-full lg:w-[68%] shrink-0">
          {video.videoUrl ? (
            <VideoPlayerWithProgress
              videoId={video.id}
              url={video.videoUrl}
              title={video.title}
              organizationSlug={organizationSlug}
              thumbnailUrl={video.thumbnailUrl || undefined}
              duration={video.duration}
              chapters={playerChapters}
              onTimeUpdate={handleTimeUpdate}
              registerSeek={handleRegisterSeek}
            />
          ) : (
            <div className="aspect-video bg-card rounded-lg overflow-hidden border">
              {video.thumbnailUrl ? (
                <div className="relative w-full h-full">
                  <Image
                    src={video.thumbnailUrl}
                    alt={video.title}
                    width={1280}
                    height={720}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <div className="flex flex-col items-center gap-2 text-white">
                      <Play className="h-16 w-16" />
                      <span className="text-base">Video not available</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <span className="text-muted-foreground">No video available</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Transcript Sidebar */}
        <div className="w-full lg:w-[32%] lg:max-h-[calc(56.25vw*0.68)] lg:overflow-hidden">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-2 shrink-0">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Transcript
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0">
              <ChapteredTranscript
                chapters={playerChapters}
                segments={video.transcriptSegments || []}
                currentTime={currentTime}
                duration={durationSeconds}
                onSeek={handleSeek}
                processingStatus={
                  video.processingStatus as 'pending' | 'transcribing' | 'analyzing' | 'completed' | 'failed'
                }
                compact
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Video Header */}
      <header>
        <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
          <ProcessingStatus
            status={video.processingStatus}
            error={video.processingError}
            createdAt={video.createdAt}
            onRetry={handleRetryProcessing}
            isRetrying={isRetrying}
          />
          {tags.length > 0 && (
            <div className="flex items-center gap-1">
              <Tag className="h-3 w-3 text-muted-foreground" />
              <div className="flex gap-1 flex-wrap">
                {tags.slice(0, 3).map((tag, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {tags.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{tags.length - 3}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">{video.title}</h1>
        <div className="flex items-center justify-between gap-4 mt-3 flex-wrap">
          <div className="flex items-center gap-2 sm:gap-3 text-sm text-muted-foreground flex-wrap">
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={video.author.image || undefined} alt={video.author.name || 'Author'} />
                <AvatarFallback>{video.author.name?.[0] || 'A'}</AvatarFallback>
              </Avatar>
              <span>{video.author.name || 'Unknown Author'}</span>
            </div>
            <span className="hidden sm:inline">·</span>
            <span>{new Date(video.createdAt).toLocaleDateString()}</span>
            <span className="hidden sm:inline">·</span>
            <span>{video.duration}</span>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-9">
              <ThumbsUp className="h-4 w-4 mr-2" /> Like
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground h-9 w-9">
              <Bookmark className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground h-9" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-2" /> Share
            </Button>
            <VideoActions
              videoId={video.id}
              videoTitle={video.title}
              organizationSlug={organizationSlug}
              canDelete={canDelete}
            />
          </div>
        </div>
      </header>

      {/* Stacked Content Sections */}
      <div className="space-y-6">
        {/* AI Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            {video.aiSummary ? (
              <div className="ai-summary-content">
                <Streamdown>{video.aiSummary}</Streamdown>
              </div>
            ) : video.processingStatus === 'analyzing' ? (
              <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating summary...</span>
              </div>
            ) : (
              <p className="text-muted-foreground">No AI summary available.</p>
            )}
          </CardContent>
        </Card>

        {/* Action Items */}
        {actionItems.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <ListTodo className="h-5 w-5" />
                Action Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ActionItemsList items={actionItems} />
            </CardContent>
          </Card>
        )}

        {/* Decisions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Decisions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <VideoDecisionsSidebar videoId={video.id} />
          </CardContent>
        </Card>

        {/* Description */}
        {video.description && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Description</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">{video.description}</CardContent>
          </Card>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Tags
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, i) => (
                  <Badge key={i} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
