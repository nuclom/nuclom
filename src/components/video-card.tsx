"use client";

import { Clock, Eye, Flag, MoreVertical, Play } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IMAGE_SIZES, VIDEO_THUMBNAIL_BLUR_DATA_URL } from "@/lib/image-utils";
import type { VideoWithAuthor } from "@/lib/types";
import { ReportDialog } from "@/components/moderation/report-dialog";

interface VideoCardProps {
  video: VideoWithAuthor & { views?: number };
  organization?: string;
  priority?: boolean;
  showProgress?: boolean;
  progress?: number;
  showReportOption?: boolean;
}

export function VideoCard({
  video,
  organization,
  priority = false,
  showProgress = false,
  progress = 0,
  showReportOption = true,
}: VideoCardProps) {
  const organizationSlug = organization || "default";

  const formatViews = (views: number) => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return views.toString();
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / 86400000);

    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
  };

  return (
    <div className="group relative">
      <Link href={`/${organizationSlug}/videos/${video.id}`} className="block">
        <Card className="bg-transparent border-0 shadow-none overflow-hidden">
          <CardContent className="p-0">
            {/* Thumbnail */}
            <div className="relative aspect-video overflow-hidden rounded-xl border bg-muted group-hover:ring-2 ring-primary/50 transition-all duration-200">
              <Image
                src={video.thumbnailUrl || "/placeholder.svg"}
                alt={video.title}
                fill
                sizes={IMAGE_SIZES.videoCard}
                priority={priority}
                placeholder="blur"
                blurDataURL={VIDEO_THUMBNAIL_BLUR_DATA_URL}
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />

              {/* Play overlay on hover */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-center justify-center">
                <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all duration-200">
                  <Play className="w-6 h-6 text-primary fill-primary ml-1" />
                </div>
              </div>

              {/* Duration badge */}
              <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded-md font-medium backdrop-blur-sm">
                {video.duration}
              </div>

              {/* Progress bar */}
              {showProgress && progress > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
                  <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
              )}

              {/* New badge */}
              {video.createdAt && new Date(video.createdAt).getTime() > Date.now() - 86400000 * 7 && (
                <Badge
                  variant="secondary"
                  className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] font-semibold"
                >
                  NEW
                </Badge>
              )}
            </div>

            {/* Content */}
            <div className="flex items-start gap-3 mt-3">
              <Avatar className="h-9 w-9 ring-2 ring-background">
                <AvatarImage src={video.author.image || "/placeholder.svg"} alt={video.author.name || "Author"} />
                <AvatarFallback className="text-xs font-medium">
                  {video.author.name ? video.author.name.charAt(0).toUpperCase() : "A"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium leading-tight text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                  {video.title}
                </h4>
                <p className="text-sm text-muted-foreground mt-1">{video.author.name}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  {video.views !== undefined && (
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {formatViews(video.views)} views
                    </span>
                  )}
                  {video.createdAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(video.createdAt)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* Report Menu - positioned absolutely */}
      {showReportOption && (
        <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="h-8 w-8 bg-black/60 hover:bg-black/80 text-white border-0"
                onClick={(e) => e.preventDefault()}
              >
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">More options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <ReportDialog
                resourceType="video"
                resourceId={video.id}
                trigger={
                  <DropdownMenuItem className="cursor-pointer" onSelect={(e) => e.preventDefault()}>
                    <Flag className="mr-2 h-4 w-4" />
                    Report video
                  </DropdownMenuItem>
                }
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
