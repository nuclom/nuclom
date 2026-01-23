'use client';

import { logger } from '@nuclom/lib/client-logger';
import { cn } from '@nuclom/lib/utils';
import { AlertCircle, CheckCircle, Loader2, Upload, Video, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type ChangeEvent, type FormEvent, useCallback, useRef, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';

type UploadStep = 'select' | 'details' | 'uploading' | 'processing' | 'complete';

const UPLOAD_STEPS: { key: UploadStep; label: string }[] = [
  { key: 'select', label: 'Select File' },
  { key: 'details', label: 'Add Details' },
  { key: 'uploading', label: 'Uploading' },
  { key: 'processing', label: 'Processing' },
  { key: 'complete', label: 'Complete' },
];

function UploadStepIndicator({ currentStep, hasFile }: { currentStep: UploadStep; hasFile: boolean }) {
  const getStepStatus = (step: UploadStep) => {
    const stepIndex = UPLOAD_STEPS.findIndex((s) => s.key === step);
    const currentIndex = UPLOAD_STEPS.findIndex((s) => s.key === currentStep);

    // Special handling for file selection state
    if (currentStep === 'select' && step === 'select') return 'current';
    if (currentStep === 'select' && step === 'details' && hasFile) return 'current';

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'upcoming';
  };

  return (
    <div className="flex items-center justify-between mb-6">
      {UPLOAD_STEPS.map((step, index) => {
        const status = getStepStatus(step.key);
        return (
          <div key={step.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all',
                  status === 'completed' && 'bg-primary border-primary',
                  status === 'current' && 'border-primary bg-primary/10',
                  status === 'upcoming' && 'border-muted-foreground/30 bg-background',
                )}
              >
                {status === 'completed' ? (
                  <CheckCircle className="h-4 w-4 text-primary-foreground" />
                ) : status === 'current' && step.key === 'uploading' ? (
                  <Loader2 className="h-4 w-4 text-primary animate-spin" />
                ) : status === 'current' && step.key === 'processing' ? (
                  <Loader2 className="h-4 w-4 text-primary animate-spin" />
                ) : (
                  <span
                    className={cn(
                      'text-xs font-medium',
                      status === 'current' && 'text-primary',
                      status === 'upcoming' && 'text-muted-foreground/50',
                    )}
                  >
                    {index + 1}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  'text-xs mt-1 whitespace-nowrap',
                  status === 'completed' && 'text-primary font-medium',
                  status === 'current' && 'text-primary font-medium',
                  status === 'upcoming' && 'text-muted-foreground/50',
                )}
              >
                {step.label}
              </span>
            </div>
            {index < UPLOAD_STEPS.length - 1 && (
              <div
                className={cn(
                  'flex-1 h-0.5 mx-2 mt-[-16px]',
                  getStepStatus(UPLOAD_STEPS[index + 1].key) === 'completed' ||
                    getStepStatus(UPLOAD_STEPS[index + 1].key) === 'current'
                    ? 'bg-primary'
                    : 'bg-muted-foreground/20',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface VideoUploadProps {
  organizationId: string;
  authorId: string;
  collectionId?: string;
  /** When provided, redirects to `${redirectPath}/${videoId}` after successful upload */
  redirectPath?: string;
  onUploadComplete?: (result: { videoId: string; videoUrl: string; thumbnailUrl: string; duration: string }) => void;
  onCancel?: () => void;
}

interface UploadState {
  status: 'idle' | 'uploading' | 'processing' | 'success' | 'error';
  progress: number;
  message: string;
  error?: string;
}

export function VideoUpload({
  organizationId,
  authorId,
  collectionId,
  redirectPath,
  onUploadComplete,
  onCancel,
}: VideoUploadProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
    message: '',
  });
  const [dragActive, setDragActive] = useState(false);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  // Determine current step for the indicator
  const getCurrentStep = (): UploadStep => {
    if (uploadState.status === 'success') return 'complete';
    if (uploadState.status === 'processing') return 'processing';
    if (uploadState.status === 'uploading') return 'uploading';
    if (file && title) return 'details';
    return 'select';
  };

  const handleCancelUpload = useCallback(() => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    setUploadState({
      status: 'idle',
      progress: 0,
      message: '',
    });
  }, []);

  const handleFileSelect = useCallback(
    (selectedFile: File) => {
      // Validate file type
      const supportedFormats = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv'];
      const extension = selectedFile.name.toLowerCase().split('.').pop();

      if (!extension || !supportedFormats.includes(extension)) {
        setUploadState({
          status: 'error',
          progress: 0,
          message: '',
          error: 'Unsupported file format. Please select a video file (MP4, MOV, AVI, MKV, WebM, FLV, WMV).',
        });
        return;
      }

      // Validate file size (5GB - matches backend limit)
      const maxSize = 5 * 1024 * 1024 * 1024;
      if (selectedFile.size > maxSize) {
        setUploadState({
          status: 'error',
          progress: 0,
          message: '',
          error: 'File size too large. Maximum file size is 5GB.',
        });
        return;
      }

      setFile(selectedFile);
      setUploadState({
        status: 'idle',
        progress: 0,
        message: '',
      });

      // Auto-generate title from filename if not set
      if (!title) {
        const nameWithoutExtension = selectedFile.name.replace(/\.[^/.]+$/, '');
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

      const droppedFile = e.dataTransfer.files?.[0];
      if (droppedFile) {
        handleFileSelect(droppedFile);
      }
    },
    [handleFileSelect],
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!file || !title || uploadState.status === 'uploading') {
      return;
    }

    setUploadState({
      status: 'uploading',
      progress: 5,
      message: 'Preparing upload...',
    });

    try {
      // Step 1: Get presigned URL for direct upload to R2
      const presignedResponse = await fetch('/api/videos/upload/presigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || 'video/mp4',
          fileSize: file.size,
          organizationId,
        }),
      });

      if (!presignedResponse.ok) {
        const errorData = await presignedResponse.json();
        throw new Error(errorData.error?.message || errorData.error || 'Failed to prepare upload');
      }

      const presignedResult = await presignedResponse.json();
      if (!presignedResult.success) {
        throw new Error(presignedResult.error || 'Failed to get upload URL');
      }

      const { uploadId, uploadUrl, fileKey } = presignedResult.data;

      setUploadState({
        status: 'uploading',
        progress: 10,
        message: 'Uploading to storage...',
      });

      // Step 2: Upload directly to R2 using presigned URL with progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            // Map upload progress to 10-80% range
            const percentComplete = Math.round((event.loaded / event.total) * 70) + 10;
            setUploadState({
              status: 'uploading',
              progress: percentComplete,
              message: `Uploading... ${Math.round((event.loaded / event.total) * 100)}%`,
            });
          }
        });

        xhr.addEventListener('load', () => {
          xhrRef.current = null;
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          xhrRef.current = null;
          reject(new Error('Upload failed - network error'));
        });

        xhr.addEventListener('abort', () => {
          xhrRef.current = null;
          reject(new Error('Upload was cancelled'));
        });

        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
        xhr.send(file);
      });

      setUploadState({
        status: 'processing',
        progress: 85,
        message: 'Finalizing upload...',
      });

      // Step 3: Confirm upload and create video record
      const confirmResponse = await fetch('/api/videos/upload/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId,
          fileKey,
          filename: file.name,
          fileSize: file.size,
          title,
          description: description || undefined,
          organizationId,
          authorId,
          collectionId: collectionId || undefined,
          skipAIProcessing: false,
        }),
      });

      if (!confirmResponse.ok) {
        const errorData = await confirmResponse.json();
        throw new Error(errorData.error?.message || errorData.error || 'Failed to confirm upload');
      }

      const confirmResult = await confirmResponse.json();

      if (confirmResult.success) {
        setUploadState({
          status: 'success',
          progress: 100,
          message: 'Upload complete!',
        });

        onUploadComplete?.(confirmResult.data);

        if (redirectPath) {
          router.push(`${redirectPath}/${confirmResult.data.videoId}`);
        }
      } else {
        throw new Error(confirmResult.error || 'Upload confirmation failed');
      }
    } catch (error) {
      logger.error('Video upload failed', error);
      setUploadState({
        status: 'error',
        progress: 0,
        message: '',
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
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
        {/* Step Indicator */}
        <UploadStepIndicator currentStep={getCurrentStep()} hasFile={!!file} />

        {/* File Upload Area */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: Click handler delegates to file input which handles keyboard */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: Click handler delegates to file input which handles keyboard */}
        <div
          className={cn(
            'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
            dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50',
            uploadState.status === 'uploading' || uploadState.status === 'processing'
              ? 'opacity-50 cursor-not-allowed'
              : '',
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => {
            if (uploadState.status !== 'uploading' && uploadState.status !== 'processing' && !file) {
              document.getElementById('video-upload')?.click();
            }
          }}
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
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                }}
                disabled={uploadState.status === 'uploading' || uploadState.status === 'processing'}
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
              <input
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="hidden"
                id="video-upload"
                disabled={uploadState.status === 'uploading' || uploadState.status === 'processing'}
              />
              <Button
                type="button"
                variant="outline"
                disabled={uploadState.status === 'uploading' || uploadState.status === 'processing'}
                onClick={(e) => {
                  e.stopPropagation();
                  document.getElementById('video-upload')?.click();
                }}
              >
                Select Video File
              </Button>
              <p className="text-xs text-muted-foreground">
                Supported formats: MP4, MOV, AVI, MKV, WebM, FLV, WMV (max 5GB)
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
              disabled={uploadState.status === 'uploading' || uploadState.status === 'processing'}
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
              disabled={uploadState.status === 'uploading' || uploadState.status === 'processing'}
            />
          </div>

          {/* Progress Indicator */}
          {(uploadState.status === 'uploading' || uploadState.status === 'processing') && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    {uploadState.status === 'uploading' ? 'Uploading your video' : 'Processing video'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {uploadState.status === 'uploading'
                      ? 'Transferring file to secure storage...'
                      : 'Generating thumbnail and extracting metadata...'}
                  </p>
                </div>
              </div>
              <Progress value={uploadState.progress} className="w-full h-2" />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{uploadState.progress}% complete</p>
                {uploadState.status === 'uploading' && (
                  <Button type="button" variant="ghost" size="sm" onClick={handleCancelUpload} className="h-7 text-xs">
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Error Message */}
          {uploadState.status === 'error' && uploadState.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{uploadState.error}</AlertDescription>
            </Alert>
          )}

          {/* Success Message */}
          {uploadState.status === 'success' && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>Video uploaded successfully!</AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              type="submit"
              disabled={!file || !title || uploadState.status === 'uploading' || uploadState.status === 'processing'}
              className="flex-1"
            >
              {uploadState.status === 'uploading' || uploadState.status === 'processing'
                ? 'Uploading...'
                : 'Upload Video'}
            </Button>
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={uploadState.status === 'uploading' || uploadState.status === 'processing'}
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
