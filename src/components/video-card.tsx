import Image from "next/image";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import type { VideoWithAuthor } from "@/lib/types";

interface VideoCardProps {
  id: string;
  title: string;
  author: VideoWithAuthor["author"];
  thumbnailUrl: string;
  duration: string;
  workspace: string;
}

export function VideoCard(props: VideoCardProps) {
  const videoData = {
    id: props.id,
    title: props.title,
    duration: props.duration,
    thumbnailUrl: props.thumbnailUrl,
    author: props.author,
    workspace: props.workspace,
  };

  return (
    <Link
      href={`/${videoData.workspace}/videos/${videoData.id}`}
      className="group"
    >
      <Card className="bg-transparent border-0 shadow-none rounded-lg overflow-hidden">
        <CardContent className="p-0">
          <div className="relative aspect-video overflow-hidden rounded-lg border group-hover:border-primary transition-colors">
            <Image
              src={videoData.thumbnailUrl || "/placeholder.svg"}
              alt={videoData.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded-sm font-mono">
              {videoData.duration}
            </div>
          </div>
          <div className="flex items-start gap-3 mt-3">
            <Avatar className="h-9 w-9">
              <AvatarImage
                src={videoData.author.avatarUrl || "/placeholder.svg"}
                alt={videoData.author.name || "Author"}
              />
              <AvatarFallback>
                {videoData.author.name ? videoData.author.name.charAt(0) : "A"}
              </AvatarFallback>
            </Avatar>
            <div>
              <h4 className="font-medium leading-tight text-foreground">
                {videoData.title}
              </h4>
              <p className="text-sm text-muted-foreground">
                {videoData.author.name}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
