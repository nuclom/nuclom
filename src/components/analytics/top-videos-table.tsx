"use client";

import { Clock, Eye, TrendingUp } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface TopVideo {
  videoId: string;
  viewCount: number;
  totalWatchTime: number;
  avgCompletion: number;
  video?: {
    id: string;
    title: string;
    thumbnailUrl: string | null;
    duration: string;
  };
}

interface TopVideosTableProps {
  videos: TopVideo[];
  organizationSlug: string;
}

function formatWatchTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export function TopVideosTable({ videos, organizationSlug }: TopVideosTableProps) {
  if (videos.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Top Videos
          </CardTitle>
          <CardDescription>Most viewed videos in this period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            No videos with views yet
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Top Videos
        </CardTitle>
        <CardDescription>Most viewed videos in this period</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Video</TableHead>
              <TableHead className="text-right">Views</TableHead>
              <TableHead className="text-right">Watch Time</TableHead>
              <TableHead className="w-[20%]">Completion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {videos.map((item, index) => (
              <TableRow key={item.videoId}>
                <TableCell>
                  <Link
                    href={`/${organizationSlug}/videos/${item.videoId}`}
                    className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                  >
                    <span className="text-muted-foreground text-sm font-medium w-4">{index + 1}</span>
                    {item.video?.thumbnailUrl ? (
                      <div className="relative w-16 h-9 rounded overflow-hidden bg-muted flex-shrink-0">
                        <Image
                          src={item.video.thumbnailUrl}
                          alt={item.video.title || "Video thumbnail"}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-9 rounded bg-muted flex-shrink-0" />
                    )}
                    <span className="font-medium truncate max-w-[200px]">
                      {item.video?.title || "Unknown Video"}
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Eye className="h-3 w-3 text-muted-foreground" />
                    <span>{item.viewCount.toLocaleString()}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span>{formatWatchTime(item.totalWatchTime)}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={item.avgCompletion} className="h-2" />
                    <span className="text-xs text-muted-foreground w-10">{item.avgCompletion}%</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
