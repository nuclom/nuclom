import { Avatar } from "@/components/ui/avatar";
import { VideoCard } from "@/components/video-card";

const channelVideoData = [
  {
    id: "c1-v1",
    title: "Weekly Standup",
    author: "Team Lead",
    duration: "55:30",
    thumbnailUrl: "/placeholder.svg?height=180&width=320",
    authorImageUrl: "/placeholder.svg?height=36&width=36",
  },
  {
    id: "c1-v2",
    title: "Q3 Planning Session",
    author: "Product Manager",
    duration: "01:15:20",
    thumbnailUrl: "/placeholder.svg?height=180&width=320",
    authorImageUrl: "/placeholder.svg?height=36&width=36",
  },
  {
    id: "c1-v3",
    title: "New Feature Demo",
    author: "Engineer",
    duration: "15:00",
    thumbnailUrl: "/placeholder.svg?height=180&width=320",
    authorImageUrl: "/placeholder.svg?height=36&width=36",
  },
  {
    id: "c1-v4",
    title: "Design Review",
    author: "Designer",
    duration: "48:18",
    thumbnailUrl: "/placeholder.svg?height=180&width=320",
    authorImageUrl: "/placeholder.svg?height=36&width=36",
  },
];

export default async function ChannelPage({ params }: { params: Promise<{ organization: string; id: string }> }) {
  const { organization, id } = await params;
  const channelName = id.replace("-", " ");
  return (
    <div className="space-y-8">
      <header className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <div className="flex h-full w-full items-center justify-center rounded-full bg-purple-500 text-2xl font-bold">
            {channelName.charAt(0).toUpperCase()}
          </div>
        </Avatar>
        <div>
          <h1 className="text-4xl font-bold capitalize">{channelName}</h1>
          <p className="text-gray-400">24 members</p>
        </div>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-8">
        {channelVideoData.map((video) => (
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
            organization={organization}
          />
        ))}
      </div>
    </div>
  );
}
