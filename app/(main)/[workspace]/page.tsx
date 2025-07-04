import { VideoCard } from "@/components/video-card"

const videoData = [
  {
    id: "1",
    title: "Introducing the Frontend Cloud",
    author: "Vercel",
    duration: "12:34",
    thumbnailUrl: "/placeholder.svg?height=180&width=320",
    authorImageUrl: "/placeholder.svg?height=36&width=36",
  },
  {
    id: "2",
    title: "Next.js 15: A Deep Dive",
    author: "Lee Robinson",
    duration: "45:12",
    thumbnailUrl: "/placeholder.svg?height=180&width=320",
    authorImageUrl: "/placeholder.svg?height=36&width=36",
  },
  {
    id: "3",
    title: "Design Systems with shadcn/ui",
    author: "Shadcn",
    duration: "28:56",
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
]

function VideoSection({ title, videos, workspace }: { title: string; videos: typeof videoData; workspace: string }) {
  return (
    <section>
      <h2 className="text-2xl font-bold mb-6">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-8">
        {videos.map((video) => (
          <VideoCard key={video.id} {...video} workspace={workspace} />
        ))}
      </div>
    </section>
  )
}

export default function HomePage({ params }: { params: { workspace: string } }) {
  return (
    <div className="space-y-12">
      <VideoSection title="Continue watching" videos={videoData.slice(0, 2)} workspace={params.workspace} />
      <VideoSection title="New this week" videos={videoData} workspace={params.workspace} />
      <VideoSection title="From your channels" videos={videoData.slice(1, 4)} workspace={params.workspace} />
    </div>
  )
}
