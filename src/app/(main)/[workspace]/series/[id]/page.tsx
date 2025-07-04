import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VideoCard } from "@/components/video-card";

const seriesVideoData = [
  {
    id: "s1-v1",
    title: "Part 1: The Foundation",
    author: "Series Creator",
    duration: "22:10",
    thumbnailUrl: "/placeholder.svg?height=180&width=320",
    authorImageUrl: "/placeholder.svg?height=36&width=36",
  },
  {
    id: "s1-v2",
    title: "Part 2: Building Blocks",
    author: "Series Creator",
    duration: "19:45",
    thumbnailUrl: "/placeholder.svg?height=180&width=320",
    authorImageUrl: "/placeholder.svg?height=36&width=36",
  },
  {
    id: "s1-v3",
    title: "Part 3: Advanced Techniques",
    author: "Series Creator",
    duration: "31:02",
    thumbnailUrl: "/placeholder.svg?height=180&width=320",
    authorImageUrl: "/placeholder.svg?height=36&width=36",
  },
];

export default async function SeriesPage({
  params,
}: {
  params: Promise<{ workspace: string; id: string }>;
}) {
  const { workspace, id } = await params;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl font-bold capitalize">
          {id.replace("-", " ")} Series
        </h1>
        <p className="text-gray-400 mt-2 max-w-2xl">
          A collection of videos exploring a specific topic in depth. Follow
          along to master new skills.
        </p>
        <Button className="mt-4">
          <Plus className="mr-2 h-4 w-4" /> Add to my videos
        </Button>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-8">
        {seriesVideoData.map((video) => (
          <VideoCard
            key={video.id}
            id={video.id}
            title={video.title}
            author={{
              id: `author-${video.id}`,
              name: video.author,
              email: `${video.author.toLowerCase().replace(' ', '.')}@example.com`,
              avatarUrl: video.authorImageUrl,
              createdAt: new Date(),
              updatedAt: new Date(),
            }}
            thumbnailUrl={video.thumbnailUrl}
            duration={video.duration}
            workspace={workspace}
          />
        ))}
      </div>
    </div>
  );
}
