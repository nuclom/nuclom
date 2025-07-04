"use client";

import { useEffect, useState } from "react";
import { ApiError, videoApi, workspaceApi } from "@/lib/api";
import type {
  PaginatedResponse,
  VideoWithAuthor,
  VideoWithDetails,
} from "@/lib/types";

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

// Custom hook for fetching videos
export function useVideos(
  params: {
    workspaceId?: string;
    channelId?: string;
    seriesId?: string;
    page?: number;
    limit?: number;
  } = {},
) {
  const [state, setState] = useState<
    UseApiState<PaginatedResponse<VideoWithAuthor>>
  >({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    const fetchVideos = async () => {
      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        const data = await videoApi.getVideos(params);

        if (isMounted) {
          setState({ data, loading: false, error: null });
        }
      } catch (error) {
        if (isMounted) {
          const errorMessage =
            error instanceof ApiError
              ? `Failed to fetch videos (${error.status})`
              : error instanceof Error
                ? error.message
                : "An unknown error occurred";

          setState({ data: null, loading: false, error: errorMessage });
        }
      }
    };

    fetchVideos();

    return () => {
      isMounted = false;
    };
  }, [JSON.stringify(params)]);

  return state;
}

// Custom hook for fetching a single video
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
      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        const data = await videoApi.getVideo(id);

        if (isMounted) {
          setState({ data, loading: false, error: null });
        }
      } catch (error) {
        if (isMounted) {
          const errorMessage =
            error instanceof ApiError
              ? `Failed to fetch video (${error.status})`
              : error instanceof Error
                ? error.message
                : "An unknown error occurred";

          setState({ data: null, loading: false, error: errorMessage });
        }
      }
    };

    fetchVideo();

    return () => {
      isMounted = false;
    };
  }, [id]);

  return state;
}

// Custom hook for fetching workspaces
export function useWorkspaces(userId?: string) {
  const [state, setState] = useState<UseApiState<any>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    const fetchWorkspaces = async () => {
      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        const data = await workspaceApi.getWorkspaces(userId);

        if (isMounted) {
          setState({ data, loading: false, error: null });
        }
      } catch (error) {
        if (isMounted) {
          const errorMessage =
            error instanceof ApiError
              ? `Failed to fetch workspaces (${error.status})`
              : error instanceof Error
                ? error.message
                : "An unknown error occurred";

          setState({ data: null, loading: false, error: errorMessage });
        }
      }
    };

    fetchWorkspaces();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  return state;
}
