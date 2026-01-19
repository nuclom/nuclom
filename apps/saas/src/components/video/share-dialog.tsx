'use client';

import { logger } from '@nuclom/lib/client-logger';
import type { Video, VideoShareLink } from '@nuclom/lib/db/schema';
import { formatDistanceToNow } from 'date-fns';
import { Copy, Link2, Loader2, Lock, Share2, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

interface ShareDialogProps {
  video: Pick<Video, 'id' | 'title' | 'organizationId'>;
  organizationSlug: string;
}

type AccessLevel = 'view' | 'comment' | 'download';
type ExpiresIn = 'never' | '1d' | '7d' | '30d';

interface ShareLinkWithCreator extends VideoShareLink {
  creator?: { name: string | null };
}

export function ShareDialog({ video, organizationSlug }: ShareDialogProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [shareLinks, setShareLinks] = useState<ShareLinkWithCreator[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Form state for new link
  const [accessLevel, setAccessLevel] = useState<AccessLevel>('view');
  const [password, setPassword] = useState('');
  const [expiresIn, setExpiresIn] = useState<ExpiresIn>('never');
  const [maxViews, setMaxViews] = useState<string>('');

  // Direct video URL
  const directUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/${organizationSlug}/videos/${video.id}` : '';

  // Load existing share links
  const loadShareLinks = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/videos/${video.id}/share`);
      const data = await res.json();
      if (data.success) {
        setShareLinks(data.data || []);
      }
    } catch (error) {
      logger.error('Failed to load share links', error);
    } finally {
      setIsLoading(false);
    }
  }, [video.id]);

  useEffect(() => {
    if (isOpen) {
      loadShareLinks();
    }
  }, [isOpen, loadShareLinks]);

  const createShareLink = async () => {
    setIsCreating(true);
    try {
      const res = await fetch(`/api/videos/${video.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessLevel,
          password: password || undefined,
          expiresIn,
          maxViews: maxViews ? Number.parseInt(maxViews, 10) : undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShareLinks([data.data, ...shareLinks]);
        // Reset form
        setPassword('');
        setMaxViews('');
        toast({ title: 'Share link created!' });
      } else {
        toast({
          title: 'Failed to create link',
          description: data.error,
          variant: 'destructive',
        });
      }
    } catch (error) {
      logger.error('Failed to create share link', error);
      toast({
        title: 'Failed to create link',
        description: 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const copyLink = useCallback(
    (linkId: string) => {
      const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/share/${linkId}` : '';
      navigator.clipboard.writeText(shareUrl);
      toast({ title: 'Link copied!' });
    },
    [toast],
  );

  const copyDirectLink = useCallback(() => {
    navigator.clipboard.writeText(directUrl);
    toast({ title: 'Link copied!' });
  }, [directUrl, toast]);

  const revokeLink = async (linkId: string) => {
    try {
      const res = await fetch(`/api/videos/${video.id}/share/${linkId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setShareLinks(shareLinks.filter((l) => l.id !== linkId));
        toast({ title: 'Link revoked' });
      }
    } catch (error) {
      logger.error('Failed to revoke link', error);
      toast({
        title: 'Failed to revoke link',
        variant: 'destructive',
      });
    }
  };

  const getAccessLevelLabel = (level: AccessLevel) => {
    switch (level) {
      case 'view':
        return 'View only';
      case 'comment':
        return 'Can comment';
      case 'download':
        return 'Can download';
      default:
        return level;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Share2 className="mr-2 h-4 w-4" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share "{video.title}"
          </DialogTitle>
          <DialogDescription>Create share links with access controls</DialogDescription>
        </DialogHeader>

        {/* Quick copy current link */}
        <div className="flex gap-2">
          <Input value={directUrl} readOnly className="text-sm" />
          <Button variant="outline" size="icon" onClick={copyDirectLink}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>

        <Separator />

        {/* Create new share link */}
        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Create share link
          </h4>

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="access-level">Access level</Label>
              <Select value={accessLevel} onValueChange={(value: AccessLevel) => setAccessLevel(value)}>
                <SelectTrigger id="access-level">
                  <SelectValue placeholder="Select access level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">View only</SelectItem>
                  <SelectItem value="comment">Can comment</SelectItem>
                  <SelectItem value="download">Can download</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password protection (optional)</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Leave empty for no password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expires-in">Expires</Label>
                <Select value={expiresIn} onValueChange={(value: ExpiresIn) => setExpiresIn(value)}>
                  <SelectTrigger id="expires-in">
                    <SelectValue placeholder="Select expiration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Never</SelectItem>
                    <SelectItem value="1d">1 day</SelectItem>
                    <SelectItem value="7d">7 days</SelectItem>
                    <SelectItem value="30d">30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-views">Max views (optional)</Label>
                <Input
                  id="max-views"
                  type="number"
                  placeholder="Unlimited"
                  value={maxViews}
                  onChange={(e) => setMaxViews(e.target.value)}
                  min="1"
                />
              </div>
            </div>

            <Button onClick={createShareLink} disabled={isCreating} className="w-full">
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
              Create Link
            </Button>
          </div>
        </div>

        <Separator />

        {/* Existing share links */}
        <div className="space-y-3">
          <h4 className="font-medium">Active links</h4>
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : shareLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No active share links</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {shareLinks.map((link) => (
                <div key={link.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="min-w-0">
                    <p className="text-sm font-mono truncate">/share/{link.id.slice(0, 8)}...</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span>{link.viewCount} views</span>
                      <span>•</span>
                      <span>{getAccessLevelLabel(link.accessLevel as AccessLevel)}</span>
                      {link.password && (
                        <>
                          <span>•</span>
                          <Lock className="h-3 w-3" />
                        </>
                      )}
                      {link.expiresAt && (
                        <>
                          <span>•</span>
                          <span>Expires {formatDistanceToNow(new Date(link.expiresAt), { addSuffix: true })}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => copyLink(link.id)} title="Copy link">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => revokeLink(link.id)} title="Revoke link">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
