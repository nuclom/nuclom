import { VideoCard } from "@/components/video-card";

const sharedVideoData = [
  {
    id: "shared-1",
    title: "Important All-Hands",
    author: "CEO",
    duration: "48:15",
    thumbnailUrl: "/placeholder.svg?height=180&width=320",
    authorImageUrl: "/placeholder.svg?height=36&width=36",
  },
];

export default async function SharedWithMePage({ params }: { params: Promise<{ organization: string }> }) {
  const { organization } = await params;

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Shared with me</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-8">
        {sharedVideoData.map((video) => (
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
              processingStatus: "completed",
              processingProgress: 100,
              processingError: null,
              width: null,
              height: null,
              codec: null,
              fps: null,
              bitrate: null,
              fileSize: null,
              thumbnailAlternates: null,
              workflowRunId: null,
              processedAt: null,
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
