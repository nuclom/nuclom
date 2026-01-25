'use client';

import { logger } from '@nuclom/lib/client-logger';
import { Button } from '@nuclom/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@nuclom/ui/dialog';
import { Input } from '@nuclom/ui/input';
import { Label } from '@nuclom/ui/label';
import { Textarea } from '@nuclom/ui/textarea';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface VideoEditDialogProps {
  videoId: string;
  initialTitle: string;
  initialDescription?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function VideoEditDialog({
  videoId,
  initialTitle,
  initialDescription,
  open,
  onOpenChange,
  onSuccess,
}: VideoEditDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription || '');
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when dialog opens with new values
  useEffect(() => {
    if (open) {
      setTitle(initialTitle);
      setDescription(initialDescription || '');
    }
  }, [open, initialTitle, initialDescription]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        toast({
          title: 'Title required',
          description: 'Please enter a video title',
          variant: 'destructive',
        });
        return;
      }

      setIsSaving(true);
      try {
        const response = await fetch(`/api/videos/${videoId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: trimmedTitle,
            description: description.trim() || null,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to update video');
        }

        toast({
          title: 'Video updated',
          description: 'Video details have been saved',
        });

        onOpenChange(false);
        onSuccess?.();
        router.refresh();
      } catch (error) {
        logger.error('Failed to update video', error);
        toast({
          title: 'Update failed',
          description: error instanceof Error ? error.message : 'Could not update video',
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }
    },
    [videoId, title, description, toast, onOpenChange, onSuccess, router],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit video</DialogTitle>
            <DialogDescription>Update the video title and description.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Video title"
                disabled={isSaving}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description (optional)"
                disabled={isSaving}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !title.trim()}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
