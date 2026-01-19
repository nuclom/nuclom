'use client';

import { logger } from '@nuclom/lib/client-logger';
import { cn } from '@nuclom/lib/utils';
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clipboard,
  Globe,
  Link2,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

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
  platform: VideoPlatform;
  status: 'pending' | 'validating' | 'importing' | 'completed' | 'failed';
  progress: number;
  error?: string;
  videoId?: string;
}

type VideoPlatform = 'youtube' | 'vimeo' | 'loom' | 'direct' | 'unknown';

interface PlatformInfo {
  name: string;
  icon: React.ReactNode;
  color: string;
}

const PLATFORMS: Record<VideoPlatform, PlatformInfo> = {
  youtube: {
    name: 'YouTube',
    icon: <YouTubeIcon />,
    color: 'text-red-500',
  },
  vimeo: {
    name: 'Vimeo',
    icon: <VimeoIcon />,
    color: 'text-cyan-500',
  },
  loom: {
    name: 'Loom',
    icon: <LoomIcon />,
    color: 'text-purple-500',
  },
  direct: {
    name: 'Direct Link',
    icon: <Link2 className="h-5 w-5" />,
    color: 'text-blue-500',
  },
  unknown: {
    name: 'Video URL',
    icon: <Globe className="h-5 w-5" />,
    color: 'text-muted-foreground',
  },
};

function detectPlatform(url: string): VideoPlatform {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      return 'youtube';
    }
    if (hostname.includes('vimeo.com')) {
      return 'vimeo';
    }
    if (hostname.includes('loom.com')) {
      return 'loom';
    }

    // Check for direct video file
    const pathname = urlObj.pathname.toLowerCase();
    if (/\.(mp4|mov|webm|avi|mkv|wmv|flv|3gp)$/.test(pathname)) {
      return 'direct';
    }

    return 'unknown';
  } catch {
    return 'unknown';
  }
}

function extractFilenameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop() || '';
    const name = filename.replace(/\.[^/.]+$/, '');
    return name || 'Video from URL';
  } catch {
    return 'Video from URL';
  }
}

