'use client';

import { Clock, Download, ExternalLink, Loader2, MoreVertical, Play, Scissors, Trash2 } from 'lucide-react';
import Image from 'next/image';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import type { ClipStatus, MomentType } from '@/lib/db/schema';
import { cn } from '@/lib/utils';

interface Clip {
  id: string;
  videoId: string;
  title: string;
  description: string | null;
  startTime: number;
  endTime: number;
  clipType: 'auto' | 'manual';
  momentType: MomentType | null;
  status: ClipStatus;
  thumbnailUrl: string | null;
  storageKey: string | null;
  createdAt: string;
  creator?: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;
}

interface ClipsListProps {
  videoId: string;
  onSeek?: (time: number) => void;
}

const statusConfig: Record<ClipStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-500/10 text-yellow-500' },
  processing: { label: 'Processing', color: 'bg-blue-500/10 text-blue-500' },
  ready: { label: 'Ready', color: 'bg-green-500/10 text-green-500' },
  failed: { label: 'Failed', color: 'bg-red-500/10 text-red-500' },
};

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDuration(startTime: number, endTime: number): string {
  const duration = endTime - startTime;
  const mins = Math.floor(duration / 60);
  const secs = Math.floor(duration % 60);
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

export function ClipsList({ videoId, onSeek }: ClipsListProps) {
  const { toast } = useToast();
  const [clips, setClips] = useState<Clip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteClipId, setDeleteClipId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchClips = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/videos/${videoId}/clips`);
      if (!response.ok) {
        throw new Error('Failed to fetch clips');
      }
      const data = await response.json();
      setClips(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clips');
    } finally {
      setIsLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    fetchClips();
  }, [fetchClips]);

  const handleDelete = async () => {
    if (!deleteClipId) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/clips/${deleteClipId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete clip');
      }

      setClips((prev) => prev.filter((c) => c.id !== deleteClipId));
      toast({
        title: 'Clip deleted',
        description: 'The clip has been deleted successfully.',
      });
    } catch (err) {
      toast({
        title: 'Failed to delete clip',
        description: err instanceof Error ? err.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setDeleteClipId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-center text-sm text-muted-foreground">{error}</div>;
  }

  if (clips.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-8">
          <Scissors className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            No clips yet. Create your first clip from a key moment or manually select a segment.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clips.map((clip) => {
          const status = statusConfig[clip.status];

          return (
            <Card key={clip.id} className="group overflow-hidden">
              <button
                type="button"
                className="relative aspect-video bg-muted cursor-pointer w-full"
                onClick={() => onSeek?.(clip.startTime)}
              >
                {clip.thumbnailUrl ? (
                  <Image
                    src={clip.thumbnailUrl}
                    alt={clip.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Scissors className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-secondary text-secondary-foreground px-3 py-1.5">
                    <Play className="h-4 w-4 mr-2" />
                    Preview
                  </span>
                </div>
                <div className="absolute bottom-2 right-2">
                  <Badge variant="secondary" className="text-xs">
                    {formatDuration(clip.startTime, clip.endTime)}
                  </Badge>
                </div>
              </button>
              <CardHeader className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm font-medium line-clamp-1">{clip.title}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Clock className="h-3 w-3" />
                      <span className="text-xs">
                        {formatTime(clip.startTime)} - {formatTime(clip.endTime)}
                      </span>
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {clip.status === 'ready' && clip.storageKey && (
                        <>
                          <DropdownMenuItem>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Share
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteClipId(clip.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <Badge className={cn('text-xs', status.color)}>{status.label}</Badge>
                {clip.description && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{clip.description}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={!!deleteClipId} onOpenChange={() => setDeleteClipId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete clip?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The clip and any associated files will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
