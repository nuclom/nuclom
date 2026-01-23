'use client';

import { formatFileSize } from '@nuclom/lib/format-utils';
import { cn } from '@nuclom/lib/utils';
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  FileVideo,
  Loader2,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { type ChangeEvent, useCallback, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

interface BulkVideoUploadProps {
  organizationId: string;
  authorId: string;
  collectionId?: string;
  onUploadComplete?: (results: Array<{ videoId: string; title: string }>) => void;
  onCancel?: () => void;
}

interface FileUpload {
  id: string;
  file: File;
  title: string;
  status: 'pending' | 'preparing' | 'uploading' | 'confirming' | 'completed' | 'failed' | 'paused';
  progress: number;
  error?: string;
  uploadUrl?: string;
  fileKey?: string;
  videoId?: string;
  abortController?: AbortController;
  thumbnailUrl?: string;
  duration?: number;
}

// Generate video thumbnail from file
function generateVideoThumbnail(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    video.onloadeddata = () => {
      // Seek to 1 second or 10% of duration, whichever is smaller
      video.currentTime = Math.min(1, video.duration * 0.1);
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 90;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);
          URL.revokeObjectURL(objectUrl);
          resolve(thumbnailUrl);
        } else {
          URL.revokeObjectURL(objectUrl);
          resolve(null);
        }
      } catch {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };

    // Timeout fallback
    setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    }, 5000);
  });
}

// Get video duration from file
function getVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(video.duration);
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };

    setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    }, 3000);
  });
}

// Format duration in mm:ss or hh:mm:ss
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Get file extension badge color
function getExtensionColor(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'mp4':
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
    case 'mov':
      return 'bg-purple-500/10 text-purple-600 dark:text-purple-400';
    case 'webm':
      return 'bg-green-500/10 text-green-600 dark:text-green-400';
    case 'avi':
      return 'bg-orange-500/10 text-orange-600 dark:text-orange-400';
    case 'mkv':
      return 'bg-red-500/10 text-red-600 dark:text-red-400';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

// Video thumbnail component
function VideoThumbnail({ upload }: { upload: FileUpload }) {
  const ext = upload.file.name.split('.').pop()?.toUpperCase() || 'VIDEO';

  return (
    <div className="relative w-16 h-10 rounded-md overflow-hidden bg-muted shrink-0">
      {upload.thumbnailUrl ? (
        <img
          src={upload.thumbnailUrl}
          alt={`Preview of ${upload.title}`}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <FileVideo className="h-5 w-5 text-muted-foreground/50" />
        </div>
      )}
      {/* Duration badge */}
      {upload.duration && (
        <div className="absolute bottom-0.5 right-0.5 px-1 py-0.5 bg-black/70 rounded text-[9px] font-medium text-white">
          {formatDuration(upload.duration)}
        </div>
      )}
      {/* File type badge */}
      <div className={cn(
        'absolute top-0.5 left-0.5 px-1 py-0.5 rounded text-[8px] font-bold uppercase',
        getExtensionColor(upload.file.name)
      )}>
        {ext}
      </div>
    </div>
  );
}

// Supported video MIME types
const SUPPORTED_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/webm',
  'video/x-flv',
  'video/x-ms-wmv',
  'video/3gpp',
  'video/mpeg',
  'video/ogg',
];

// Max file size: 5GB
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024;

// Max files at once
const MAX_FILES = 20;

// Concurrent uploads
const CONCURRENT_UPLOADS = 3;

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.message === 'Upload aborted');
}

