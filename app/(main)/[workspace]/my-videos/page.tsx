import { VideoCard } from "@/components/video-card"

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
]

export default function MyVideosPage({ params }: { params: { workspace: string } }) {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">My Videos</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-8">
        {myVideoData.map((video) => (
          <VideoCard key={video.id} {...video} workspace={params.workspace} />
        ))}
      </div>
    </div>
  )
}
