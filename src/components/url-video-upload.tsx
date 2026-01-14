'use client';

import { AlertCircle, CheckCircle, Globe, Loader2, Plus, Trash2, Video } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/client-logger';

interface UrlVideoUploadProps {
  organizationId: string;
  authorId: string;
  channelId?: string;
  collectionId?: string;
  onUploadComplete?: (results: Array<{ videoId: string; title: string }>) => void;
  onCancel?: () => void;
}

interface UrlUpload {
  id: string;
  url: string;
  title: string;
  status: 'pending' | 'validating' | 'importing' | 'completed' | 'failed';
  progress: number;
  error?: string;
  videoId?: string;
}

function extractFilenameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop() || '';
    return filename.replace(/\.[^/.]+$/, '');
  } catch {
    return 'Video from URL';
  }
}

export function UrlVideoUpload({
  organizationId,
  authorId,
  channelId,
  collectionId,
  onUploadComplete,
  onCancel,
}: UrlVideoUploadProps) {
  const { toast } = useToast();
  const [urls, setUrls] = useState<UrlUpload[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const pendingUrls = urls.filter((u) => u.status === 'pending');
  const activeUrls = urls.filter((u) => ['validating', 'importing'].includes(u.status));
  const completedUrls = urls.filter((u) => u.status === 'completed');
  const failedUrls = urls.filter((u) => u.status === 'failed');

  const addUrl = useCallback(() => {
    if (!newUrl.trim()) return;

    // Validate URL format
    let url = newUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }

    try {
      new URL(url);
    } catch {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid URL',
        variant: 'destructive',
      });
      return;
    }

    // Check for duplicates
    if (urls.some((u) => u.url === url)) {
      toast({
        title: 'Duplicate URL',
        description: 'This URL has already been added',
        variant: 'destructive',
      });
      return;
    }

    const title = extractFilenameFromUrl(url);

    setUrls((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        url,
        title: title || 'Video from URL',
        status: 'pending',
        progress: 0,
      },
    ]);
    setNewUrl('');
  }, [newUrl, urls, toast]);

  const removeUrl = (id: string) => {
    setUrls((prev) => prev.filter((u) => u.id !== id));
  };

  const updateTitle = (id: string, title: string) => {
    setUrls((prev) => prev.map((u) => (u.id === id ? { ...u, title } : u)));
  };

  const importUrl = async (upload: UrlUpload): Promise<void> => {
    try {
      setUrls((prev) =>
        prev.map((u) => (u.id === upload.id ? { ...u, status: 'validating' as const, progress: 10 } : u)),
      );

      // Call the import API
      const response = await fetch('/api/videos/upload/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: upload.url,
          title: upload.title,
          organizationId,
          authorId,
          channelId,
          collectionId,
        }),
      });

      setUrls((prev) =>
        prev.map((u) => (u.id === upload.id ? { ...u, status: 'importing' as const, progress: 50 } : u)),
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to import video');
      }

      setUrls((prev) =>
        prev.map((u) =>
          u.id === upload.id ? { ...u, status: 'completed' as const, progress: 100, videoId: data.data.videoId } : u,
        ),
      );
    } catch (error) {
      logger.error('Failed to import video from URL', error);
      setUrls((prev) =>
        prev.map((u) =>
          u.id === upload.id
            ? {
                ...u,
                status: 'failed' as const,
                progress: 0,
                error: error instanceof Error ? error.message : 'Import failed',
              }
            : u,
        ),
      );
    }
  };

  const startImports = async () => {
    if (pendingUrls.length === 0) return;

    setIsImporting(true);

    // Process imports sequentially to avoid overwhelming the server
    for (const upload of pendingUrls) {
      await importUrl(upload);
    }

    setIsImporting(false);

    // Get final results
    const completed = urls.filter(
      (u): u is UrlUpload & { videoId: string } => u.status === 'completed' && u.videoId !== undefined,
    );
    if (completed.length > 0 && onUploadComplete) {
      onUploadComplete(completed.map((u) => ({ videoId: u.videoId, title: u.title })));
    }
  };

  const retryFailed = async () => {
    setUrls((prev) =>
      prev.map((u) =>
        u.status === 'failed' ? { ...u, status: 'pending' as const, error: undefined, progress: 0 } : u,
      ),
    );
    await startImports();
  };

  const clearCompleted = () => {
    setUrls((prev) => prev.filter((u) => u.status !== 'completed'));
  };

  const getStatusBadge = (status: UrlUpload['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'validating':
        return (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Validating
          </Badge>
        );
      case 'importing':
        return (
          <Badge variant="default" className="gap-1 bg-blue-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            Importing
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="default" className="gap-1 bg-green-500">
            <CheckCircle className="h-3 w-3" />
            Complete
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Failed
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Import from URL
        </CardTitle>
        <CardDescription>
          Import videos from direct URLs. Supports direct video file links and popular video hosting platforms.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* URL Input */}
        <div className="flex gap-2">
          <div className="flex-1 space-y-2">
            <Label htmlFor="video-url">Video URL</Label>
            <div className="flex gap-2">
              <Input
                id="video-url"
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://example.com/video.mp4"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addUrl();
                  }
                }}
                disabled={isImporting}
              />
              <Button type="button" onClick={addUrl} disabled={!newUrl.trim() || isImporting}>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Supports direct video links (.mp4, .mov, .webm, etc.) and platforms like YouTube, Vimeo, Loom
            </p>
          </div>
        </div>

        {/* URL List */}
        {urls.length > 0 && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {urls.length} URL{urls.length !== 1 ? 's' : ''} added
              </span>
              <div className="flex items-center gap-4">
                {completedUrls.length > 0 && <span className="text-green-600">{completedUrls.length} completed</span>}
                {failedUrls.length > 0 && <span className="text-red-600">{failedUrls.length} failed</span>}
              </div>
            </div>

            {/* Overall Progress */}
            {isImporting && (
              <div className="space-y-2">
                <Progress value={(completedUrls.length / urls.length) * 100} className="h-2" />
                <p className="text-sm text-muted-foreground text-center">
                  Importing {activeUrls.length} of {pendingUrls.length + activeUrls.length} URLs
                </p>
              </div>
            )}

            {/* URL Items */}
            <ScrollArea className="max-h-80">
              <div className="space-y-2">
                {urls.map((upload) => (
                  <div
                    key={upload.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      upload.status === 'failed'
                        ? 'border-destructive/50 bg-destructive/5'
                        : upload.status === 'completed'
                          ? 'border-green-500/50 bg-green-500/5'
                          : ''
                    }`}
                  >
                    <Video className="h-8 w-8 text-muted-foreground shrink-0" />

                    <div className="flex-1 min-w-0 space-y-1">
                      {upload.status === 'pending' ? (
                        <Input
                          value={upload.title}
                          onChange={(e) => updateTitle(upload.id, e.target.value)}
                          className="h-7 text-sm"
                          placeholder="Video title"
                        />
                      ) : (
                        <p className="font-medium truncate text-sm">{upload.title}</p>
                      )}

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate max-w-[200px]">{upload.url}</span>
                        {upload.error && (
                          <>
                            <span>-</span>
                            <span className="text-destructive">{upload.error}</span>
                          </>
                        )}
                      </div>

                      {upload.status === 'importing' && <Progress value={upload.progress} className="h-1" />}
                    </div>

                    <div className="flex items-center gap-2">
                      {getStatusBadge(upload.status)}

                      {(upload.status === 'pending' || upload.status === 'failed') && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeUrl(upload.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Error Alert */}
        {failedUrls.length > 0 && !isImporting && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>
                {failedUrls.length} import{failedUrls.length !== 1 ? 's' : ''} failed
              </span>
              <Button variant="outline" size="sm" onClick={retryFailed}>
                Retry Failed
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Success Alert */}
        {completedUrls.length === urls.length && urls.length > 0 && !isImporting && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              All {completedUrls.length} video{completedUrls.length !== 1 ? 's' : ''} imported successfully!
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4">
          {pendingUrls.length > 0 && (
            <Button onClick={startImports} disabled={isImporting} className="flex-1">
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Globe className="h-4 w-4 mr-2" />
                  Import {pendingUrls.length} Video{pendingUrls.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          )}

          {completedUrls.length > 0 && !isImporting && (
            <Button variant="outline" onClick={clearCompleted}>
              Clear Completed
            </Button>
          )}

          {onCancel && (
            <Button variant="outline" onClick={onCancel} disabled={isImporting}>
              {urls.length === 0 ? 'Cancel' : 'Close'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
