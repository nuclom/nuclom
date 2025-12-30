"use client";

/**
 * API Hooks
 *
 * React hooks for fetching data from the API.
 * Uses Effect-TS internally for type-safe error handling.
 */

import { useEffect, useState, useCallback } from "react";
import { Either } from "effect";
import { ApiError, videoApi, organizationApi } from "@/lib/api";
import { videoApiEffect, organizationApiEffect, runClientEffect } from "@/lib/effect/client";
import type { PaginatedResponse, VideoWithAuthor, VideoWithDetails } from "@/lib/types";

// =============================================================================
// Types
// =============================================================================

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

// =============================================================================
// Helper: Effect Error to Message
// =============================================================================

const getErrorMessage = (error: unknown): string => {
  if (error && typeof error === "object" && "_tag" in error) {
    const taggedError = error as { _tag: string; message: string; status?: number };

    if (taggedError._tag === "HttpError" && taggedError.status) {
      return `Failed to fetch data (${taggedError.status})`;
    }

    return taggedError.message;
  }

  if (error instanceof ApiError) {
    return `Failed to fetch data (${error.status})`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unknown error occurred";
};

// =============================================================================
// useVideos Hook
// =============================================================================

export function useVideos(
  params: { organizationId?: string; channelId?: string; seriesId?: string; page?: number; limit?: number } = {},
) {
  const [state, setState] = useState<UseApiState<PaginatedResponse<VideoWithAuthor>>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    const fetchVideos = async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const result = await runClientEffect(videoApiEffect.getVideos(params));

      if (!isMounted) return;

      Either.match(result, {
        onLeft: (error) => {
          setState({
            data: null,
            loading: false,
            error: getErrorMessage(error),
          });
        },
        onRight: (data) => {
          setState({
            data,
            loading: false,
            error: null,
          });
        },
      });
    };

    fetchVideos();

    return () => {
      isMounted = false;
    };
  }, [JSON.stringify(params)]);

  return state;
}

// =============================================================================
// useVideo Hook
// =============================================================================

export function useVideo(id: string | null) {
  const [state, setState] = useState<UseApiState<VideoWithDetails>>({
    data: null,
    loading: !!id,
    error: null,
  });

  useEffect(() => {
    if (!id) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    let isMounted = true;

    const fetchVideo = async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const result = await runClientEffect(videoApiEffect.getVideo(id));

      if (!isMounted) return;

      Either.match(result, {
        onLeft: (error) => {
          setState({
            data: null,
            loading: false,
            error: getErrorMessage(error),
          });
        },
        onRight: (data) => {
          setState({
            data,
            loading: false,
            error: null,
          });
        },
      });
    };

    fetchVideo();

    return () => {
      isMounted = false;
    };
  }, [id]);

  return state;
}

// =============================================================================
// useOrganizations Hook
// =============================================================================

export function useOrganizations(userId?: string) {
  const [state, setState] = useState<UseApiState<unknown[]>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    const fetchOrganizations = async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const result = await runClientEffect(organizationApiEffect.getOrganizations(userId));

      if (!isMounted) return;

      Either.match(result, {
        onLeft: (error) => {
          setState({
            data: null,
            loading: false,
            error: getErrorMessage(error),
          });
        },
        onRight: (data) => {
          setState({
            data,
            loading: false,
            error: null,
          });
        },
      });
    };

    fetchOrganizations();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  return state;
}

// =============================================================================
// Re-export Effect-based hooks for more advanced usage
// =============================================================================

export { useEffectQuery, useEffectMutation, useErrorMessage } from "./use-effect";
