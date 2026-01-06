'use client';

import { ArrowLeft, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SeriesForm, SortableVideoList, VideoPicker } from '@/components/series';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { SeriesProgressWithDetails, SeriesWithVideos } from '@/lib/types';

interface SeriesDetailClientProps {
  organization: string;
  organizationId: string;
  series: SeriesWithVideos;
  progress: SeriesProgressWithDetails | null;
}

export function SeriesDetailClient({
  organization,
  organizationId,
  series: initialSeries,
  progress,
}: SeriesDetailClientProps) {
  const router = useRouter();
  const [series, setSeries] = useState(initialSeries);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const progressPercentage = progress?.progressPercentage ?? 0;
  const completedCount = progress?.completedCount ?? 0;
  const hasProgress = progressPercentage > 0;

  const handleReorder = async (videoIds: string[]) => {
    try {
      const response = await fetch(`/api/series/${series.id}/videos`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoIds }),
      });

      if (!response.ok) {
        throw new Error('Failed to reorder videos');
      }

      // Update local state with new order
      const reorderedVideos = videoIds
        .map((id, index) => {
          const video = series.videos.find((v) => v.videoId === id);
          return video ? { ...video, position: index } : null;
        })
        .filter(Boolean);

      setSeries((prev) => ({
        ...prev,
        videos: reorderedVideos as typeof prev.videos,
      }));
    } catch (error) {
      console.error('Failed to reorder videos:', error);
      throw error;
    }
  };

  const handleRemoveVideo = async (videoId: string) => {
    try {
      const response = await fetch(`/api/series/${series.id}/videos/${videoId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove video');
      }

      setSeries((prev) => ({
        ...prev,
        videos: prev.videos.filter((v) => v.videoId !== videoId),
        videoCount: prev.videoCount - 1,
      }));
    } catch (error) {
      console.error('Failed to remove video:', error);
      throw error;
    }
  };

  const handleVideosAdded = () => {
    router.refresh();
    // Refetch series data
    fetchSeries();
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/series/${series.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete series');
      }

      router.push(`/${organization}/series`);
    } catch (error) {
      console.error('Failed to delete series:', error);
      setIsDeleting(false);
    }
  };

  const fetchSeries = async () => {
    try {
      const response = await fetch(`/api/series/${series.id}`);
      if (response.ok) {
        const data = await response.json();
        setSeries(data);
      }
    } catch (error) {
      console.error('Failed to fetch series:', error);
    }
  };

  const handleFormSuccess = () => {
    router.refresh();
    fetchSeries();
  };

  // Get the next video to watch
  const nextVideo = progress?.lastVideo
    ? series.videos.find((v) => v.videoId === progress.lastVideoId)?.video
    : series.videos[0]?.video;

  return (
    <div className="space-y-8">
      {/* Back button */}
      <Link
        href={`/${organization}/series`}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Series
      </Link>

      {/* Series header */}
      <div className="flex flex-col md:flex-row gap-6">
        <div className="relative w-full md:w-80 aspect-video rounded-lg overflow-hidden flex-shrink-0">
          <Image
            src={series.thumbnailUrl || series.videos[0]?.video.thumbnailUrl || '/placeholder.svg'}
            alt={series.name}
            fill
            className="object-cover"
          />
          {hasProgress && (
            <div className="absolute bottom-0 left-0 right-0">
              <Progress value={progressPercentage} className="h-2 rounded-none" />
            </div>
          )}
        </div>

        <div className="flex-1">
          <h1 className="text-3xl font-bold">{series.name}</h1>
          {series.description && <p className="text-muted-foreground mt-2">{series.description}</p>}

          <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
            <span>
              {series.videoCount} video{series.videoCount !== 1 ? 's' : ''}
            </span>
            {hasProgress && (
              <>
                <span>•</span>
                <span>
                  {completedCount} of {series.videoCount} completed
                </span>
                <span>•</span>
                <span>{progressPercentage}% complete</span>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-3 mt-6">
            {nextVideo && (
              <Button asChild>
                <Link href={`/${organization}/videos/${nextVideo.id}`}>
                  <Play className="mr-2 h-4 w-4" />
                  {hasProgress ? 'Continue Watching' : 'Start Watching'}
                </Link>
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsPickerOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Videos
            </Button>
            <Button variant="outline" onClick={() => setIsFormOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive hover:text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Series</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{series.name}"? This action cannot be undone. The videos will not
                    be deleted, only removed from this series.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      {/* Videos list */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Videos</h2>
        <SortableVideoList
          videos={series.videos}
          organization={organization}
          seriesId={series.id}
          onReorder={handleReorder}
          onRemove={handleRemoveVideo}
        />
      </div>

      {/* Edit form dialog */}
      <SeriesForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        organizationId={organizationId}
        series={series}
        onSuccess={handleFormSuccess}
      />

      {/* Video picker dialog */}
      <VideoPicker
        open={isPickerOpen}
        onOpenChange={setIsPickerOpen}
        organizationId={organizationId}
        seriesId={series.id}
        onVideosAdded={handleVideosAdded}
      />
    </div>
  );
}
