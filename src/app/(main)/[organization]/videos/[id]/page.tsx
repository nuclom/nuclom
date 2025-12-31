import { asc, eq } from "drizzle-orm";
import {
  Bookmark,
  CheckCircle2,
  ChevronRight,
  Clock,
  Code,
  FileText,
  Layers,
  ListTodo,
  Loader2,
  MessageSquarePlus,
  Play,
  Share2,
  Sparkles,
  Tag,
  ThumbsUp,
  XCircle,
} from "lucide-react";
import { headers } from "next/headers";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CommentList } from "@/components/comments";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VideoActions, VideoPlayerWithProgress } from "@/components/video";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ActionItem, VideoChapter, VideoCodeSnippet } from "@/lib/db/schema";
import { videoChapters, videoCodeSnippets } from "@/lib/db/schema";
import { getCachedVideo } from "@/lib/effect";
import type { CommentWithReplies } from "@/lib/effect/services/comment-repository";
import type { VideoWithDetails } from "@/lib/types";

// =============================================================================
// Helper Functions
// =============================================================================

function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

// =============================================================================
// Loading Skeletons
// =============================================================================

function VideoDetailSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-8">
      <div className="lg:col-span-2 xl:col-span-3 flex flex-col gap-6">
        <div className="h-10 bg-muted animate-pulse rounded w-3/4" />
        <div className="h-6 bg-muted animate-pulse rounded w-1/4" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
        <div className="h-48 bg-muted animate-pulse rounded-lg" />
      </div>
      <aside className="w-full lg:col-span-1 space-y-6">
        <div className="aspect-video bg-muted animate-pulse rounded-lg" />
        <div className="h-8 bg-muted animate-pulse rounded" />
        <div className="h-48 bg-muted animate-pulse rounded-lg" />
      </aside>
    </div>
  );
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
    pending: { icon: Clock, color: "text-muted-foreground", label: "Pending", bg: "bg-muted" },
    transcribing: { icon: Loader2, color: "text-blue-500", label: "Transcribing", bg: "bg-blue-500/10" },
    analyzing: { icon: Sparkles, color: "text-purple-500", label: "Analyzing", bg: "bg-purple-500/10" },
    completed: { icon: CheckCircle2, color: "text-green-500", label: "Completed", bg: "bg-green-500/10" },
    failed: { icon: XCircle, color: "text-red-500", label: "Failed", bg: "bg-red-500/10" },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${config.bg}`}>
      <Icon
        className={`h-4 w-4 ${config.color} ${status === "transcribing" || status === "analyzing" ? "animate-spin" : ""}`}
      />
      <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
      {error && <span className="text-xs text-red-500 ml-2">({error})</span>}
    </div>
  );
}

// =============================================================================
// Transcript Component
// =============================================================================

interface TranscriptLineProps {
  time: string;
  text: string;
  hasComment?: boolean;
}

function TranscriptLine({ time, text, hasComment }: TranscriptLineProps) {
  return (
    <div className="group relative flex gap-4 p-2 rounded-md hover:bg-secondary">
      <div className="absolute left-[-40px] top-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <button type="button" className="p-1 rounded-full hover:bg-muted-foreground/20">
          <MessageSquarePlus className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
      <p className="font-mono text-xs text-muted-foreground w-16 shrink-0 pt-1">{time}</p>
      <p className="flex-1 text-sm">{text}</p>
      {hasComment && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-[hsl(var(--brand-accent))]" />
      )}
    </div>
  );
}

// =============================================================================
// Transform comments to CommentWithReplies format
// =============================================================================

function transformCommentsToThreaded(comments: VideoWithDetails["comments"]): CommentWithReplies[] {
  const commentMap = new Map<string, CommentWithReplies>();
  const topLevelComments: CommentWithReplies[] = [];

  // First pass: create all comment objects with empty replies
  for (const comment of comments) {
    commentMap.set(comment.id, {
      ...comment,
      replies: [],
    });
  }

  // Second pass: build the tree structure
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
// Chapters Component
// =============================================================================

interface ChaptersListProps {
  chapters: VideoChapter[];
}

function ChaptersList({ chapters }: ChaptersListProps) {
  if (chapters.length === 0) {
    return <p className="text-muted-foreground text-sm">No chapters available.</p>;
  }

  return (
    <div className="space-y-2">
      {chapters.map((chapter, index) => (
        <div
          key={chapter.id}
          className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-medium">
            {index + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-sm truncate">{chapter.title}</h4>
              <span className="text-xs text-muted-foreground font-mono">{formatTime(chapter.startTime)}</span>
            </div>
            {chapter.summary && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{chapter.summary}</p>}
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Code Snippets Component
// =============================================================================

interface CodeSnippetsListProps {
  snippets: VideoCodeSnippet[];
}

function CodeSnippetsList({ snippets }: CodeSnippetsListProps) {
  if (snippets.length === 0) {
    return <p className="text-muted-foreground text-sm">No code snippets detected.</p>;
  }

  return (
    <div className="space-y-4">
      {snippets.map((snippet) => (
        <div key={snippet.id} className="rounded-lg border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
            <div className="flex items-center gap-2">
              <Code className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{snippet.title || "Code Snippet"}</span>
              {snippet.language && (
                <Badge variant="secondary" className="text-xs">
                  {snippet.language}
                </Badge>
              )}
            </div>
            {snippet.timestamp && (
              <span className="text-xs text-muted-foreground font-mono">{formatTime(snippet.timestamp)}</span>
            )}
          </div>
          <pre className="p-4 text-sm overflow-x-auto bg-background">
            <code>{snippet.code}</code>
          </pre>
          {snippet.description && (
            <div className="px-4 py-2 text-xs text-muted-foreground border-t">{snippet.description}</div>
          )}
        </div>
      ))}
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
    high: "border-red-500/50 bg-red-500/5",
    medium: "border-yellow-500/50 bg-yellow-500/5",
    low: "border-green-500/50 bg-green-500/5",
  };

  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li
          key={index}
          className={`flex items-start gap-3 p-3 rounded-lg border ${priorityColors[item.priority || "low"]}`}
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
// Video Detail Component (Server Component)
// =============================================================================

interface VideoDetailProps {
  video: VideoWithDetails;
  chapters: VideoChapter[];
  codeSnippets: VideoCodeSnippet[];
  organizationSlug: string;
  currentUser?: {
    id: string;
    name?: string | null;
    image?: string | null;
  };
}

function VideoDetail({ video, chapters, codeSnippets, organizationSlug, currentUser }: VideoDetailProps) {
  // Check if current user can delete the video (is author or video owner)
  const canDelete = currentUser?.id === video.authorId;

  // Use transcript segments if available, otherwise fall back to simple line parsing
  const transcriptLines =
    video.transcriptSegments && video.transcriptSegments.length > 0
      ? video.transcriptSegments.map((seg) => ({
          time: formatTime(seg.startTime),
          text: seg.text,
        }))
      : video.transcript
        ? video.transcript
            .split("\n")
            .filter(Boolean)
            .map((line, index) => ({
              time: formatTime(index * 15),
              text: line,
            }))
        : [];

  // Use structured action items if available
  const actionItems: ActionItem[] = video.aiActionItems || [];

  // Use AI tags
  const tags: string[] = video.aiTags || [];

  // Transform flat comments to threaded structure
  const threadedComments = transformCommentsToThreaded(video.comments);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-8">
      {/* Main Content: Transcript and Comments */}
      <div className="lg:col-span-2 xl:col-span-3 flex flex-col gap-6">
        <header>
          <div className="flex items-center gap-3 mb-2">
            <ProcessingStatus status={video.processingStatus} error={video.processingError} />
            {tags.length > 0 && (
              <div className="flex items-center gap-1">
                <Tag className="h-3 w-3 text-muted-foreground" />
                <div className="flex gap-1">
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
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{video.title}</h1>
          <div className="flex items-center gap-3 mt-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={video.author.image || undefined} alt={video.author.name || "Author"} />
                <AvatarFallback>{video.author.name?.[0] || "A"}</AvatarFallback>
              </Avatar>
              <span>{video.author.name || "Unknown Author"}</span>
            </div>
            <span>-</span>
            <span>{new Date(video.createdAt).toLocaleDateString()}</span>
            <span>-</span>
            <span>{video.duration}</span>
          </div>
        </header>

        {/* Chapters Section */}
        {chapters.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Chapters ({chapters.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChaptersList chapters={chapters} />
            </CardContent>
          </Card>
        )}

        {/* Transcript Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Transcript
            </CardTitle>
          </CardHeader>
          <CardContent>
            {transcriptLines.length > 0 ? (
              <div className="space-y-1 font-mono max-h-96 overflow-y-auto">
                {transcriptLines.map((line, index) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: Transcript lines are ordered and don't change
                  <TranscriptLine key={index} time={line.time} text={line.text} />
                ))}
              </div>
            ) : video.processingStatus === "pending" || video.processingStatus === "transcribing" ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Transcript is being generated...</span>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No transcript available.</p>
            )}
          </CardContent>
        </Card>

        {/* Code Snippets Section */}
        {codeSnippets.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Code className="h-4 w-4" />
                Code Snippets ({codeSnippets.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CodeSnippetsList snippets={codeSnippets} />
            </CardContent>
          </Card>
        )}

        {/* Comments Section with Real-time Updates */}
        <CommentList
          videoId={video.id}
          videoAuthorId={video.authorId}
          initialComments={threadedComments}
          currentUser={currentUser}
        />
      </div>

      {/* Sidebar: Video Player and AI Insights */}
      <aside className="w-full lg:col-span-1 xl:col-span-1 space-y-6 lg:sticky top-20 self-start">
        {/* Video Player */}
        {video.videoUrl ? (
          <VideoPlayerWithProgress
            videoId={video.id}
            url={video.videoUrl}
            title={video.title}
            thumbnailUrl={video.thumbnailUrl || undefined}
            duration={video.duration}
            chapters={chapters.map((c) => ({
              id: c.id,
              title: c.title,
              startTime: c.startTime,
              endTime: c.endTime ?? undefined,
              summary: c.summary ?? undefined,
            }))}
          />
        ) : (
          <div className="aspect-video bg-card rounded-lg overflow-hidden border">
            {video.thumbnailUrl ? (
              <div className="relative w-full h-full">
                <Image
                  src={video.thumbnailUrl}
                  alt={video.title}
                  width={640}
                  height={360}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <div className="flex flex-col items-center gap-2 text-white">
                    <Play className="h-12 w-12" />
                    <span className="text-sm">Video not available</span>
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

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm">
              <ThumbsUp className="h-4 w-4 mr-2" /> Like
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground">
              <Bookmark className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
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

        <Tabs defaultValue="insights">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="insights">
              <Sparkles className="h-4 w-4 mr-2" />
              AI Insights
            </TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>
          <TabsContent value="insights" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">AI Summary</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                {video.aiSummary ? (
                  <p className="text-muted-foreground whitespace-pre-wrap">{video.aiSummary}</p>
                ) : video.processingStatus === "analyzing" ? (
                  <div className="flex items-center gap-2 text-muted-foreground py-4 justify-center">
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
                <CardTitle className="text-base flex items-center gap-2">
                  <ListTodo className="h-4 w-4" />
                  Action Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ActionItemsList items={actionItems} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="details">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Description</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {video.description || "No description available."}
              </CardContent>
            </Card>

            {tags.length > 0 && (
              <Card className="mt-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Tag className="h-4 w-4" />
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
          </TabsContent>
        </Tabs>
      </aside>
    </div>
  );
}

// =============================================================================
// Async Video Loader Component
// =============================================================================

interface VideoLoaderProps {
  videoId: string;
  organizationSlug: string;
  currentUser?: {
    id: string;
    name?: string | null;
    image?: string | null;
  };
}

async function VideoLoader({ videoId, organizationSlug, currentUser }: VideoLoaderProps) {
  // Fetch video details and related data in parallel
  const [video, chapters, codeSnippets] = await Promise.all([
    getCachedVideo(videoId),
    db.select().from(videoChapters).where(eq(videoChapters.videoId, videoId)).orderBy(asc(videoChapters.startTime)),
    db
      .select()
      .from(videoCodeSnippets)
      .where(eq(videoCodeSnippets.videoId, videoId))
      .orderBy(asc(videoCodeSnippets.timestamp)),
  ]);

  // If video is deleted (soft delete), show 404
  if (!video) {
    notFound();
  }

  return (
    <VideoDetail
      video={video}
      chapters={chapters}
      codeSnippets={codeSnippets}
      organizationSlug={organizationSlug}
      currentUser={currentUser}
    />
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default async function VideoPage({ params }: { params: Promise<{ organization: string; id: string }> }) {
  const { organization, id } = await params;

  // Get current user session (optional - allows anonymous viewing)
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const currentUser = session?.user
    ? {
        id: session.user.id,
        name: session.user.name,
        image: session.user.image,
      }
    : undefined;

  return (
    <Suspense fallback={<VideoDetailSkeleton />}>
      <VideoLoader videoId={id} organizationSlug={organization} currentUser={currentUser} />
    </Suspense>
  );
}
