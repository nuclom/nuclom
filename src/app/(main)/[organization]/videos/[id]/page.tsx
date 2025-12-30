import { Bookmark, Code, ListTodo, MessageSquarePlus, Share2, Sparkles, ThumbsUp } from "lucide-react";
import Image from "next/image";
import { Suspense } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCachedVideo } from "@/lib/effect";
import type { VideoWithDetails } from "@/lib/types";

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
// Video Detail Component (Server Component)
// =============================================================================

interface VideoDetailProps {
  video: VideoWithDetails;
}

function VideoDetail({ video }: VideoDetailProps) {
  // Parse transcript if available
  const transcriptLines = video.transcript
    ? video.transcript
        .split("\n")
        .filter(Boolean)
        .map((line, index) => ({
          time: `00:${String(index * 15).padStart(2, "0")}.00`,
          text: line,
        }))
    : [];

  // Parse AI summary for action items
  const actionItems = video.aiSummary
    ? video.aiSummary
        .split("\n")
        .filter((line) => line.startsWith("-") || line.startsWith("•"))
        .map((line) => line.replace(/^[-•]\s*/, ""))
    : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-8">
      {/* Main Content: Transcript and Comments */}
      <div className="lg:col-span-2 xl:col-span-3 flex flex-col gap-6">
        <header>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{video.title}</h1>
          <div className="flex items-center gap-3 mt-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={video.author.image || undefined} alt={video.author.name || "Author"} />
                <AvatarFallback>{video.author.name?.[0] || "A"}</AvatarFallback>
              </Avatar>
              <span>{video.author.name || "Unknown Author"}</span>
            </div>
            <span>•</span>
            <span>{new Date(video.createdAt).toLocaleDateString()}</span>
            <span>•</span>
            <span>{video.duration}</span>
          </div>
        </header>

        <Card>
          <CardContent className="p-4 md:p-6">
            <h2 className="text-lg font-semibold mb-4">Transcript</h2>
            {transcriptLines.length > 0 ? (
              <div className="space-y-1 font-mono">
                {transcriptLines.map((line, index) => (
                  <TranscriptLine key={index} time={line.time} text={line.text} />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No transcript available.</p>
            )}
          </CardContent>
        </Card>

        {/* Comments Section */}
        {video.comments && video.comments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Comments ({video.comments.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {video.comments.map((comment) => (
                <div key={comment.id} className="flex items-start gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={comment.author.image || undefined} />
                    <AvatarFallback>{comment.author.name?.[0] || "U"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm">{comment.author.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(comment.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <p className="text-sm mt-1">{comment.content}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sidebar: Video Player and AI Insights */}
      <aside className="w-full lg:col-span-1 xl:col-span-1 space-y-6 lg:sticky top-20 self-start">
        <div className="aspect-video bg-card rounded-lg overflow-hidden border">
          {video.thumbnailUrl ? (
            <Image
              src={video.thumbnailUrl}
              alt={video.title}
              width={640}
              height={360}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <span className="text-muted-foreground">No thumbnail</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm">
              <ThumbsUp className="h-4 w-4 mr-2" /> Like
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground">
              <Bookmark className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <Share2 className="h-4 w-4 mr-2" /> Share
          </Button>
        </div>

        <Tabs defaultValue="insights">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="insights">
              <Sparkles className="h-4 w-4 mr-2" />
              AI Insights
            </TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>
          <TabsContent value="insights">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">AI Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {video.aiSummary ? (
                  <>
                    <div className="space-y-2">
                      <h4 className="font-semibold flex items-center">
                        <ListTodo className="h-4 w-4 mr-2 text-[hsl(var(--brand-accent))]" />
                        Summary
                      </h4>
                      <p className="text-muted-foreground">{video.aiSummary}</p>
                    </div>
                    {actionItems.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-semibold flex items-center">
                          <Code className="h-4 w-4 mr-2 text-[hsl(var(--brand-accent))]" />
                          Action Items
                        </h4>
                        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                          {actionItems.map((item, index) => (
                            <li key={index}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground">No AI summary available.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="details">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Description</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {video.description || "No description available."}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </aside>
    </div>
  );
}

// =============================================================================
// Async Video Loader Component
// =============================================================================

async function VideoLoader({ videoId }: { videoId: string }) {
  const video = await getCachedVideo(videoId);
  return <VideoDetail video={video} />;
}

// =============================================================================
// Main Page Component
// =============================================================================

export default async function VideoPage({ params }: { params: Promise<{ organization: string; id: string }> }) {
  const { id } = await params;

  return (
    <Suspense fallback={<VideoDetailSkeleton />}>
      <VideoLoader videoId={id} />
    </Suspense>
  );
}
