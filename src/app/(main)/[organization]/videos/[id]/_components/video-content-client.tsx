'use client';

/**
 * Video Content Client Component
 *
 * Layout with video on the right and content on the left.
 * Syncs transcript highlighting with video playback time.
 */

import { CheckCircle2, Clock, Loader2, Play, RefreshCw, Share2, Sparkles, XCircle } from 'lucide-react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { Streamdown } from 'streamdown';
import { VideoDecisionsSidebar } from '@/components/knowledge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChapteredTranscript, VideoActions, VideoPlayerWithProgress } from '@/components/video';
import { useToast } from '@/hooks/use-toast';
import type { ActionItem, VideoChapter } from '@/lib/db/schema';
import { formatTime } from '@/lib/format-utils';
import type { VideoWithDetails } from '@/lib/types';
import { refreshVideoUrl } from '../_actions/refresh-video-url';

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
// Processing Status Badge
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
  if (status === 'completed') return null;

  const statusConfig = {
    pending: { icon: Clock, color: 'text-muted-foreground', label: 'Pending', bg: 'bg-muted' },
    transcribing: { icon: Loader2, color: 'text-blue-500', label: 'Transcribing', bg: 'bg-blue-500/10' },
    analyzing: { icon: Sparkles, color: 'text-purple-500', label: 'Analyzing', bg: 'bg-purple-500/10' },
    failed: { icon: XCircle, color: 'text-red-500', label: 'Failed', bg: 'bg-red-500/10' },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
  const Icon = config.icon;
  const isStuck = status !== 'completed' && Date.now() - new Date(createdAt).getTime() > TEN_MINUTES_MS;

  return (
    <div className="flex items-center gap-2">
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${config.bg}`}>
        <Icon
          className={`h-3.5 w-3.5 ${config.color} ${status === 'transcribing' || status === 'analyzing' ? 'animate-spin' : ''}`}
        />
        <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
        {error && <span className="text-xs text-red-500">({error})</span>}
      </div>
      {isStuck && (
        <Button variant="outline" size="sm" onClick={onRetry} disabled={isRetrying} className="h-6 text-xs px-2">
          {isRetrying ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
          Retry
        </Button>
      )}
    </div>
  );
}

// =============================================================================
// Processing Empty State
// =============================================================================

interface ProcessingEmptyStateProps {
  status: 'pending' | 'transcribing' | 'diarizing' | 'analyzing' | 'failed';
}

function ProcessingEmptyState({ status }: ProcessingEmptyStateProps) {
  const statusContent = {
    pending: {
      icon: Clock,
      title: 'Waiting to process',
      description:
        "Your video is queued and will be processed shortly. We'll generate a summary, action items, and transcript.",
      iconColor: 'text-muted-foreground/50',
      animate: false,
    },
    transcribing: {
      icon: Loader2,
      title: 'Transcribing video',
      description:
        "Converting speech to text. Once complete, we'll analyze the content to generate a summary and extract key insights.",
      iconColor: 'text-blue-500',
      animate: true,
    },
    diarizing: {
      icon: Loader2,
      title: 'Identifying speakers',
      description:
        'Detecting who said what in your video. This helps create a more useful transcript and accurate summaries.',
      iconColor: 'text-blue-500',
      animate: true,
    },
    analyzing: {
      icon: Sparkles,
      title: 'Analyzing content',
      description: 'Generating your summary, extracting action items, and identifying key topics from the transcript.',
      iconColor: 'text-purple-500',
      animate: true,
    },
    failed: {
      icon: XCircle,
      title: 'Processing failed',
      description:
        'Something went wrong while processing your video. Please try uploading again or contact support if the issue persists.',
      iconColor: 'text-red-500',
      animate: false,
    },
  };

  const content = statusContent[status];
  const Icon = content.icon;

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="relative mb-4">
        <Icon className={`h-12 w-12 ${content.iconColor} ${content.animate ? 'animate-spin' : ''}`} />
        {content.animate && (
          <div
            className="absolute inset-0 h-12 w-12 rounded-full border-2 border-current opacity-20 animate-ping"
            style={{ animationDuration: '2s' }}
          />
        )}
      </div>
      <h3 className="text-sm font-medium mb-2">{content.title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">{content.description}</p>
    </div>
  );
}

// =============================================================================
// Action Items List
// =============================================================================

interface DatabaseActionItem {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'high' | 'medium' | 'low';
  timestampStart: number | null;
}

interface ActionItemsListProps {
  videoId: string;
  organizationId: string;
  onSeek?: (time: number) => void;
}

function ActionItemsList({ videoId, organizationId, onSeek }: ActionItemsListProps) {
  const [actionItems, setActionItems] = useState<DatabaseActionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Fetch action items from database
  useEffect(() => {
    async function fetchActionItems() {
      try {
        const response = await fetch(
          `/api/insights/action-items?organizationId=${organizationId}&videoId=${videoId}&limit=50`,
        );
        if (response.ok) {
          const data = await response.json();
          setActionItems(data.data?.actionItems || []);
        }
      } catch (error) {
        console.error('Failed to fetch action items:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchActionItems();
  }, [videoId, organizationId]);

  const toggleItem = useCallback(async (item: DatabaseActionItem) => {
    const newStatus = item.status === 'completed' ? 'pending' : 'completed';
    setUpdatingId(item.id);

    try {
      const response = await fetch(`/api/insights/action-items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setActionItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: newStatus } : i)));
      }
    } catch (error) {
      console.error('Failed to update action item:', error);
    } finally {
      setUpdatingId(null);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (actionItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CheckCircle2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-sm font-medium mb-1">No action items</h3>
        <p className="text-sm text-muted-foreground">Action items will appear here once extracted</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {actionItems.map((item) => {
        const isCompleted = item.status === 'completed';
        const isUpdating = updatingId === item.id;
        return (
          <li key={item.id} className="flex items-start gap-3 group">
            <button
              type="button"
              onClick={() => toggleItem(item)}
              disabled={isUpdating}
              className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                isCompleted ? 'bg-primary border-primary' : 'border-muted-foreground/30 hover:border-primary/50'
              } ${isUpdating ? 'opacity-50' : ''}`}
            >
              {isUpdating ? (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              ) : (
                <CheckCircle2
                  className={`h-3 w-3 transition-opacity ${
                    isCompleted
                      ? 'text-primary-foreground opacity-100'
                      : 'text-muted-foreground/50 opacity-0 group-hover:opacity-100'
                  }`}
                />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${isCompleted ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                {item.title}
              </p>
              {item.timestampStart !== null && onSeek && (
                <button
                  type="button"
                  onClick={() => onSeek(item.timestampStart as number)}
                  className="text-xs text-muted-foreground hover:text-foreground font-mono transition-colors mt-1"
                >
                  {formatTime(item.timestampStart)}
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// =============================================================================
// Jump To Section (Key Moments / Chapters)
// =============================================================================

interface JumpToSectionProps {
  chapters: Array<{ id: string; title: string; startTime: number; summary?: string }>;
  onSeek: (time: number) => void;
  currentTime: number;
}

function JumpToSection({ chapters, onSeek, currentTime }: JumpToSectionProps) {
  if (chapters.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">Jump to...</h3>
      <ul className="space-y-1">
        {chapters.map((chapter) => {
          const isActive = currentTime >= chapter.startTime;
          return (
            <li key={chapter.id}>
              <button
                type="button"
                onClick={() => onSeek(chapter.startTime)}
                className={`w-full text-left p-2 rounded-md text-sm hover:bg-muted transition-colors flex items-start gap-3 ${
                  isActive ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                <span className="font-mono text-xs shrink-0 mt-0.5">{formatTime(chapter.startTime)}</span>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="font-medium">{chapter.title}</span>
                  {chapter.summary && (
                    <span className="text-xs text-muted-foreground line-clamp-2">{chapter.summary}</span>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
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
// Helper: Generate tag color from content hash
// =============================================================================

const TAG_COLORS = [
  'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
  'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800',
  'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
  'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800',
  'bg-lime-100 text-lime-700 border-lime-200 dark:bg-lime-950 dark:text-lime-300 dark:border-lime-800',
  'bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800',
  'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
  'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800',
  'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800',
  'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800',
  'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
  'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800',
  'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800',
  'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800',
  'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-950 dark:text-fuchsia-300 dark:border-fuchsia-800',
  'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-950 dark:text-pink-300 dark:border-pink-800',
  'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800',
];

function getTagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = ((hash << 5) - hash + tag.charCodeAt(i)) | 0;
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

// =============================================================================
// Main Component
// =============================================================================

export function VideoContentClient({ video, chapters, organizationSlug, currentUser }: VideoContentClientProps) {
  const searchParams = useSearchParams();
  const initialTimeFromUrl = searchParams.get('t');
  const initialSeekTime = initialTimeFromUrl ? Number.parseInt(initialTimeFromUrl, 10) : 0;

  // Playback state
  const [currentTime, setCurrentTime] = useState(initialSeekTime);
  const seekFnRef = useRef<((time: number) => void) | null>(null);
  const playFnRef = useRef<(() => void) | null>(null);
  const [isRetrying, startRetryTransition] = useTransition();
  const hasSeenInitialTime = useRef(false);

  // Transcript auto-scroll state
  const [transcriptUserHasScrolled, setTranscriptUserHasScrolled] = useState(false);

  // Seek to initial time from URL
  useEffect(() => {
    if (initialSeekTime > 0 && seekFnRef.current && !hasSeenInitialTime.current) {
      const timer = setTimeout(() => {
        seekFnRef.current?.(initialSeekTime);
        hasSeenInitialTime.current = true;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [initialSeekTime]);

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleRegisterSeek = useCallback(
    (seekFn: (time: number) => void) => {
      seekFnRef.current = seekFn;
      if (initialSeekTime > 0 && !hasSeenInitialTime.current) {
        setTimeout(() => {
          seekFn(initialSeekTime);
          hasSeenInitialTime.current = true;
        }, 100);
      }
    },
    [initialSeekTime],
  );

  const handleSeek = useCallback((time: number) => {
    seekFnRef.current?.(time);
  }, []);

  const handleRegisterPlay = useCallback((playFn: () => void) => {
    playFnRef.current = playFn;
  }, []);

  const handleSeekAndPlay = useCallback((time: number) => {
    seekFnRef.current?.(time);
    // Small delay to ensure seek completes before playing
    setTimeout(() => {
      playFnRef.current?.();
    }, 50);
  }, []);

  const handleRefreshUrl = useCallback(async () => {
    const result = await refreshVideoUrl(video.id);
    return result.videoUrl;
  }, [video.id]);

  const handleRetryProcessing = useCallback(() => {
    startRetryTransition(async () => {
      try {
        const response = await fetch(`/api/videos/${video.id}/process`, { method: 'POST' });
        if (response.ok) window.location.reload();
      } catch {
        // Silently fail
      }
    });
  }, [video.id]);

  const { toast } = useToast();

  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: 'Link copied', description: 'Video link has been copied to clipboard' });
    } catch {
      toast({ title: 'Failed to copy', description: 'Could not copy link to clipboard', variant: 'destructive' });
    }
  }, [toast]);

  // Video metadata
  const canDelete = currentUser?.id === video.authorId;
  const actionItems: ActionItem[] = video.aiActionItems || [];
  const tags: string[] = video.aiTags || [];
  const durationSeconds = parseDuration(video.duration);

  // Decisions count for conditional rendering
  const [decisionsCount, setDecisionsCount] = useState<number | null>(null);
  const handleDecisionsLoad = useCallback((count: number) => {
    setDecisionsCount(count);
  }, []);

  // Convert chapters to component format
  const playerChapters = chapters.map((c) => ({
    id: c.id,
    title: c.title,
    startTime: c.startTime,
    endTime: c.endTime ?? undefined,
    summary: c.summary ?? undefined,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_500px] 2xl:grid-cols-[1fr_600px] gap-6 lg:h-[calc(100vh-6rem)]">
      {/* Left column - Header sticky, tabs scroll */}
      <div className="lg:col-start-1 lg:row-start-1 flex flex-col lg:min-h-0">
        {/* Header - Sticky on desktop */}
        <header className="lg:sticky lg:top-0 lg:bg-background lg:z-10 lg:pb-4">
          <div className="flex items-center gap-2 mb-2">
            <ProcessingStatus
              status={video.processingStatus}
              error={video.processingError}
              createdAt={video.createdAt}
              onRetry={handleRetryProcessing}
              isRetrying={isRetrying}
            />
          </div>
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{video.title}</h1>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="outline" size="sm" onClick={handleShare} className="gap-1.5">
                <Share2 className="h-4 w-4" />
                Share
              </Button>
              <VideoActions
                videoId={video.id}
                videoTitle={video.title}
                organizationSlug={organizationSlug}
                canDelete={canDelete}
              />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={video.author.image || undefined} alt={video.author.name || 'Author'} />
                <AvatarFallback className="text-xs">{video.author.name?.[0] || 'A'}</AvatarFallback>
              </Avatar>
              <span>{video.author.name || 'Unknown'}</span>
            </div>
            <span>·</span>
            <span>{new Date(video.createdAt).toLocaleDateString()}</span>
            <span>·</span>
            <span>{video.duration}</span>
          </div>
          {tags.length > 0 && (
            <div className="flex items-center gap-1.5 mt-3">
              {tags.slice(0, 4).map((tag, i) => (
                <Badge key={i} variant="outline" className={`text-xs font-normal ${getTagColor(tag)}`}>
                  {tag}
                </Badge>
              ))}
              {tags.length > 4 && (
                <Badge variant="secondary" className="text-xs font-normal">
                  +{tags.length - 4}
                </Badge>
              )}
            </div>
          )}
        </header>

        {/* Tabs */}
        <Tabs defaultValue="summary" className="w-full flex-1 flex flex-col lg:min-h-0">
          <TabsList className="w-full justify-start h-auto p-0 bg-background border-b rounded-none gap-0 lg:sticky lg:top-0 lg:z-10 shrink-0">
            <TabsTrigger
              value="summary"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm"
            >
              Summary
            </TabsTrigger>
            <TabsTrigger
              value="action-items"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm flex items-center gap-1.5"
            >
              Action Items
              {actionItems.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {actionItems.length}
                </Badge>
              )}
            </TabsTrigger>
            {decisionsCount !== null && decisionsCount > 0 && (
              <TabsTrigger
                value="decisions"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm flex items-center gap-1.5"
              >
                Decisions
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {decisionsCount}
                </Badge>
              </TabsTrigger>
            )}
            <TabsTrigger
              value="transcript"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm"
            >
              Transcript
            </TabsTrigger>
          </TabsList>

          {/* Scrollable tab content wrapper */}
          <div className="relative flex-1 lg:min-h-0">
            <div className="h-full lg:overflow-y-auto lg:pr-6 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
              {/* Summary Tab */}
              <TabsContent value="summary" className="mt-6 space-y-6">
                {/* Recap / AI Summary */}
                <section>
                  {video.aiSummary ? (
                    <div className="text-sm text-foreground leading-relaxed">
                      <Streamdown>{video.aiSummary}</Streamdown>
                    </div>
                  ) : video.processingStatus !== 'completed' ? (
                    <ProcessingEmptyState
                      status={
                        video.processingStatus as 'pending' | 'transcribing' | 'diarizing' | 'analyzing' | 'failed'
                      }
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">No summary available.</p>
                  )}
                </section>

                {/* Description */}
                {video.description && (
                  <section>
                    <h2 className="text-sm font-semibold mb-3">Description</h2>
                    <p className="text-sm text-muted-foreground">{video.description}</p>
                  </section>
                )}
              </TabsContent>

              {/* Action Items Tab */}
              <TabsContent value="action-items" className="mt-6">
                <ActionItemsList videoId={video.id} organizationId={video.organization.id} onSeek={handleSeek} />
              </TabsContent>

              {/* Decisions Tab */}
              {decisionsCount !== null && decisionsCount > 0 && (
                <TabsContent value="decisions" className="mt-6">
                  <VideoDecisionsSidebar
                    videoId={video.id}
                    onLoad={handleDecisionsLoad}
                    onSeek={handleSeek}
                    hideWhenEmpty
                    className="border-none p-0"
                  />
                </TabsContent>
              )}

              {/* Transcript Tab */}
              <TabsContent value="transcript" className="mt-6">
                <ChapteredTranscript
                  chapters={playerChapters}
                  segments={video.transcriptSegments || []}
                  currentTime={currentTime}
                  duration={durationSeconds}
                  onSeek={handleSeekAndPlay}
                  processingStatus={
                    video.processingStatus as 'pending' | 'transcribing' | 'analyzing' | 'completed' | 'failed'
                  }
                  userHasScrolled={transcriptUserHasScrolled}
                  onUserScrollChange={setTranscriptUserHasScrolled}
                />
              </TabsContent>
            </div>

            {/* Floating resume auto-scroll button */}
            {transcriptUserHasScrolled && (
              <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none z-10">
                <Button
                  variant="secondary"
                  size="sm"
                  className="text-xs h-8 shadow-lg pointer-events-auto"
                  onClick={() => setTranscriptUserHasScrolled(false)}
                >
                  Resume auto-scroll
                </Button>
              </div>
            )}
          </div>
        </Tabs>
      </div>

      {/* Video Player - Right column on desktop */}
      <div className="lg:col-start-2 lg:row-start-1">
        <div className="lg:sticky lg:top-4 space-y-4">
          {/* Video Player */}
          <div className="relative rounded-xl overflow-hidden bg-black">
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
                registerPlay={handleRegisterPlay}
                onRefreshUrl={handleRefreshUrl}
              />
            ) : (
              <div className="aspect-video bg-card flex items-center justify-center">
                {video.thumbnailUrl ? (
                  <div className="relative w-full h-full">
                    <Image
                      src={video.thumbnailUrl}
                      alt={video.title}
                      width={480}
                      height={270}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <Play className="h-12 w-12 text-white" />
                    </div>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">No video available</span>
                )}
              </div>
            )}
          </div>

          {/* Jump to... Section */}
          {playerChapters.length > 0 && (
            <JumpToSection chapters={playerChapters} onSeek={handleSeekAndPlay} currentTime={currentTime} />
          )}
        </div>
      </div>
    </div>
  );
}
