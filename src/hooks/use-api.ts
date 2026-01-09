'use client';

/**
 * API Hooks
 *
 * React hooks for fetching data from the API.
 * Uses Effect-TS internally for type-safe error handling.
 */

import type { Effect } from 'effect';
import { Either } from 'effect';
import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import { organizationApiEffect, runClientEffect, videoApiEffect } from '@/lib/effect/client';
import type { PaginatedResponse, VideoWithAuthor, VideoWithDetails } from '@/lib/types';

// =============================================================================
// Types
// =============================================================================

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isTaggedError(error: unknown): error is { _tag: string; message: string; status?: number } {
  return (
    isRecord(error) &&
    typeof error._tag === 'string' &&
    typeof error.message === 'string' &&
    (error.status === undefined || typeof error.status === 'number')
  );
}

function getErrorMessage(error: unknown): string {
  if (isTaggedError(error)) {
    if (error._tag === 'HttpError' && error.status) {
      return `Failed to fetch data (${error.status})`;
    }
    return error.message;
  }
  if (error instanceof ApiError) {
    return `Failed to fetch data (${error.status})`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unknown error occurred';
}

// =============================================================================
// Generic API Query Hook
// =============================================================================

function useApiQuery<T>(
  effectFn: () => Effect.Effect<T, unknown, never>,
  deps: readonly unknown[],
  options: { enabled?: boolean } = {},
): UseApiState<T> {
  const { enabled = true } = options;

  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: enabled,
    error: null,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: effectFn is intentionally excluded - we use explicit deps array
  useEffect(() => {
    if (!enabled) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    let isMounted = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    runClientEffect(effectFn()).then((result) => {
      if (!isMounted) return;
      Either.match(result, {
        onLeft: (error) => setState({ data: null, loading: false, error: getErrorMessage(error) }),
        onRight: (data) => setState({ data, loading: false, error: null }),
      });
    });

    return () => {
      isMounted = false;
    };
  }, [enabled, ...deps]);

  return state;
}

// =============================================================================
// useVideos Hook
// =============================================================================

export function useVideos(
  params: { organizationId?: string; channelId?: string; seriesId?: string; page?: number; limit?: number } = {},
): UseApiState<PaginatedResponse<VideoWithAuthor>> {
  const { organizationId, channelId, seriesId, page, limit } = params;
  return useApiQuery(
    () => videoApiEffect.getVideos({ organizationId, channelId, seriesId, page, limit }),
    [organizationId, channelId, seriesId, page, limit],
  );
}

// =============================================================================
// useVideo Hook
// =============================================================================

export function useVideo(id: string | null): UseApiState<VideoWithDetails> {
  // biome-ignore lint/style/noNonNullAssertion: id is guaranteed non-null when enabled is true
  return useApiQuery(() => videoApiEffect.getVideo(id!), [id], { enabled: id !== null });
}

// =============================================================================
// useOrganizations Hook
// =============================================================================

export function useOrganizations(userId?: string): UseApiState<unknown[]> {
  return useApiQuery(() => organizationApiEffect.getOrganizations(userId), [userId]);
}

// =============================================================================
// Re-export Effect-based hooks for more advanced usage
// =============================================================================

export { useEffectMutation, useEffectQuery, useErrorMessage } from './use-effect';
