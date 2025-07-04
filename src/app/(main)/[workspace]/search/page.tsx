"use client";

import { useSearchParams } from "next/navigation";
import { VideoCard } from "@/components/video-card";

const searchResults = [
  {
    id: "1",
    title: "Introducing the Frontend Cloud",
    author: "Vercel",
    duration: "12:34",
    thumbnailUrl: "/placeholder.svg?height=180&width=320",
    authorImageUrl: "/placeholder.svg?height=36&width=36",
  },
  {
    id: "4",
    title: "AI-Powered Development with v0",
    author: "Vercel",
    duration: "18:21",
    thumbnailUrl: "/placeholder.svg?height=180&width=320",
    authorImageUrl: "/placeholder.svg?height=36&width=36",
  },
];

export default async function SearchPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const searchParams = useSearchParams();
  const query = searchParams.get("q");

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">
        Search results for <span className="text-primary">"{query}"</span>
      </h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-8">
        {searchResults.map((video) => (
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