export function BulkVideoUpload({
  organizationId,
  authorId,
  collectionId,
  onUploadComplete,
  onCancel,
}: BulkVideoUploadProps) {
  const { toast } = useToast();
  const [uploads, setUploads] = useState<FileUpload[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [expandedSection, setExpandedSection] = useState<'pending' | 'completed' | 'failed' | null>('pending');

  const pendingUploads = useMemo(() => uploads.filter((u) => u.status === 'pending'), [uploads]);
  const activeUploads = useMemo(
    () => uploads.filter((u) => ['preparing', 'uploading', 'confirming'].includes(u.status)),
    [uploads],
  );
  const completedUploads = useMemo(() => uploads.filter((u) => u.status === 'completed'), [uploads]);
  const failedUploads = useMemo(() => uploads.filter((u) => u.status === 'failed'), [uploads]);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const validFiles: FileUpload[] = [];
      const errors: string[] = [];

      // Check total count
      if (uploads.length + fileArray.length > MAX_FILES) {
        toast({
          title: 'Too many files',
          description: `Maximum ${MAX_FILES} files can be uploaded at once. You have ${uploads.length} files already.`,
          variant: 'destructive',
        });
        return;
      }

      for (const file of fileArray) {
        // Check type
        if (!SUPPORTED_VIDEO_TYPES.includes(file.type)) {
          errors.push(`${file.name}: Unsupported format`);
          continue;
        }

        // Check size
        if (file.size > MAX_FILE_SIZE) {
          errors.push(`${file.name}: Exceeds 5GB limit`);
          continue;
        }

        // Check duplicates
        if (uploads.some((u) => u.file.name === file.name && u.file.size === file.size)) {
          errors.push(`${file.name}: Already added`);
          continue;
        }

        validFiles.push({
          id: crypto.randomUUID(),
          file,
          title: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
          status: 'pending',
          progress: 0,
        });
      }

      if (errors.length > 0) {
        toast({
          title: 'Some files were skipped',
          description: errors.slice(0, 3).join(', ') + (errors.length > 3 ? ` and ${errors.length - 3} more` : ''),
          variant: 'destructive',
        });
      }

      if (validFiles.length > 0) {
        setUploads((prev) => [...prev, ...validFiles]);
        setExpandedSection('pending');

        // Generate thumbnails and get duration in background (don't block)
        for (const upload of validFiles) {
          Promise.all([
            generateVideoThumbnail(upload.file),
            getVideoDuration(upload.file),
          ]).then(([thumbnailUrl, duration]) => {
            setUploads((prev) =>
              prev.map((u) =>
                u.id === upload.id
                  ? { ...u, thumbnailUrl: thumbnailUrl ?? undefined, duration: duration ?? undefined }
                  : u
              )
            );
          });
        }
      }
    },
    [uploads, toast],
  );

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles],
  );

  const removeUpload = (id: string) => {
    setUploads((prev) => {
      const upload = prev.find((u) => u.id === id);
      if (upload?.abortController) {
        upload.abortController.abort();
      }
      return prev.filter((u) => u.id !== id);
    });
  };

  const updateTitle = (id: string, title: string) => {
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, title } : u)));
  };

  const uploadFile = async (upload: FileUpload): Promise<void> => {
    const abortController = new AbortController();

    try {
      // Update status to preparing
      setUploads((prev) =>
        prev.map((u) => (u.id === upload.id ? { ...u, status: 'preparing' as const, abortController } : u)),
      );

      // Step 1: Get presigned URL
      const presignedResponse = await fetch('/api/videos/upload/presigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: upload.file.name,
          contentType: upload.file.type,
          fileSize: upload.file.size,
          organizationId,
        }),
        signal: abortController.signal,
      });

      const presignedData = await presignedResponse.json();

      if (!presignedData.success) {
        throw new Error(presignedData.error || 'Failed to get upload URL');
      }

      const { uploadUrl, fileKey, uploadId } = presignedData.data;

      // Update status to uploading
      setUploads((prev) =>
        prev.map((u) =>
          u.id === upload.id ? { ...u, status: 'uploading' as const, uploadUrl, fileKey, progress: 0 } : u,
        ),
      );

      // Step 2: Upload directly to R2 using presigned URL
      const xhr = new XMLHttpRequest();

      await new Promise<void>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            setUploads((prev) => prev.map((u) => (u.id === upload.id ? { ...u, progress } : u)));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Upload failed')));
        xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

        // Handle abort signal
        abortController.signal.addEventListener('abort', () => xhr.abort());

        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', upload.file.type);
        xhr.send(upload.file);
      });

      // Update status to confirming
      setUploads((prev) =>
        prev.map((u) => (u.id === upload.id ? { ...u, status: 'confirming' as const, progress: 100 } : u)),
      );

      // Step 3: Confirm upload and create video record
      const confirmResponse = await fetch('/api/videos/upload/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId,
          fileKey,
          filename: upload.file.name,
          fileSize: upload.file.size,
          title: upload.title,
          organizationId,
          authorId,
          collectionId,
        }),
        signal: abortController.signal,
      });

      const confirmData = await confirmResponse.json();

      if (!confirmData.success) {
        throw new Error(confirmData.error || 'Failed to confirm upload');
      }

      // Update status to completed
      setUploads((prev) =>
        prev.map((u) =>
          u.id === upload.id ? { ...u, status: 'completed' as const, videoId: confirmData.data.videoId } : u,
        ),
      );
    } catch (error) {
      if (isAbortError(error)) {
        setUploads((prev) =>
          prev.map((u) => (u.id === upload.id ? { ...u, status: 'pending' as const, progress: 0 } : u)),
        );
      } else {
        setUploads((prev) =>
          prev.map((u) =>
            u.id === upload.id
              ? {
                  ...u,
                  status: 'failed' as const,
                  error: error instanceof Error ? error.message : 'Upload failed',
                }
              : u,
          ),
        );
      }
    }
  };

  const startUploads = async () => {
    if (pendingUploads.length === 0) return;

    setIsUploading(true);

    // Process uploads with concurrency limit
    const queue = [...pendingUploads];

    const processQueue = async () => {
      while (queue.length > 0) {
        const batch = queue.splice(0, CONCURRENT_UPLOADS);
        await Promise.all(batch.map((upload) => uploadFile(upload)));
      }
    };

    await processQueue();

    setIsUploading(false);

    // Get final results
    const completed = uploads.filter(
      (u): u is FileUpload & { videoId: string } => u.status === 'completed' && u.videoId !== undefined,
    );
    if (completed.length > 0 && onUploadComplete) {
      onUploadComplete(completed.map((u) => ({ videoId: u.videoId, title: u.title })));
    }
  };

  const retryFailed = async () => {
    // Reset failed uploads to pending
    setUploads((prev) =>
      prev.map((u) =>
        u.status === 'failed' ? { ...u, status: 'pending' as const, error: undefined, progress: 0 } : u,
      ),
    );

    // Start uploads
    await startUploads();
  };

  const clearCompleted = () => {
    setUploads((prev) => prev.filter((u) => u.status !== 'completed'));
  };

  const clearAll = () => {
    // Abort any active uploads
    for (const upload of uploads) {
      if (upload.abortController) {
        upload.abortController.abort();
      }
    }
    setUploads([]);
  };

  const getStatusText = (status: FileUpload['status']) => {
    switch (status) {
      case 'pending':
        return 'Waiting';
      case 'preparing':
        return 'Preparing';
      case 'uploading':
        return 'Uploading';
      case 'confirming':
        return 'Processing';
      case 'completed':
        return 'Complete';
      case 'failed':
        return 'Failed';
      default:
        return '';
    }
  };

  const totalSize = useMemo(() => uploads.reduce((sum, u) => sum + u.file.size, 0), [uploads]);
  const uploadedSize = useMemo(
    () => uploads.filter((u) => u.status === 'completed').reduce((sum, u) => sum + u.file.size, 0),
    [uploads],
  );
  const overallProgress = useMemo(() => {
    if (totalSize === 0) return 0;
    const activeProgress = activeUploads.reduce((sum, u) => sum + (u.file.size * u.progress) / 100, 0);
    return Math.round(((uploadedSize + activeProgress) / totalSize) * 100);
  }, [totalSize, uploadedSize, activeUploads]);

  return (
    <Card className="w-full max-w-3xl mx-auto overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Upload className="h-5 w-5" />
              Upload Videos
            </CardTitle>
            <CardDescription className="mt-1">
              Upload multiple videos at once with fast, reliable cloud uploads
            </CardDescription>
          </div>
          {uploads.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAll} className="text-muted-foreground">
              <X className="h-4 w-4 mr-1" />
              Clear all
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Drop Zone */}
        <div
          role="region"
          aria-label="Drop zone for video files"
          className={cn(
            'relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300',
            dragActive
              ? 'border-primary bg-primary/5 scale-[1.01]'
              : 'border-muted-foreground/20 hover:border-muted-foreground/40 hover:bg-muted/30',
            isUploading && 'opacity-50 pointer-events-none',
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="space-y-4">
            <div
              className={cn(
                'inline-flex p-4 rounded-full bg-muted/50 transition-transform duration-200',
                dragActive && 'scale-110',
              )}
            >
              <Upload className={cn('h-8 w-8 text-muted-foreground', dragActive && 'text-primary animate-bounce')} />
            </div>
            <div>
              <p className="text-lg font-medium">{dragActive ? 'Drop videos here' : 'Drag and drop videos'}</p>
              <p className="text-sm text-muted-foreground">or click to browse</p>
            </div>
            <Input
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              multiple
              className="hidden"
              id="bulk-video-upload"
              disabled={isUploading}
            />
            <Label htmlFor="bulk-video-upload" className="cursor-pointer inline-block">
              <Button type="button" variant="outline" disabled={isUploading} className="pointer-events-none">
                <FileVideo className="h-4 w-4 mr-2" />
                Select Files
              </Button>
            </Label>
            <p className="text-xs text-muted-foreground">
              MP4, MOV, AVI, MKV, WebM · Up to 5GB per file · Maximum {MAX_FILES} files
            </p>
          </div>
        </div>

        {/* Upload Queue */}
        {uploads.length > 0 && (
          <div className="space-y-4">
            {/* Summary Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">
                  {uploads.length} file{uploads.length !== 1 ? 's' : ''}{' '}
                  <span className="text-muted-foreground font-normal">({formatFileSize(totalSize)})</span>
                </span>
                <div className="flex items-center gap-2 text-xs">
                  {completedUploads.length > 0 && (
                    <Badge variant="secondary" className="gap-1 bg-green-500/10 text-green-600 dark:text-green-400">
                      <CheckCircle className="h-3 w-3" />
                      {completedUploads.length}
                    </Badge>
                  )}
                  {failedUploads.length > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {failedUploads.length}
                    </Badge>
                  )}
                </div>
              </div>
              {isUploading && <span className="text-sm text-muted-foreground">{overallProgress}% complete</span>}
            </div>

            {/* Overall Progress */}
            {(isUploading || activeUploads.length > 0) && (
              <div className="space-y-2">
                <Progress value={overallProgress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">
                  Uploading {activeUploads.length} of {pendingUploads.length + activeUploads.length} files
                </p>
              </div>
            )}

            {/* Active Uploads */}
            {activeUploads.length > 0 && (
              <div className="space-y-2">
                {activeUploads.map((upload) => (
                  <div
                    key={upload.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20"
                  >
                    <div className="relative shrink-0">
                      <VideoThumbnail upload={upload} />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-md">
                        <Loader2 className="h-5 w-5 text-white animate-spin" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <p className="font-medium text-sm truncate">{upload.title}</p>
                      <div className="flex items-center gap-2">
                        <Progress value={upload.progress} className="flex-1 h-1.5" />
                        <span className="text-xs text-muted-foreground shrink-0 w-10 text-right">
                          {upload.progress}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatFileSize(upload.file.size)}</span>
                        <span className="text-muted-foreground/50">·</span>
                        <span className="text-blue-500">{getStatusText(upload.status)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pending Files Section */}
            {pendingUploads.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedSection(expandedSection === 'pending' ? null : 'pending')}
                >
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Pending ({pendingUploads.length})
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
                      {pendingUploads.map((upload) => (
                        <div
                          key={upload.id}
                          className="flex items-center gap-3 p-3 hover:bg-muted/20 transition-colors"
                        >
                          <VideoThumbnail upload={upload} />
                          <div className="flex-1 min-w-0 space-y-1">
                            <Input
                              value={upload.title}
                              onChange={(e) => updateTitle(upload.id, e.target.value)}
                              className="h-7 text-sm"
                              placeholder="Video title"
                              disabled={isUploading}
                            />
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{formatFileSize(upload.file.size)}</span>
                              {upload.duration && (
                                <>
                                  <span className="text-muted-foreground/50">·</span>
                                  <span>{formatDuration(upload.duration)}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => removeUpload(upload.id)}
                            disabled={isUploading}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}

            {/* Completed Section */}
            {completedUploads.length > 0 && (
              <div className="border border-green-500/20 rounded-lg overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center justify-between p-3 bg-green-500/5 hover:bg-green-500/10 transition-colors"
                  onClick={() => setExpandedSection(expandedSection === 'completed' ? null : 'completed')}
                >
                  <span className="text-sm font-medium flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    Completed ({completedUploads.length})
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
                      {completedUploads.map((upload) => (
                        <div key={upload.id} className="flex items-center gap-3 p-3">
                          <div className="relative shrink-0">
                            <VideoThumbnail upload={upload} />
                            <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-0.5">
                              <CheckCircle className="h-3 w-3 text-white" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{upload.title}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{formatFileSize(upload.file.size)}</span>
                              {upload.duration && (
                                <>
                                  <span className="text-muted-foreground/50">·</span>
                                  <span>{formatDuration(upload.duration)}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <Badge variant="secondary" className="bg-green-500/10 text-green-600 dark:text-green-400 text-xs">
                            Uploaded
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}

            {/* Failed Section */}
            {failedUploads.length > 0 && (
              <div className="border border-destructive/20 rounded-lg overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center justify-between p-3 bg-destructive/5 hover:bg-destructive/10 transition-colors"
                  onClick={() => setExpandedSection(expandedSection === 'failed' ? null : 'failed')}
                >
                  <span className="text-sm font-medium flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    Failed ({failedUploads.length})
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
                      disabled={isUploading}
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
                      {failedUploads.map((upload) => (
                        <div key={upload.id} className="flex items-center gap-3 p-3">
                          <div className="relative shrink-0 opacity-60">
                            <VideoThumbnail upload={upload} />
                            <div className="absolute -bottom-1 -right-1 bg-destructive rounded-full p-0.5">
                              <AlertCircle className="h-3 w-3 text-white" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{upload.title}</p>
                            <p className="text-xs text-destructive">{upload.error || 'Upload failed'}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => removeUpload(upload.id)}
                            disabled={isUploading}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          {pendingUploads.length > 0 && (
            <Button onClick={startUploads} disabled={isUploading} className="flex-1" size="lg">
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload {pendingUploads.length} Video{pendingUploads.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          )}

          {onCancel && (
            <Button variant="outline" onClick={onCancel} disabled={isUploading} size="lg">
              {uploads.length === 0 ? 'Cancel' : 'Done'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
