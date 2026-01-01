"use client";

import { AlertCircle, CheckCircle, ChevronDown, ChevronUp, FileVideo, Loader2, Trash2, Upload } from "lucide-react";
import { type ChangeEvent, useCallback, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { formatFileSize } from "@/lib/format-utils";
import { cn } from "@/lib/utils";

interface BulkVideoUploadProps {
  organizationId: string;
  authorId: string;
  channelId?: string;
  collectionId?: string;
  onUploadComplete?: (results: Array<{ videoId: string; title: string }>) => void;
  onCancel?: () => void;
}

interface FileUpload {
  id: string;
  file: File;
  title: string;
  status: "pending" | "preparing" | "uploading" | "confirming" | "completed" | "failed" | "paused";
  progress: number;
  error?: string;
  uploadUrl?: string;
  fileKey?: string;
  videoId?: string;
  abortController?: AbortController;
}

// Supported video MIME types
const SUPPORTED_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
  "video/webm",
  "video/x-flv",
  "video/x-ms-wmv",
  "video/3gpp",
  "video/mpeg",
  "video/ogg",
];

// Max file size: 5GB
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024;

// Max files at once
const MAX_FILES = 20;

// Concurrent uploads
const CONCURRENT_UPLOADS = 3;

export function BulkVideoUpload({
  organizationId,
  authorId,
  channelId,
  collectionId,
  onUploadComplete,
  onCancel,
}: BulkVideoUploadProps) {
  const { toast } = useToast();
  const [uploads, setUploads] = useState<FileUpload[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showCompleted, setShowCompleted] = useState(true);

  const pendingUploads = uploads.filter((u) => u.status === "pending");
  const activeUploads = uploads.filter((u) => ["preparing", "uploading", "confirming"].includes(u.status));
  const completedUploads = uploads.filter((u) => u.status === "completed");
  const failedUploads = uploads.filter((u) => u.status === "failed");

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const validFiles: FileUpload[] = [];
      const errors: string[] = [];

      // Check total count
      if (uploads.length + fileArray.length > MAX_FILES) {
        toast({
          title: "Too many files",
          description: `Maximum ${MAX_FILES} files can be uploaded at once. You have ${uploads.length} files already.`,
          variant: "destructive",
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
          title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
          status: "pending",
          progress: 0,
        });
      }

      if (errors.length > 0) {
        toast({
          title: "Some files were skipped",
          description: errors.slice(0, 3).join(", ") + (errors.length > 3 ? ` and ${errors.length - 3} more` : ""),
          variant: "destructive",
        });
      }

      if (validFiles.length > 0) {
        setUploads((prev) => [...prev, ...validFiles]);
      }
    },
    [uploads, toast],
  );

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files);
    }
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
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
        prev.map((u) => (u.id === upload.id ? { ...u, status: "preparing" as const, abortController } : u)),
      );

      // Step 1: Get presigned URL
      const presignedResponse = await fetch("/api/videos/upload/presigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        throw new Error(presignedData.error || "Failed to get upload URL");
      }

      const { uploadUrl, fileKey, uploadId } = presignedData.data;

      // Update status to uploading
      setUploads((prev) =>
        prev.map((u) =>
          u.id === upload.id ? { ...u, status: "uploading" as const, uploadUrl, fileKey, progress: 0 } : u,
        ),
      );

      // Step 2: Upload directly to R2 using presigned URL
      const xhr = new XMLHttpRequest();

      await new Promise<void>((resolve, reject) => {
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            setUploads((prev) => prev.map((u) => (u.id === upload.id ? { ...u, progress } : u)));
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener("error", () => reject(new Error("Upload failed")));
        xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

        // Handle abort signal
        abortController.signal.addEventListener("abort", () => xhr.abort());

        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", upload.file.type);
        xhr.send(upload.file);
      });

      // Update status to confirming
      setUploads((prev) =>
        prev.map((u) => (u.id === upload.id ? { ...u, status: "confirming" as const, progress: 100 } : u)),
      );

      // Step 3: Confirm upload and create video record
      const confirmResponse = await fetch("/api/videos/upload/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadId,
          fileKey,
          filename: upload.file.name,
          fileSize: upload.file.size,
          title: upload.title,
          organizationId,
          authorId,
          channelId,
          collectionId,
        }),
        signal: abortController.signal,
      });

      const confirmData = await confirmResponse.json();

      if (!confirmData.success) {
        throw new Error(confirmData.error || "Failed to confirm upload");
      }

      // Update status to completed
      setUploads((prev) =>
        prev.map((u) =>
          u.id === upload.id ? { ...u, status: "completed" as const, videoId: confirmData.data.videoId } : u,
        ),
      );
    } catch (error) {
      if ((error as Error).name === "AbortError" || (error as Error).message === "Upload aborted") {
        setUploads((prev) =>
          prev.map((u) => (u.id === upload.id ? { ...u, status: "pending" as const, progress: 0 } : u)),
        );
      } else {
        setUploads((prev) =>
          prev.map((u) =>
            u.id === upload.id
              ? {
                  ...u,
                  status: "failed" as const,
                  error: error instanceof Error ? error.message : "Upload failed",
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
      (u): u is FileUpload & { videoId: string } => u.status === "completed" && u.videoId !== undefined,
    );
    if (completed.length > 0 && onUploadComplete) {
      onUploadComplete(completed.map((u) => ({ videoId: u.videoId, title: u.title })));
    }
  };

  const retryFailed = async () => {
    // Reset failed uploads to pending
    setUploads((prev) =>
      prev.map((u) =>
        u.status === "failed" ? { ...u, status: "pending" as const, error: undefined, progress: 0 } : u,
      ),
    );

    // Start uploads
    await startUploads();
  };

  const clearCompleted = () => {
    setUploads((prev) => prev.filter((u) => u.status !== "completed"));
  };

  const getStatusBadge = (status: FileUpload["status"]) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "preparing":
        return (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Preparing
          </Badge>
        );
      case "uploading":
        return (
          <Badge variant="default" className="gap-1 bg-blue-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            Uploading
          </Badge>
        );
      case "confirming":
        return (
          <Badge variant="default" className="gap-1 bg-purple-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            Processing
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="default" className="gap-1 bg-green-500">
            <CheckCircle className="h-3 w-3" />
            Complete
          </Badge>
        );
      case "failed":
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

  const totalSize = uploads.reduce((sum, u) => sum + u.file.size, 0);
  const uploadedSize = uploads.filter((u) => u.status === "completed").reduce((sum, u) => sum + u.file.size, 0);

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Bulk Video Upload
        </CardTitle>
        <CardDescription>
          Upload multiple videos at once. Files are uploaded directly to cloud storage for faster, more reliable uploads
          with no size limits.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Drop Zone */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: Drag and drop zone requires event handlers */}
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
            dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25",
            isUploading && "opacity-50 pointer-events-none",
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="space-y-4">
            <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <p className="text-lg font-medium">Drop your videos here</p>
              <p className="text-sm text-muted-foreground">or click to select files</p>
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
            <Label htmlFor="bulk-video-upload" className="cursor-pointer">
              <Button type="button" variant="outline" disabled={isUploading}>
                Select Video Files
              </Button>
            </Label>
            <p className="text-xs text-muted-foreground">
              MP4, MOV, AVI, MKV, WebM supported · Up to 5GB per file · Maximum {MAX_FILES} files
            </p>
          </div>
        </div>

        {/* Upload List */}
        {uploads.length > 0 && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {uploads.length} file{uploads.length !== 1 ? "s" : ""} · {formatFileSize(totalSize)}
              </span>
              <div className="flex items-center gap-4">
                {completedUploads.length > 0 && (
                  <span className="text-green-600">{completedUploads.length} completed</span>
                )}
                {failedUploads.length > 0 && <span className="text-red-600">{failedUploads.length} failed</span>}
              </div>
            </div>

            {/* Overall Progress */}
            {isUploading && (
              <div className="space-y-2">
                <Progress value={(uploadedSize / totalSize) * 100} className="h-2" />
                <p className="text-sm text-muted-foreground text-center">
                  Uploading {activeUploads.length} of {pendingUploads.length + activeUploads.length} files
                </p>
              </div>
            )}

            {/* File List */}
            <ScrollArea className="max-h-80">
              <div className="space-y-2">
                {uploads.map((upload) => (
                  <div
                    key={upload.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border",
                      upload.status === "failed" && "border-destructive/50 bg-destructive/5",
                      upload.status === "completed" && "border-green-500/50 bg-green-500/5",
                    )}
                  >
                    <FileVideo className="h-8 w-8 text-muted-foreground shrink-0" />

                    <div className="flex-1 min-w-0 space-y-1">
                      {upload.status === "pending" ? (
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
                        <span>{formatFileSize(upload.file.size)}</span>
                        {upload.status === "uploading" && (
                          <>
                            <span>·</span>
                            <span>{upload.progress}%</span>
                          </>
                        )}
                        {upload.error && (
                          <>
                            <span>·</span>
                            <span className="text-destructive">{upload.error}</span>
                          </>
                        )}
                      </div>

                      {upload.status === "uploading" && <Progress value={upload.progress} className="h-1" />}
                    </div>

                    <div className="flex items-center gap-2">
                      {getStatusBadge(upload.status)}

                      {(upload.status === "pending" || upload.status === "failed") && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeUpload(upload.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Completed Section Toggle */}
            {completedUploads.length > 0 && (
              <Button
                variant="ghost"
                className="w-full text-sm text-muted-foreground"
                onClick={() => setShowCompleted(!showCompleted)}
              >
                {showCompleted ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-2" />
                    Hide completed ({completedUploads.length})
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-2" />
                    Show completed ({completedUploads.length})
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {/* Error Alert */}
        {failedUploads.length > 0 && !isUploading && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>
                {failedUploads.length} upload{failedUploads.length !== 1 ? "s" : ""} failed
              </span>
              <Button variant="outline" size="sm" onClick={retryFailed}>
                Retry Failed
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Success Alert */}
        {completedUploads.length === uploads.length && uploads.length > 0 && !isUploading && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              All {completedUploads.length} video{completedUploads.length !== 1 ? "s" : ""} uploaded successfully!
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4">
          {pendingUploads.length > 0 && (
            <Button onClick={startUploads} disabled={isUploading} className="flex-1">
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload {pendingUploads.length} Video{pendingUploads.length !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          )}

          {completedUploads.length > 0 && !isUploading && (
            <Button variant="outline" onClick={clearCompleted}>
              Clear Completed
            </Button>
          )}

          {onCancel && (
            <Button variant="outline" onClick={onCancel} disabled={isUploading}>
              {uploads.length === 0 ? "Cancel" : "Close"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
