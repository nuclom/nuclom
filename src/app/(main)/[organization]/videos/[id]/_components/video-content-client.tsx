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
  Layers,
  Lightbulb,
  ListTodo,
  Loader2,
  Play,
  Share2,
  Sparkles,
  Tag,
  ThumbsUp,
  XCircle,
} from 'lucide-react';
import Image from 'next/image';
import { useCallback, useRef, useState } from 'react';
import { CommentList } from '@/components/comments';
import { VideoDecisionsSidebar } from '@/components/knowledge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChapteredTranscript, QuoteCards, VideoActions, VideoPlayerWithProgress } from '@/components/video';
import type { ActionItem, VideoChapter } from '@/lib/db/schema';
import type { CommentWithReplies } from '@/lib/effect/services/comment-repository';
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
}

function ProcessingStatus({ status, error }: ProcessingStatusProps) {
  const statusConfig = {
    pending: { icon: Clock, color: 'text-muted-foreground', label: 'Pending', bg: 'bg-muted' },
    transcribing: { icon: Loader2, color: 'text-blue-500', label: 'Transcribing', bg: 'bg-blue-500/10' },
    analyzing: { icon: Sparkles, color: 'text-purple-500', label: 'Analyzing', bg: 'bg-purple-500/10' },
    completed: { icon: CheckCircle2, color: 'text-green-500', label: 'Completed', bg: 'bg-green-500/10' },
    failed: { icon: XCircle, color: 'text-red-500', label: 'Failed', bg: 'bg-red-500/10' },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${config.bg}`}>
      <Icon
        className={`h-4 w-4 ${config.color} ${status === 'transcribing' || status === 'analyzing' ? 'animate-spin' : ''}`}
      />
      <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
      {error && <span className="text-xs text-red-500 ml-2">({error})</span>}
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
// Transform comments to CommentWithReplies format
// =============================================================================

function transformCommentsToThreaded(comments: VideoWithDetails['comments']): CommentWithReplies[] {
  const commentMap = new Map<string, CommentWithReplies>();
  const topLevelComments: CommentWithReplies[] = [];

  for (const comment of comments) {
    commentMap.set(comment.id, { ...comment, replies: [] });
  }

  for (const comment of comments) {
    const commentObj = commentMap.get(comment.id);
    if (!commentObj) continue;
    if (comment.parentId && commentMap.has(comment.parentId)) {
      commentMap.get(comment.parentId)?.replies.push(commentObj);
    } else if (!comment.parentId) {
      topLevelComments.push(commentObj);
    }
  }

  return topLevelComments;
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
  // Playback state
  const [currentTime, setCurrentTime] = useState(0);
  const seekFnRef = useRef<((time: number) => void) | null>(null);

  // Handle time updates from video player
  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  // Register seek function from video player
  const handleRegisterSeek = useCallback((seekFn: (time: number) => void) => {
    seekFnRef.current = seekFn;
  }, []);

  // Handle seek requests from transcript
  const handleSeek = useCallback((time: number) => {
    seekFnRef.current?.(time);
  }, []);

  // Video metadata
  const canDelete = currentUser?.id === video.authorId;
  const actionItems: ActionItem[] = video.aiActionItems || [];
  const tags: string[] = video.aiTags || [];
  const threadedComments = transformCommentsToThreaded(video.comments);
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
    <div className="flex flex-col gap-6 lg:gap-8 max-w-6xl mx-auto">
      {/* Video Player - Full width */}
      <div className="w-full">
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

      {/* Video Header */}
      <header>
        <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
          <ProcessingStatus status={video.processingStatus} error={video.processingError} />
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
            <Button variant="ghost" size="sm" className="text-muted-foreground h-9">
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

      {/* Main Content Tabs */}
      <Tabs defaultValue="insights" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="insights">
            <Sparkles className="h-4 w-4 mr-2" />
            Insights
          </TabsTrigger>
          <TabsTrigger value="transcript">
            <FileText className="h-4 w-4 mr-2" />
            Transcript
          </TabsTrigger>
          <TabsTrigger value="more">
            <Layers className="h-4 w-4 mr-2" />
            More
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: AI Summary + Decisions */}
        <TabsContent value="insights" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  AI Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                {video.aiSummary ? (
                  <p className="text-muted-foreground whitespace-pre-wrap">{video.aiSummary}</p>
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

            <div className="lg:col-span-2">
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
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Transcript with Chapters */}
        <TabsContent value="transcript" className="mt-6">
          <ChapteredTranscript
            chapters={playerChapters}
            segments={video.transcriptSegments || []}
            currentTime={currentTime}
            duration={durationSeconds}
            onSeek={handleSeek}
            processingStatus={
              video.processingStatus as 'pending' | 'transcribing' | 'analyzing' | 'completed' | 'failed'
            }
          />
        </TabsContent>

        {/* Tab 3: More (Description, Tags, Comments, Quote Cards) */}
        <TabsContent value="more" className="mt-6 space-y-6">
          {video.description && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Description</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground">{video.description}</CardContent>
            </Card>
          )}

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

          <QuoteCards videoId={video.id} currentUser={currentUser} />

          <CommentList
            videoId={video.id}
            videoAuthorId={video.authorId}
            initialComments={threadedComments}
            currentUser={currentUser}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
