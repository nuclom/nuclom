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

export default function SharedWithMePage({
  params,
}: {
  params: { workspace: string };
}) {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Shared with me</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-8">
        {sharedVideoData.map((video) => (
          <VideoCard key={video.id} {...video} workspace={params.workspace} />
        ))}
      </div>
    </div>
  );
}
