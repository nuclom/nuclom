import Image from "next/image";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import type { VideoWithAuthor } from "@/lib/types";

interface VideoCardProps {
  video: VideoWithAuthor;
  workspace?: string;
}

export function VideoCard({ video, workspace }: VideoCardProps) {
  const workspaceSlug = workspace || "default";

  return (
    <Link
      href={`/${workspaceSlug}/videos/${video.id}`}
      className="group"
    >
      <Card className="bg-transparent border-0 shadow-none rounded-lg overflow-hidden">
        <CardContent className="p-0">
          <div className="relative aspect-video overflow-hidden rounded-lg border group-hover:border-primary transition-colors">
            <Image
              src={video.thumbnailUrl || "/placeholder.svg"}
              alt={video.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded-sm font-mono">
              {video.duration}
            </div>
          </div>
          <div className="flex items-start gap-3 mt-3">
            <Avatar className="h-9 w-9">
              <AvatarImage
                src={video.author.image || "/placeholder.svg"}
                alt={video.author.name || "Author"}
              />
              <AvatarFallback>
                {video.author.name ? video.author.name.charAt(0) : "A"}
              </AvatarFallback>
            </Avatar>
            <div>
              <h4 className="font-medium leading-tight text-foreground">
                {video.title}
              </h4>
              <p className="text-sm text-muted-foreground">
                {video.author.name}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
