'use client';

import type { VideoWithAuthor } from '@nuclom/lib/types';
import { Button } from '@nuclom/ui/button';
import { Link } from '@vercel/microfrontends/next/client';
import { ChevronRight, Upload } from 'lucide-react';
import { VideoPreviewCard } from '@/components/video-preview-card';

interface VideoSectionProps {
  title: string;
  description?: string;
  videos: VideoWithAuthor[];
  organization: string;
  viewAllHref?: string;
  emptyMessage?: string;
  showUploadCTA?: boolean;
}

export function VideoSection({
  title,
  description,
  videos,
  organization,
  viewAllHref,
  emptyMessage = 'No videos yet',
  showUploadCTA = false,
}: VideoSectionProps) {
  if (videos.length === 0 && !showUploadCTA) {
    return null;
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        </div>
        {viewAllHref && videos.length > 0 && (
          <Button variant="ghost" size="sm" asChild>
            <Link href={viewAllHref} className="gap-1">
              View all
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        )}
      </div>

      {videos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 rounded-xl border-2 border-dashed border-muted bg-muted/20">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Upload className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-center mb-4">{emptyMessage}</p>
          {showUploadCTA && (
            <Button asChild>
              <Link href={`/org/${organization}/upload`}>
                <Upload className="mr-2 h-4 w-4" />
                Upload your first video
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-8">
          {videos.map((video, index) => (
            <VideoPreviewCard key={video.id} video={video} organization={organization} priority={index < 4} />
          ))}
        </div>
      )}
    </section>
  );
}
