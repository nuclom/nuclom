"use client";

import { AlertCircle, CheckCircle, Upload, Video, X } from "lucide-react";
import { type ChangeEvent, type FormEvent, useCallback, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface VideoUploadProps {
  organizationId: string;
  authorId: string;
  channelId?: string;
  seriesId?: string;
  onUploadComplete?: (result: { videoId: string; videoUrl: string; thumbnailUrl: string; duration: string }) => void;
  onCancel?: () => void;
}

interface UploadState {
  status: "idle" | "uploading" | "processing" | "success" | "error";
  progress: number;
  message: string;
  error?: string;
}

export function VideoUpload({
  organizationId,
  authorId,
  channelId,
  seriesId,
  onUploadComplete,
  onCancel,
}: VideoUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uploadState, setUploadState] = useState<UploadState>({
    status: "idle",
    progress: 0,
    message: "",
  });
  const [dragActive, setDragActive] = useState(false);

  const handleFileSelect = useCallback(
    (selectedFile: File) => {
      // Validate file type
      const supportedFormats = ["mp4", "mov", "avi", "mkv", "webm", "flv", "wmv"];
      const extension = selectedFile.name.toLowerCase().split(".").pop();

      if (!extension || !supportedFormats.includes(extension)) {
        setUploadState({
          status: "error",
          progress: 0,
          message: "",
          error: "Unsupported file format. Please select a video file (MP4, MOV, AVI, MKV, WebM, FLV, WMV).",
        });
        return;
      }

      // Validate file size (500MB)
      const maxSize = 500 * 1024 * 1024;
      if (selectedFile.size > maxSize) {
        setUploadState({
          status: "error",
          progress: 0,
          message: "",
          error: "File size too large. Maximum file size is 500MB.",
        });
        return;
      }

      setFile(selectedFile);
      setUploadState({
        status: "idle",
        progress: 0,
        message: "",
      });

      // Auto-generate title from filename if not set
      if (!title) {
        const nameWithoutExtension = selectedFile.name.replace(/\.[^/.]+$/, "");
        setTitle(nameWithoutExtension);
      }
    },
    [title],
  );

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
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

      const droppedFile = e.dataTransfer.files?.[0];
      if (droppedFile) {
        handleFileSelect(droppedFile);
      }
    },
    [handleFileSelect],
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!file || !title || uploadState.status === "uploading") {
      return;
    }

    const formData = new FormData();
    formData.append("video", file);
    formData.append("title", title);
    formData.append("description", description);
    formData.append("organizationId", organizationId);
    formData.append("authorId", authorId);
    if (channelId) formData.append("channelId", channelId);
    if (seriesId) formData.append("seriesId", seriesId);

    setUploadState({
      status: "uploading",
      progress: 10,
      message: "Starting upload...",
    });

    try {
      const response = await fetch("/api/videos/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      // Simulate processing progress
      setUploadState({
        status: "processing",
        progress: 75,
        message: "Processing video...",
      });

      const result = await response.json();

      if (result.success) {
        setUploadState({
          status: "success",
          progress: 100,
          message: "Upload complete!",
        });

        onUploadComplete?.(result.data);
      } else {
        throw new Error(result.error || "Upload failed");
      }
    } catch (error) {
      console.error("Upload error:", error);
      setUploadState({
        status: "error",
        progress: 0,
        message: "",
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      });
    }
  };

  const getProgressMessage = () => {
    switch (uploadState.status) {
      case "uploading":
        return `Uploading... ${uploadState.progress}%`;
      case "processing":
        return "Processing video and generating thumbnail...";
      case "success":
        return "Video uploaded successfully!";
      default:
        return uploadState.message;
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5" />
          Upload Video
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* File Upload Area */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: Drag and drop zone requires event handlers */}
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
            dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25",
            uploadState.status === "uploading" || uploadState.status === "processing" ? "opacity-50" : "",
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          {file ? (
            <div className="space-y-2">
              <Video className="h-12 w-12 mx-auto text-primary" />
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFile(null)}
                disabled={uploadState.status === "uploading" || uploadState.status === "processing"}
              >
                <X className="h-4 w-4 mr-1" />
                Remove
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <p className="text-lg font-medium">Drop your video here</p>
                <p className="text-sm text-muted-foreground">or click to select a file</p>
              </div>
              <Input
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="hidden"
                id="video-upload"
                disabled={uploadState.status === "uploading" || uploadState.status === "processing"}
              />
              <Label htmlFor="video-upload" className="cursor-pointer">
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploadState.status === "uploading" || uploadState.status === "processing"}
                >
                  Select Video File
                </Button>
              </Label>
              <p className="text-xs text-muted-foreground">
                Supported formats: MP4, MOV, AVI, MKV, WebM, FLV, WMV (max 500MB)
              </p>
            </div>
          )}
        </div>

        {/* Video Details Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter video title"
              required
              disabled={uploadState.status === "uploading" || uploadState.status === "processing"}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter video description"
              rows={3}
              disabled={uploadState.status === "uploading" || uploadState.status === "processing"}
            />
          </div>

          {/* Progress Indicator */}
          {(uploadState.status === "uploading" || uploadState.status === "processing") && (
            <div className="space-y-2">
              <Progress value={uploadState.progress} className="w-full" />
              <p className="text-sm text-muted-foreground text-center">{getProgressMessage()}</p>
            </div>
          )}

          {/* Error Message */}
          {uploadState.status === "error" && uploadState.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{uploadState.error}</AlertDescription>
            </Alert>
          )}

          {/* Success Message */}
          {uploadState.status === "success" && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>Video uploaded successfully!</AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              type="submit"
              disabled={!file || !title || uploadState.status === "uploading" || uploadState.status === "processing"}
              className="flex-1"
            >
              {uploadState.status === "uploading" || uploadState.status === "processing"
                ? "Uploading..."
                : "Upload Video"}
            </Button>
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={uploadState.status === "uploading" || uploadState.status === "processing"}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
