'use client';

import { Loader2, Scissors } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface CreateClipDialogProps {
  videoId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: {
    momentId?: string;
    title?: string;
    description?: string;
    startTime?: number;
    endTime?: number;
    transcriptExcerpt?: string;
    momentType?: string;
  };
  onSuccess?: () => void;
}

function formatTimeInput(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function parseTimeInput(timeStr: string): number | null {
  const parts = timeStr.split(':').map((p) => Number.parseInt(p, 10));
  if (parts.length === 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1]) && !Number.isNaN(parts[2])) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return null;
}

export function CreateClipDialog({ videoId, open, onOpenChange, initialData, onSuccess }: CreateClipDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [startTimeStr, setStartTimeStr] = useState(
    initialData?.startTime !== undefined ? formatTimeInput(initialData.startTime) : '0:00',
  );
  const [endTimeStr, setEndTimeStr] = useState(
    initialData?.endTime !== undefined ? formatTimeInput(initialData.endTime) : '0:00',
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const startTime = parseTimeInput(startTimeStr);
    const endTime = parseTimeInput(endTimeStr);

    if (startTime === null || endTime === null) {
      toast({
        title: 'Invalid time format',
        description: 'Please use MM:SS or HH:MM:SS format',
        variant: 'destructive',
      });
      return;
    }

    if (endTime <= startTime) {
      toast({
        title: 'Invalid time range',
        description: 'End time must be after start time',
        variant: 'destructive',
      });
      return;
    }

    if (!title.trim()) {
      toast({
        title: 'Title required',
        description: 'Please enter a title for the clip',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/videos/${videoId}/clips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          startTime,
          endTime,
          momentId: initialData?.momentId,
          momentType: initialData?.momentType,
          transcriptExcerpt: initialData?.transcriptExcerpt,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create clip');
      }

      toast({
        title: 'Clip created',
        description: 'Your clip is being processed and will be ready soon.',
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast({
        title: 'Failed to create clip',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="h-5 w-5" />
            Create Clip
          </DialogTitle>
          <DialogDescription>Create a shareable clip from this video segment.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give your clip a title"
                maxLength={200}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description..."
                maxLength={1000}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  value={startTimeStr}
                  onChange={(e) => setStartTimeStr(e.target.value)}
                  placeholder="0:00"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  value={endTimeStr}
                  onChange={(e) => setEndTimeStr(e.target.value)}
                  placeholder="0:30"
                />
              </div>
            </div>
            {initialData?.transcriptExcerpt && (
              <div className="grid gap-2">
                <Label>Transcript Excerpt</Label>
                <p className="text-sm text-muted-foreground bg-muted p-2 rounded-md line-clamp-3">
                  "{initialData.transcriptExcerpt}"
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Clip'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
