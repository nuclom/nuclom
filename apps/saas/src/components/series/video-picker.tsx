'use client';

import type { Video } from '@nuclom/lib/db/schema';
import { IMAGE_SIZES, VIDEO_THUMBNAIL_BLUR_DATA_URL } from '@nuclom/lib/image-utils';
import { Check, Search } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface VideoPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  seriesId: string;
  onVideosAdded?: () => void;
}

export function VideoPicker({ open, onOpenChange, organizationId, seriesId, onVideosAdded }: VideoPickerProps) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVideos = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/series/${seriesId}/videos?organizationId=${organizationId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch videos');
      }
      const data = await response.json();
      setVideos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [seriesId, organizationId]);

  useEffect(() => {
    if (open) {
      fetchVideos();
      setSelectedIds(new Set());
      setSearchQuery('');
    }
  }, [open, fetchVideos]);

  const handleToggle = (videoId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) {
        next.delete(videoId);
      } else {
        next.add(videoId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredVideos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredVideos.map((v) => v.id)));
    }
  };

  const handleSubmit = async () => {
    if (selectedIds.size === 0) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Add videos one by one
      for (const videoId of selectedIds) {
        const response = await fetch(`/api/series/${seriesId}/videos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to add video');
        }
      }

      onOpenChange(false);
      onVideosAdded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredVideos = videos.filter((video) => video.title.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add Videos to Series</DialogTitle>
          <DialogDescription>Select videos to add to this series.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search videos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filteredVideos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {videos.length === 0 ? 'No videos available to add' : 'No videos match your search'}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                  {selectedIds.size === filteredVideos.length ? 'Deselect All' : 'Select All'}
                </Button>
                <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
              </div>

              <ScrollArea className="h-[300px] rounded-md border">
                <div className="p-2 space-y-2">
                  {filteredVideos.map((video) => (
                    <div
                      key={video.id}
                      role="button"
                      tabIndex={0}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent cursor-pointer"
                      onClick={() => handleToggle(video.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleToggle(video.id);
                        }
                      }}
                    >
                      <Checkbox
                        checked={selectedIds.has(video.id)}
                        onCheckedChange={() => handleToggle(video.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="relative h-12 w-20 flex-shrink-0 rounded overflow-hidden">
                        <Image
                          src={video.thumbnailUrl || '/placeholder.svg'}
                          alt={video.title}
                          fill
                          sizes={IMAGE_SIZES.thumbnail}
                          placeholder="blur"
                          blurDataURL={VIDEO_THUMBNAIL_BLUR_DATA_URL}
                          className="object-cover"
                        />
                        <div className="absolute bottom-0.5 right-0.5 bg-black/70 text-white text-[10px] px-1 rounded">
                          {video.duration}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{video.title}</p>
                        {video.description && (
                          <p className="text-xs text-muted-foreground truncate">{video.description}</p>
                        )}
                      </div>
                      {selectedIds.has(video.id) && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || selectedIds.size === 0}>
            {isSubmitting ? 'Adding...' : `Add ${selectedIds.size} Video${selectedIds.size !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
