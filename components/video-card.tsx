import Image from "next/image"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"

interface VideoCardProps {
  id: string
  title: string
  author: string
  thumbnailUrl: string
  authorImageUrl: string
  duration: string
  workspace: string
}

export function VideoCard({ id, title, author, thumbnailUrl, authorImageUrl, duration, workspace }: VideoCardProps) {
  return (
    <Link href={`/${workspace}/videos/${id}`} className="group">
      <Card className="bg-transparent border-0 shadow-none rounded-lg overflow-hidden">
        <CardContent className="p-0">
          <div className="relative aspect-video overflow-hidden rounded-lg border group-hover:border-primary transition-colors">
            <Image
              src={thumbnailUrl || "/placeholder.svg"}
              alt={title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded-sm font-mono">
              {duration}
            </div>
          </div>
          <div className="flex items-start gap-3 mt-3">
            <Avatar className="h-9 w-9">
              <AvatarImage src={authorImageUrl || "/placeholder.svg"} alt={author} />
              <AvatarFallback>{author.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <h4 className="font-medium leading-tight text-foreground">{title}</h4>
              <p className="text-sm text-muted-foreground">{author}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
