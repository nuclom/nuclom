"use client";

import * as React from "react";
import {
  Clock,
  Upload,
  Loader2,
  FileVideo,
  Image,
  Mic,
  Sparkles,
  Check,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProcessingStatus as ProcessingStatusType } from "@/lib/db/schema";

// =============================================================================
// Types
// =============================================================================

interface ProcessingStatusProps {
  status: ProcessingStatusType;
  progress?: number;
  error?: string | null;
  showProgress?: boolean;
  showDetails?: boolean;
  onRetry?: () => void;
  className?: string;
}

interface StatusConfig {
  icon: React.ElementType;
  text: string;
  color: string;
  bgColor: string;
  animate?: boolean;
  description?: string;
}

// =============================================================================
// Status Configuration
// =============================================================================

const statusConfig: Record<ProcessingStatusType, StatusConfig> = {
  pending: {
    icon: Clock,
    text: "Queued",
    color: "text-yellow-600",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
    description: "Video is queued for processing",
  },
  uploading: {
    icon: Upload,
    text: "Uploading",
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    animate: true,
    description: "Uploading video file...",
  },
  processing: {
    icon: Loader2,
    text: "Processing",
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    animate: true,
    description: "Processing video...",
  },
  extracting_metadata: {
    icon: FileVideo,
    text: "Analyzing",
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    animate: true,
    description: "Extracting video metadata...",
  },
  generating_thumbnails: {
    icon: Image,
    text: "Thumbnails",
    color: "text-purple-600",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    animate: true,
    description: "Generating thumbnails...",
  },
  transcribing: {
    icon: Mic,
    text: "Transcribing",
    color: "text-indigo-600",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
    animate: true,
    description: "Transcribing audio...",
  },
  analyzing: {
    icon: Sparkles,
    text: "AI Analysis",
    color: "text-violet-600",
    bgColor: "bg-violet-100 dark:bg-violet-900/30",
    animate: true,
    description: "Generating AI summary...",
  },
  completed: {
    icon: Check,
    text: "Ready",
    color: "text-green-600",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    description: "Video is ready to watch",
  },
  failed: {
    icon: AlertCircle,
    text: "Failed",
    color: "text-red-600",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    description: "Processing failed",
  },
};

// =============================================================================
// Component
// =============================================================================

export function ProcessingStatus({
  status,
  progress = 0,
  error,
  showProgress = false,
  showDetails = false,
  onRetry,
  className,
}: ProcessingStatusProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Status Badge */}
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className={cn(
            "flex items-center gap-1.5 border-0",
            config.bgColor,
            config.color,
          )}
        >
          <Icon
            className={cn(
              "h-3.5 w-3.5",
              config.animate && "animate-spin",
            )}
          />
          <span className="text-xs font-medium">{config.text}</span>
        </Badge>

        {/* Retry Button for Failed Status */}
        {status === "failed" && onRetry && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRetry}
            className="h-6 px-2 text-xs"
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            Retry
          </Button>
        )}
      </div>

      {/* Progress Bar */}
      {showProgress && status !== "completed" && status !== "failed" && (
        <div className="flex items-center gap-2">
          <Progress value={progress} className="h-1.5 flex-1" />
          <span className="text-xs text-muted-foreground w-8 text-right">
            {progress}%
          </span>
        </div>
      )}

      {/* Details */}
      {showDetails && (
        <p className="text-xs text-muted-foreground">
          {error || config.description}
        </p>
      )}

      {/* Error Message */}
      {status === "failed" && error && (
        <p className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

// =============================================================================
// Compact Variant
// =============================================================================

interface ProcessingStatusBadgeProps {
  status: ProcessingStatusType;
  className?: string;
}

export function ProcessingStatusBadge({
  status,
  className,
}: ProcessingStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "flex items-center gap-1 border-0 px-2 py-0.5",
        config.bgColor,
        config.color,
        className,
      )}
    >
      <Icon
        className={cn(
          "h-3 w-3",
          config.animate && "animate-spin",
        )}
      />
      <span className="text-[10px] font-medium">{config.text}</span>
    </Badge>
  );
}

// =============================================================================
// Processing Steps Indicator
// =============================================================================

interface ProcessingStepsProps {
  currentStatus: ProcessingStatusType;
  className?: string;
}

const processingOrder: ProcessingStatusType[] = [
  "pending",
  "uploading",
  "processing",
  "extracting_metadata",
  "generating_thumbnails",
  "transcribing",
  "analyzing",
  "completed",
];

export function ProcessingSteps({
  currentStatus,
  className,
}: ProcessingStepsProps) {
  const currentIndex = processingOrder.indexOf(currentStatus);
  const isFailed = currentStatus === "failed";

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {processingOrder.slice(0, -1).map((step, index) => {
        const isCompleted = !isFailed && index < currentIndex;
        const isCurrent = !isFailed && index === currentIndex;
        const config = statusConfig[step];

        return (
          <React.Fragment key={step}>
            <div
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-colors",
                isCompleted && "bg-green-500",
                isCurrent && "bg-blue-500 animate-pulse",
                !isCompleted && !isCurrent && "bg-gray-200 dark:bg-gray-700",
                isFailed && index === currentIndex && "bg-red-500",
              )}
              title={config.text}
            />
            {index < processingOrder.length - 2 && (
              <div
                className={cn(
                  "h-0.5 w-3 transition-colors",
                  isCompleted && "bg-green-500",
                  !isCompleted && "bg-gray-200 dark:bg-gray-700",
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// =============================================================================
// Hook for Polling Processing Status
// =============================================================================

interface UseProcessingStatusOptions {
  videoId: string;
  enabled?: boolean;
  interval?: number;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

interface ProcessingStatusData {
  processingStatus: ProcessingStatusType;
  processingProgress: number;
  processingError?: string | null;
  thumbnailUrl?: string | null;
  duration?: string;
}

export function useProcessingStatus({
  videoId,
  enabled = true,
  interval = 3000,
  onComplete,
  onError,
}: UseProcessingStatusOptions) {
  const [data, setData] = React.useState<ProcessingStatusData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!enabled || !videoId) {
      return;
    }

    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/videos/${videoId}/processing-status`);
        if (!response.ok) {
          throw new Error("Failed to fetch processing status");
        }

        const result = await response.json();
        if (!isMounted) return;

        if (result.success && result.data) {
          setData(result.data);
          setError(null);

          if (result.data.processingStatus === "completed") {
            onComplete?.();
          } else if (result.data.processingStatus === "failed") {
            onError?.(result.data.processingError || "Processing failed");
          } else {
            // Continue polling if not completed
            timeoutId = setTimeout(fetchStatus, interval);
          }
        }
      } catch (err) {
        if (!isMounted) return;
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        // Retry on error
        timeoutId = setTimeout(fetchStatus, interval * 2);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchStatus();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [videoId, enabled, interval, onComplete, onError]);

  return { data, loading, error };
}
