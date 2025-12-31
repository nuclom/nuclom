"use client";

/**
 * Transcript Hook
 *
 * Custom hook for managing video transcript state and operations.
 * Handles fetching, saving, and editing transcripts.
 */

import { useCallback, useEffect, useState } from "react";
import type { TranscriptSegment } from "@/lib/db/schema";

// =============================================================================
// Types
// =============================================================================

export interface TranscriptData {
  videoId: string;
  title: string;
  transcript: string | null;
  segments: TranscriptSegment[];
  processingStatus: "pending" | "transcribing" | "analyzing" | "completed" | "failed";
}

export interface UseTranscriptOptions {
  /** Video ID */
  videoId: string;
  /** Initial segments (if already loaded) */
  initialSegments?: TranscriptSegment[];
  /** Whether to auto-fetch transcript data */
  autoFetch?: boolean;
}

export interface UseTranscriptReturn {
  /** Current transcript segments */
  segments: TranscriptSegment[];
  /** Processing status */
  processingStatus: "pending" | "transcribing" | "analyzing" | "completed" | "failed" | null;
  /** Whether data is loading */
  isLoading: boolean;
  /** Whether data is being saved */
  isSaving: boolean;
  /** Any error that occurred */
  error: string | null;
  /** Refetch transcript data */
  refetch: () => Promise<void>;
  /** Save updated segments */
  saveSegments: (segments: TranscriptSegment[]) => Promise<boolean>;
  /** Update a single segment */
  updateSegment: (index: number, segment: TranscriptSegment) => void;
  /** Delete a segment */
  deleteSegment: (index: number) => void;
  /** Has unsaved changes */
  hasUnsavedChanges: boolean;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useTranscript({
  videoId,
  initialSegments,
  autoFetch = true,
}: UseTranscriptOptions): UseTranscriptReturn {
  const [segments, setSegments] = useState<TranscriptSegment[]>(initialSegments || []);
  const [originalSegments, setOriginalSegments] = useState<TranscriptSegment[]>(initialSegments || []);
  const [processingStatus, setProcessingStatus] = useState<TranscriptData["processingStatus"] | null>(null);
  const [isLoading, setIsLoading] = useState(!initialSegments);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for unsaved changes
  const hasUnsavedChanges = JSON.stringify(segments) !== JSON.stringify(originalSegments);

  // Fetch transcript data
  const fetchTranscript = useCallback(async () => {
    if (!videoId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/videos/${videoId}/transcript`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch transcript");
      }

      if (data.success && data.data) {
        setSegments(data.data.segments || []);
        setOriginalSegments(data.data.segments || []);
        setProcessingStatus(data.data.processingStatus);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch transcript");
    } finally {
      setIsLoading(false);
    }
  }, [videoId]);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch && !initialSegments) {
      fetchTranscript();
    }
  }, [autoFetch, initialSegments, fetchTranscript]);

  // Update segments when initialSegments changes
  useEffect(() => {
    if (initialSegments) {
      setSegments(initialSegments);
      setOriginalSegments(initialSegments);
    }
  }, [initialSegments]);

  // Save segments to API
  const saveSegments = useCallback(
    async (newSegments: TranscriptSegment[]): Promise<boolean> => {
      if (!videoId) return false;

      setIsSaving(true);
      setError(null);

      try {
        const response = await fetch(`/api/videos/${videoId}/transcript`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ segments: newSegments }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to save transcript");
        }

        // Update local state
        setSegments(newSegments);
        setOriginalSegments(newSegments);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save transcript");
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [videoId],
  );

  // Update a single segment
  const updateSegment = useCallback((index: number, segment: TranscriptSegment) => {
    setSegments((prev) => {
      const newSegments = [...prev];
      newSegments[index] = segment;
      return newSegments;
    });
  }, []);

  // Delete a segment
  const deleteSegment = useCallback((index: number) => {
    setSegments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return {
    segments,
    processingStatus,
    isLoading,
    isSaving,
    error,
    refetch: fetchTranscript,
    saveSegments,
    updateSegment,
    deleteSegment,
    hasUnsavedChanges,
  };
}

// =============================================================================
// Export Types
// =============================================================================

export type { TranscriptSegment };
