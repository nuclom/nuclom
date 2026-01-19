'use client';

import { IMAGE_SIZES, VIDEO_THUMBNAIL_BLUR_DATA_URL } from '@nuclom/lib/image-utils';
import { formatDistanceToNow } from 'date-fns';
import { Clock, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface DeletedVideo {
  id: string;
  title: string;
  duration: string;
  thumbnailUrl: string | null;
  deletedAt: string;
  retentionUntil: string;
  author: {
    id: string;
    name: string | null;
    image: string | null;
  };
}

interface DeletedVideosResponse {
  success: boolean;
  data: {
    data: DeletedVideo[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

function TrashVideoCard({
  video,
  onRestore,
  onPermanentDelete,
}: {
  video: DeletedVideo;
  onRestore: (id: string) => Promise<void>;
  onPermanentDelete: (id: string) => Promise<void>;
}) {
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      await onRestore(video.id);
    } finally {
      setIsRestoring(false);
    }
  };

  const handlePermanentDelete = async () => {
    setIsDeleting(true);
    try {
      await onPermanentDelete(video.id);
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const deletedAt = new Date(video.deletedAt);
  const retentionUntil = new Date(video.retentionUntil);
  const daysUntilPermanentDeletion = Math.ceil((retentionUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <>
      <Card className="overflow-hidden group">
        <CardContent className="p-0">
          {/* Thumbnail */}
          <div className="relative aspect-video overflow-hidden bg-muted">
            <Image
              src={video.thumbnailUrl || '/placeholder.svg'}
              alt={video.title}
              fill
              sizes={IMAGE_SIZES.videoCard}
              placeholder="blur"
              blurDataURL={VIDEO_THUMBNAIL_BLUR_DATA_URL}
              className="object-cover opacity-60"
            />
            {/* Duration badge */}
            <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded-md font-medium backdrop-blur-sm">
              {video.duration}
            </div>
            {/* Deleted overlay */}
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
              <div className="bg-destructive/90 text-destructive-foreground text-xs px-3 py-1.5 rounded-full font-medium flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                {daysUntilPermanentDeletion > 0 ? `${daysUntilPermanentDeletion} days left` : 'Expires today'}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 space-y-3">
            <div>
              <h4 className="font-medium leading-tight text-foreground line-clamp-2">{video.title}</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Deleted {formatDistanceToNow(deletedAt, { addSuffix: true })}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleRestore}
                disabled={isRestoring || isDeleting}
              >
                {isRestoring ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RotateCcw className="h-4 w-4 mr-2" />
                )}
                Restore
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                disabled={isRestoring || isDeleting}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete video?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{video.title}&quot; and remove all associated files from storage. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePermanentDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function TrashPageSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-0">
              <Skeleton className="aspect-video" />
              <div className="p-4 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex gap-2">
                  <Skeleton className="h-9 flex-1" />
                  <Skeleton className="h-9 w-9" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function TrashPage() {
  const router = useRouter();

  const [videos, setVideos] = useState<DeletedVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDeletedVideos = useCallback(async () => {
    try {
      const response = await fetch('/api/videos/deleted');
      if (!response.ok) {
        throw new Error('Failed to fetch deleted videos');
      }
      const data: DeletedVideosResponse = await response.json();
      if (data.success && data.data) {
        setVideos(data.data.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeletedVideos();
  }, [fetchDeletedVideos]);

  const handleRestore = async (videoId: string) => {
    try {
      const response = await fetch(`/api/videos/${videoId}/restore`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to restore video');
      }

      // Remove from list
      setVideos((prev) => prev.filter((v) => v.id !== videoId));
      router.refresh();
    } catch (err) {
      console.error('Failed to restore video:', err);
    }
  };

  const handlePermanentDelete = async (videoId: string) => {
    try {
      const response = await fetch(`/api/videos/${videoId}?permanent=true`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete video');
      }

      // Remove from list
      setVideos((prev) => prev.filter((v) => v.id !== videoId));
    } catch (err) {
      console.error('Failed to delete video:', err);
    }
  };

  if (isLoading) {
    return <TrashPageSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-destructive mb-4">{error}</p>
        <Button onClick={() => fetchDeletedVideos()}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Trash</h1>
        <p className="text-muted-foreground mt-1">Videos in trash will be permanently deleted after 30 days</p>
      </div>

      {videos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-6 mb-4">
            <Trash2 className="h-12 w-12 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Trash is empty</h2>
          <p className="text-muted-foreground max-w-sm">
            When you delete videos, they&apos;ll appear here for 30 days before being permanently removed.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {videos.map((video) => (
            <TrashVideoCard
              key={video.id}
              video={video}
              onRestore={handleRestore}
              onPermanentDelete={handlePermanentDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
