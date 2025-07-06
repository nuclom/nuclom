import { Bookmark, Code, Github, ListTodo, MessageSquarePlus, Share2, Sparkles, ThumbsUp } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VideoPlayer } from "@/components/video-player";
import { VideoComments } from "@/components/video-comments";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getVideo } from "@/lib/api/videos";
import { formatDistanceToNow } from "date-fns";

function CommentThread() {
  return (
    <div className="ml-10 my-4 p-4 border rounded-lg bg-card/50">
      <div className="flex items-start gap-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src="/placeholder.svg?height=32&width=32" />
          <AvatarFallback>JD</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm">Jane Doe</p>
            <p className="text-xs text-muted-foreground">2 hours ago</p>
          </div>
          <p className="text-sm mt-1">This is a great point. We should probably create a ticket for this.</p>
          <div className="mt-2 flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <Github className="h-4 w-4 mr-2" />
              Create Issue
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TranscriptLine({ time, text, hasComment }: { time: string; text: string; hasComment?: boolean }) {
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
        <div className="absolute right-2 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-[hsl(var(--brand-accent))]"></div>
      )}
    </div>
  );
}

export default async function VideoPage({ params }: { params: Promise<{ organization: string; id: string }> }) {
  const { organization: organizationSlug, id } = await params;

  // Get user from session
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  // Get video data
  let video;
  try {
    video = await getVideo(id);
  } catch (error) {
    redirect(`/${organizationSlug}`);
  }

  // Parse transcript if it exists
  const transcriptLines = video.transcript
    ? video.transcript.split("\n").map((line) => {
        const match = line.match(/^(\d{2}:\d{2}\.\d{2})\s+(.+)$/);
        return match ? { time: match[1], text: match[2] } : { time: "00:00.00", text: line };
      })
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
                <AvatarImage src={video.author.image || "/placeholder.svg"} alt={video.author.name} />
                <AvatarFallback>{video.author.name?.charAt(0) || "A"}</AvatarFallback>
              </Avatar>
              <span>{video.author.name}</span>
            </div>
            <span>•</span>
            <span>{formatDistanceToNow(new Date(video.createdAt), { addSuffix: true })}</span>
          </div>
        </header>

        <Card>
          <CardContent className="p-4 md:p-6">
            <h2 className="text-lg font-semibold mb-4">Transcript</h2>
            <div className="space-y-1 font-mono">
              {transcriptLines.length > 0 ? (
                transcriptLines.map((line, index) => (
                  <TranscriptLine
                    key={index}
                    time={line.time}
                    text={line.text}
                    hasComment={false} // TODO: Implement comments system
                  />
                ))
              ) : (
                <p className="text-muted-foreground">No transcript available for this video.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Comments Section */}
        <VideoComments
          videoId={video.id}
          currentUserId={session.user.id}
          onTimestampClick={(timestamp) => {
            // TODO: Implement timestamp seeking in video player
            console.log("Seeking to:", timestamp);
          }}
        />
      </div>

      {/* Sidebar: Video Player and AI Insights */}
      <aside className="w-full lg:col-span-1 xl:col-span-1 space-y-6 lg:sticky top-20 self-start">
        <div className="aspect-video">
          <VideoPlayer
            src={video.videoUrl || "/placeholder-video.mp4"}
            poster={video.thumbnailUrl || "/placeholder.svg"}
            title={video.title}
            className="w-full h-full"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm">
              <ThumbsUp className="h-4 w-4 mr-2" /> 12
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
                  <div className="space-y-2">
                    <h4 className="font-semibold">AI Summary</h4>
                    <p className="text-muted-foreground">{video.aiSummary}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center">
                      <ListTodo className="h-4 w-4 mr-2 text-[hsl(var(--brand-accent))]" />
                      AI Analysis
                    </h4>
                    <p className="text-muted-foreground">
                      AI analysis is not available for this video yet. Upload a new video to see AI-powered insights.
                    </p>
                  </div>
                )}

                {/* Duration and basic info */}
                <div className="space-y-2">
                  <h4 className="font-semibold">Video Info</h4>
                  <ul className="text-muted-foreground space-y-1">
                    <li>Duration: {video.duration}</li>
                    {video.channel && <li>Channel: {video.channel.name}</li>}
                    {video.collection && <li>Collection: {video.collection.name}</li>}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="details">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Description</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {video.description || "No description available for this video."}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </aside>
    </div>
  );
}
