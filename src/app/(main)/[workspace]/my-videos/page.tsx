import { VideoCard } from "@/components/video-card";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import Link from "next/link";

const myVideoData = [
  {
    id: "my-1",
    title: "My First Screen Recording",
    author: "Me",
    duration: "05:12",
    thumbnailUrl: "/placeholder.svg?height=180&width=320",
    authorImageUrl: "/placeholder.svg?height=36&width=36",
  },
  {
    id: "my-2",
    title: "Project Update - Q2",
    author: "Me",
    duration: "15:43",
    thumbnailUrl: "/placeholder.svg?height=180&width=320",
    authorImageUrl: "/placeholder.svg?height=36&width=36",
  },
];

export default async function MyVideosPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">My Videos</h1>
        <Link href={`/${workspace}/upload`}>
          <Button className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload Video
          </Button>
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-8">
        {myVideoData.map((video) => (
          <VideoCard
            key={video.id}
            video={{
              id: video.id,
              title: video.title,
              description: null,
              duration: video.duration,
              thumbnailUrl: video.thumbnailUrl,
              videoUrl: null,
              authorId: `author-${video.id}`,
              organizationId: "organization",
              channelId: null,
              collectionId: null,
              transcript: null,
              aiSummary: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              author: {
                id: `author-${video.id}`,
                name: video.author,
                email: `${video.author.toLowerCase().replace(" ", ".")}@example.com`,
                image: video.authorImageUrl,
                createdAt: new Date(),
                updatedAt: new Date(),
                emailVerified: true,
                role: "user",
                banned: null,
                banReason: null,
                banExpires: null,
              },
            }}
            workspace={workspace}
          />
        ))}
      </div>
    </div>
  );
}