function extractVideoTitle(url: string, platform: VideoPlatform): string {
  switch (platform) {
    case 'youtube':
      return 'YouTube Video';
    case 'vimeo':
      return 'Vimeo Video';
    case 'loom':
      return 'Loom Recording';
    case 'direct':
      return extractFilenameFromUrl(url);
    default:
      return extractFilenameFromUrl(url) || 'Video from URL';
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
  const [expandedSection, setExpandedSection] = useState<'pending' | 'completed' | 'failed' | null>('pending');
  const [detectedPlatform, setDetectedPlatform] = useState<VideoPlatform | null>(null);

  const pendingUrls = urls.filter((u) => u.status === 'pending');
  const activeUrls = urls.filter((u) => ['validating', 'importing'].includes(u.status));
  const completedUrls = urls.filter((u) => u.status === 'completed');
  const failedUrls = urls.filter((u) => u.status === 'failed');

  // Detect platform as user types
  useEffect(() => {
    if (newUrl.trim()) {
      let url = newUrl.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
      }
      try {
        new URL(url);
        setDetectedPlatform(detectPlatform(url));
      } catch {
        setDetectedPlatform(null);
      }
    } else {
      setDetectedPlatform(null);
    }
  }, [newUrl]);

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

    const platform = detectPlatform(url);
    const title = extractVideoTitle(url, platform);

    setUrls((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        url,
        title,
        platform,
        status: 'pending',
        progress: 0,
      },
    ]);
    setNewUrl('');
    setDetectedPlatform(null);
    setExpandedSection('pending');
  }, [newUrl, urls, toast]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setNewUrl(text);
        // Auto-add if it looks like a valid URL
        if (text.includes('.') && (text.startsWith('http') || text.includes('://'))) {
          // Delay to allow state update
          setTimeout(() => {
            const urlInput = document.getElementById('video-url-input') as HTMLInputElement;
            if (urlInput) {
              urlInput.focus();
            }
          }, 100);
        }
      }
    } catch {
      toast({
        title: 'Paste failed',
        description: 'Could not access clipboard. Please paste manually.',
        variant: 'destructive',
      });
    }
  }, [toast]);

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

  const clearAll = () => {
    setUrls([]);
  };

  return (
    <Card className="w-full max-w-3xl mx-auto overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Globe className="h-5 w-5" />
              Import from URL
            </CardTitle>
            <CardDescription className="mt-1">
              Import videos from YouTube, Vimeo, Loom, or any direct video link
            </CardDescription>
          </div>
          {urls.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAll} className="text-muted-foreground">
              Clear all
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* URL Input */}
        <div className="space-y-3">
          <Label htmlFor="video-url-input" className="sr-only">
            Video URL
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              {/* Platform indicator */}
              {detectedPlatform && (
                <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10">
                  <div className={cn('flex items-center', PLATFORMS[detectedPlatform].color)}>
                    {PLATFORMS[detectedPlatform].icon}
                  </div>
                </div>
              )}
              <Input
                id="video-url-input"
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="Paste video URL here..."
                className={cn('pr-10', detectedPlatform && 'pl-11')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addUrl();
                  }
                }}
                disabled={isImporting}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={handlePaste}
                disabled={isImporting}
                title="Paste from clipboard"
              >
                <Clipboard className="h-4 w-4" />
              </Button>
            </div>
            <Button type="button" onClick={addUrl} disabled={!newUrl.trim() || isImporting}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>

          {/* Supported platforms */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Supported:</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <YouTubeIcon className="h-4 w-4" />
                YouTube
              </span>
              <span className="flex items-center gap-1">
                <VimeoIcon className="h-4 w-4" />
                Vimeo
              </span>
              <span className="flex items-center gap-1">
                <LoomIcon className="h-4 w-4" />
                Loom
              </span>
              <span className="flex items-center gap-1">
                <Link2 className="h-4 w-4" />
                Direct links
              </span>
            </div>
          </div>
        </div>

        {/* URL Queue */}
        {urls.length > 0 && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">
                  {urls.length} URL{urls.length !== 1 ? 's' : ''}
                </span>
                <div className="flex items-center gap-2 text-xs">
                  {completedUrls.length > 0 && (
                    <Badge variant="secondary" className="gap-1 bg-green-500/10 text-green-600 dark:text-green-400">
                      <CheckCircle className="h-3 w-3" />
                      {completedUrls.length}
                    </Badge>
                  )}
                  {failedUrls.length > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {failedUrls.length}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Overall Progress */}
            {isImporting && (
              <div className="space-y-2">
                <Progress value={(completedUrls.length / urls.length) * 100} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">
                  Importing {activeUrls.length > 0 ? activeUrls.length : 1} of {pendingUrls.length + activeUrls.length}{' '}
                  URLs
                </p>
              </div>
            )}

            {/* Active Imports */}
            {activeUrls.length > 0 && (
              <div className="space-y-2">
                {activeUrls.map((upload) => {
                  const platform = PLATFORMS[upload.platform];
                  return (
                    <div
                      key={upload.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20"
                    >
                      <div className={cn('shrink-0', platform.color)}>{platform.icon}</div>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <p className="font-medium text-sm truncate">{upload.title}</p>
                        <div className="flex items-center gap-2">
                          <Progress value={upload.progress} className="flex-1 h-1.5" />
                          <Loader2 className="h-4 w-4 text-blue-500 animate-spin shrink-0" />
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{upload.url}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pending URLs Section */}
            {pendingUrls.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedSection(expandedSection === 'pending' ? null : 'pending')}
                >
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                    Ready to import ({pendingUrls.length})
                  </span>
                  {expandedSection === 'pending' ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                {expandedSection === 'pending' && (
                  <ScrollArea className="max-h-60">
                    <div className="divide-y">
                      {pendingUrls.map((upload) => {
                        const platform = PLATFORMS[upload.platform];
                        return (
                          <div
                            key={upload.id}
                            className="flex items-center gap-3 p-3 hover:bg-muted/20 transition-colors"
                          >
                            <div className={cn('shrink-0', platform.color)}>{platform.icon}</div>
                            <div className="flex-1 min-w-0 space-y-1">
                              <Input
                                value={upload.title}
                                onChange={(e) => updateTitle(upload.id, e.target.value)}
                                className="h-7 text-sm"
                                placeholder="Video title"
                                disabled={isImporting}
                              />
                              <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {platform.name}
                                </Badge>
                                <span className="truncate">{upload.url}</span>
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={() => removeUrl(upload.id)}
                              disabled={isImporting}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}

            {/* Completed Section */}
            {completedUrls.length > 0 && (
              <div className="border border-green-500/20 rounded-lg overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center justify-between p-3 bg-green-500/5 hover:bg-green-500/10 transition-colors"
                  onClick={() => setExpandedSection(expandedSection === 'completed' ? null : 'completed')}
                >
                  <span className="text-sm font-medium flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    Imported ({completedUrls.length})
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearCompleted();
                      }}
                    >
                      Clear
                    </Button>
                    {expandedSection === 'completed' ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>
                {expandedSection === 'completed' && (
                  <ScrollArea className="max-h-40">
                    <div className="divide-y divide-green-500/10">
                      {completedUrls.map((upload) => {
                        const platform = PLATFORMS[upload.platform];
                        return (
                          <div key={upload.id} className="flex items-center gap-3 p-3">
                            <div className={cn('shrink-0', platform.color)}>{platform.icon}</div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{upload.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{upload.url}</p>
                            </div>
                            <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}

            {/* Failed Section */}
            {failedUrls.length > 0 && (
              <div className="border border-destructive/20 rounded-lg overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center justify-between p-3 bg-destructive/5 hover:bg-destructive/10 transition-colors"
                  onClick={() => setExpandedSection(expandedSection === 'failed' ? null : 'failed')}
                >
                  <span className="text-sm font-medium flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    Failed ({failedUrls.length})
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        retryFailed();
                      }}
                      disabled={isImporting}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Retry all
                    </Button>
                    {expandedSection === 'failed' ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>
                {expandedSection === 'failed' && (
                  <ScrollArea className="max-h-40">
                    <div className="divide-y divide-destructive/10">
                      {failedUrls.map((upload) => {
                        const platform = PLATFORMS[upload.platform];
                        return (
                          <div key={upload.id} className="flex items-center gap-3 p-3">
                            <div className={cn('shrink-0 opacity-50', platform.color)}>{platform.icon}</div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{upload.title}</p>
                              <p className="text-xs text-destructive">{upload.error || 'Import failed'}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={() => removeUrl(upload.id)}
                              disabled={isImporting}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {urls.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">Paste a video URL above to get started</p>
            <p className="text-xs mt-1">You can add multiple URLs before importing</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          {pendingUrls.length > 0 && (
            <Button onClick={startImports} disabled={isImporting} className="flex-1" size="lg">
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

          {onCancel && (
            <Button variant="outline" onClick={onCancel} disabled={isImporting} size="lg">
              {urls.length === 0 ? 'Cancel' : 'Done'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Platform Icons
function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-5 w-5', className)} fill="currentColor" aria-hidden="true">
      <path d="M23.5 6.2c-.3-1-1-1.8-2-2.1C19.8 3.5 12 3.5 12 3.5s-7.8 0-9.5.5c-1 .3-1.7 1.1-2 2.1C0 7.9 0 12 0 12s0 4.1.5 5.8c.3 1 1 1.8 2 2.1 1.7.5 9.5.5 9.5.5s7.8 0 9.5-.5c1-.3 1.7-1.1 2-2.1.5-1.7.5-5.8.5-5.8s0-4.1-.5-5.8zM9.5 15.5v-7l6.5 3.5-6.5 3.5z" />
    </svg>
  );
}

function VimeoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-5 w-5', className)} fill="currentColor" aria-hidden="true">
      <path d="M23.977 6.416c-.105 2.338-1.739 5.543-4.894 9.609-3.268 4.247-6.026 6.37-8.29 6.37-1.409 0-2.578-1.294-3.553-3.881L5.322 11.4C4.603 8.816 3.834 7.522 3.01 7.522c-.179 0-.806.378-1.881 1.132L0 7.197c1.185-1.044 2.351-2.084 3.501-3.128C5.08 2.701 6.266 1.984 7.055 1.91c1.867-.18 3.016 1.1 3.447 3.838.465 2.953.789 4.789.971 5.507.539 2.45 1.131 3.674 1.776 3.674.502 0 1.256-.796 2.265-2.385 1.004-1.589 1.54-2.797 1.612-3.628.144-1.371-.395-2.061-1.614-2.061-.574 0-1.167.121-1.777.391 1.186-3.868 3.434-5.757 6.762-5.637 2.473.06 3.628 1.664 3.493 4.797l-.013.01z" />
    </svg>
  );
}

function LoomIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-5 w-5', className)} fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 18.75a6.75 6.75 0 110-13.5 6.75 6.75 0 010 13.5z" />
      <circle cx="12" cy="12" r="3.5" />
    </svg>
  );
}
