'use client';

import { IMAGE_SIZES, VIDEO_THUMBNAIL_BLUR_DATA_URL } from '@nuclom/lib/image-utils';
import type { SeriesProgressWithDetails, SeriesWithVideoCount } from '@nuclom/lib/types';
import { Link } from '@vercel/microfrontends/next/client';
import { MoreHorizontal, Pencil, Play, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';

interface SeriesCardProps {
  series: SeriesWithVideoCount & { progress?: SeriesProgressWithDetails };
  organization: string;
  onEdit?: (series: SeriesWithVideoCount) => void;
  onDelete?: (seriesId: string) => void;
  /** Mark as priority for above-the-fold images */
  priority?: boolean;
}

export function SeriesCard({ series, organization, onEdit, onDelete, priority = false }: SeriesCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(series.id);
    } finally {
      setIsDeleting(false);
    }
  };

  const progressPercentage = series.progress?.progressPercentage ?? 0;
  const hasProgress = progressPercentage > 0;

  return (
    <Card className="group hover:border-primary transition-colors overflow-hidden">
      <CardHeader className="p-0 relative">
        <Link href={`/org/${organization}/series/${series.id}`}>
          <div className="relative aspect-video overflow-hidden">
            <Image
              src={series.thumbnailUrl || '/placeholder.svg'}
              alt={series.name}
              fill
              sizes={IMAGE_SIZES.seriesCard}
              priority={priority}
              placeholder="blur"
              blurDataURL={VIDEO_THUMBNAIL_BLUR_DATA_URL}
              className="object-cover group-hover:scale-105 transition-transform"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded-sm">
              {series.videoCount} video{series.videoCount !== 1 ? 's' : ''}
            </div>
            {hasProgress && (
              <div className="absolute bottom-0 left-0 right-0">
                <Progress value={progressPercentage} className="h-1 rounded-none" />
              </div>
            )}
          </div>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8 bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit?.(series)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={handleDelete} disabled={isDeleting}>
              <Trash2 className="mr-2 h-4 w-4" />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="p-4">
        <Link href={`/org/${organization}/series/${series.id}`}>
          <h3 className="font-semibold text-lg line-clamp-1 hover:text-primary transition-colors">{series.name}</h3>
        </Link>
        {series.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{series.description}</p>}
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-muted-foreground">
            {series.videoCount} video{series.videoCount !== 1 ? 's' : ''}
          </span>
          {hasProgress && <span className="text-xs text-muted-foreground">{progressPercentage}% complete</span>}
        </div>
        {hasProgress && series.progress?.lastVideo && (
          <Link
            href={`/org/${organization}/videos/${series.progress.lastVideo.id}`}
            className="mt-3 flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <Play className="h-4 w-4" />
            Continue watching
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
