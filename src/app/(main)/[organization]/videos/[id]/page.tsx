import {
  Bookmark,
  Code,
  Github,
  ListTodo,
  MessageSquarePlus,
  Share2,
  Sparkles,
  ThumbsUp,
} from "lucide-react";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
          <p className="text-sm mt-1">
            This is a great point. We should probably create a ticket for this.
          </p>
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

function TranscriptLine({
  time,
  text,
  hasComment,
}: {
  time: string;
  text: string;
  hasComment?: boolean;
}) {
  return (
    <div className="group relative flex gap-4 p-2 rounded-md hover:bg-secondary">
      <div className="absolute left-[-40px] top-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          className="p-1 rounded-full hover:bg-muted-foreground/20"
        >
          <MessageSquarePlus className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
      <p className="font-mono text-xs text-muted-foreground w-16 shrink-0 pt-1">
        {time}
      </p>
      <p className="flex-1 text-sm">{text}</p>
      {hasComment && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-[hsl(var(--brand-accent))]"></div>
      )}
    </div>
  );
}

export default async function VideoPage({
  params,
}: {
  params: Promise<{ organization: string; id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-8">
      {/* Main Content: Transcript and Comments */}
      <div className="lg:col-span-2 xl:col-span-3 flex flex-col gap-6">
        <header>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Video Title for ID: {id}
          </h1>
          <div className="flex items-center gap-3 mt-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage
                  src="/placeholder.svg?height=24&width=24"
                  alt="Author"
                />
                <AvatarFallback>A</AvatarFallback>
              </Avatar>
              <span>Author Name</span>
            </div>
            <span>•</span>
            <span>2 days ago</span>
          </div>
        </header>

        <Card>
          <CardContent className="p-4 md:p-6">
            <h2 className="text-lg font-semibold mb-4">Transcript</h2>
            <div className="space-y-1 font-mono">
              <TranscriptLine
                time="00:01.24"
                text="Welcome everyone to this presentation. Today we're going to talk about some exciting new developments."
              />
              <TranscriptLine
                time="00:15.55"
                text="As you can see on the screen, the first topic is our new architecture. It's designed for scalability and performance."
                hasComment
              />
              <CommentThread />
              <TranscriptLine
                time="00:32.89"
                text="Let's dive into the details. The core idea is to decouple services..."
              />
              <TranscriptLine
                time="00:45.12"
                text="This is where we introduce the new message queue system."
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sidebar: Video Player and AI Insights */}
      <aside className="w-full lg:col-span-1 xl:col-span-1 space-y-6 lg:sticky top-20 self-start">
        <div className="aspect-video bg-card rounded-lg overflow-hidden border">
          <Image
            src={`/placeholder.svg?height=360&width=640&query=video+player+screen`}
            alt="Video player"
            width={640}
            height={360}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm">
              <ThumbsUp className="h-4 w-4 mr-2" /> 12
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground"
            >
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
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center">
                    <ListTodo className="h-4 w-4 mr-2 text-[hsl(var(--brand-accent))]" />
                    Action Items
                  </h4>
                  <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                    <li>
                      Create ticket for message queue system implementation.
                    </li>
                    <li>Review scalability metrics by end of week.</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center">
                    <Code className="h-4 w-4 mr-2 text-[hsl(var(--brand-accent))]" />
                    Code Snippets
                  </h4>
                  <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
                    <code>{`const client = createClient();`}</code>
                  </pre>
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
                This is the description of the video. It can be a few sentences
                long, explaining what the video is about, providing context, or
                linking to relevant resources.
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </aside>
    </div>
  );
}
