'use client';

/**
 * Code Links Hook
 *
 * React hook for managing GitHub code links for videos.
 */

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { CodeLinkType } from '@/lib/db/schema';

// =============================================================================
// Types
// =============================================================================

export interface CodeLink {
  id: string;
  videoId: string;
  linkType: CodeLinkType;
  githubRepo: string;
  githubRef: string;
  githubUrl: string | null;
  context: string | null;
  autoDetected: boolean;
  timestampStart: number | null;
  timestampEnd: number | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  video: {
    id: string;
    title: string;
    thumbnailUrl: string | null;
    duration: string;
    organizationId: string;
  };
  createdBy: {
    id: string;
    name: string;
    image: string | null;
  } | null;
}

interface UseCodeLinksState {
  codeLinks: CodeLink[];
  loading: boolean;
  error: string | null;
}

export interface CreateCodeLinkInput {
  type: CodeLinkType;
  repo: string;
  ref: string;
  context?: string;
  timestamp?: number;
  timestampEnd?: number;
}

// =============================================================================
// useCodeLinks Hook
// =============================================================================

export function useCodeLinks(videoId: string) {
  const { toast } = useToast();
  const [state, setState] = useState<UseCodeLinksState>({
    codeLinks: [],
    loading: true,
    error: null,
  });

  const fetchCodeLinks = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const response = await fetch(`/api/videos/${videoId}/code-links`);

      if (!response.ok) {
        throw new Error(`Failed to fetch code links (${response.status})`);
      }

      const data = await response.json();

      setState({
        codeLinks: data.data.codeLinks,
        loading: false,
        error: null,
      });
    } catch (error) {
      setState({
        codeLinks: [],
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch code links',
      });
    }
  }, [videoId]);

  useEffect(() => {
    fetchCodeLinks();
  }, [fetchCodeLinks]);

  const addCodeLink = useCallback(
    async (input: CreateCodeLinkInput) => {
      try {
        const response = await fetch(`/api/videos/${videoId}/code-links`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to add code link');
        }

        const result = await response.json();

        toast({
          title: 'Code link added',
          description: 'GitHub link has been added to this video.',
        });

        // Refresh the list
        await fetchCodeLinks();

        return result.data;
      } catch (error) {
        toast({
          title: 'Failed to add code link',
          description: error instanceof Error ? error.message : 'An error occurred',
          variant: 'destructive',
        });
        throw error;
      }
    },
    [videoId, toast, fetchCodeLinks],
  );

  const deleteCodeLink = useCallback(
    async (linkId: string) => {
      try {
        const response = await fetch(`/api/videos/${videoId}/code-links?linkId=${linkId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to delete code link');
        }

        toast({
          title: 'Code link removed',
          description: 'GitHub link has been removed from this video.',
        });

        // Refresh the list
        await fetchCodeLinks();
      } catch (error) {
        toast({
          title: 'Failed to remove code link',
          description: error instanceof Error ? error.message : 'An error occurred',
          variant: 'destructive',
        });
        throw error;
      }
    },
    [videoId, toast, fetchCodeLinks],
  );

  return {
    ...state,
    addCodeLink,
    deleteCodeLink,
    refetch: fetchCodeLinks,
  };
}
