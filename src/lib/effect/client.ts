/**
 * Effect Client Utilities
 *
 * Client-side Effect utilities for use in React components.
 * These utilities are designed to work in browser environments.
 */

import { Effect, type Either, pipe } from "effect";
import { HttpError, ParseError } from "./errors";

// =============================================================================
// Types
// =============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface FetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

// =============================================================================
// Client-side Effect HTTP Client
// =============================================================================

const API_BASE_URL = "/api";

/**
 * Make an HTTP request using Effect
 */
export const fetchEffect = <T>(endpoint: string, options?: FetchOptions): Effect.Effect<T, HttpError | ParseError> =>
  Effect.gen(function* () {
    const url = `${API_BASE_URL}${endpoint}`;

    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(url, {
          headers: {
            "Content-Type": "application/json",
            ...options?.headers,
          },
          ...options,
          body: options?.body ? JSON.stringify(options.body) : undefined,
        }),
      catch: (error) =>
        new HttpError({
          message: error instanceof Error ? error.message : "Network error",
          status: 0,
        }),
    });

    if (!response.ok) {
      // Try to parse error body, fall back to empty object if parsing fails
      const errorBody = yield* pipe(
        Effect.tryPromise({
          try: () => response.json() as Promise<{ error?: string }>,
          catch: () =>
            new ParseError({
              message: "Failed to parse error response",
            }),
        }),
        Effect.catchAll(() => Effect.succeed({} as { error?: string })),
      );

      return yield* Effect.fail(
        new HttpError({
          message: errorBody?.error || `HTTP error! status: ${response.status}`,
          status: response.status,
          body: errorBody,
        }),
      );
    }

    const data = yield* Effect.tryPromise({
      try: () => response.json() as Promise<ApiResponse<T>>,
      catch: (error) =>
        new ParseError({
          message: "Failed to parse response",
          cause: error,
        }),
    });

    if (!data.success) {
      return yield* Effect.fail(
        new HttpError({
          message: data.error || "API request failed",
          status: response.status,
        }),
      );
    }

    return data.data as T;
  });

/**
 * Run an Effect and return a Promise
 * For use in client-side code where you need to integrate with React
 */
export const runClientEffect = <A, E>(effect: Effect.Effect<A, E, never>): Promise<Either.Either<A, E>> =>
  Effect.runPromise(Effect.either(effect));

/**
 * Run an Effect and return the result or throw
 */
export const runClientEffectUnsafe = <A, E>(effect: Effect.Effect<A, E, never>): Promise<A> =>
  Effect.runPromise(effect);

// =============================================================================
// Video API Client (Effect-based)
// =============================================================================

import type { PaginatedResponse, VideoWithAuthor, VideoWithDetails } from "@/lib/types";

export const videoApiEffect = {
  getVideos: (
    params: { organizationId?: string; channelId?: string; seriesId?: string; page?: number; limit?: number } = {},
  ): Effect.Effect<PaginatedResponse<VideoWithAuthor>, HttpError | ParseError> => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, value.toString());
      }
    });

    return fetchEffect(`/videos?${searchParams.toString()}`);
  },

  getVideo: (id: string): Effect.Effect<VideoWithDetails, HttpError | ParseError> => fetchEffect(`/videos/${id}`),

  createVideo: (data: {
    title: string;
    description?: string;
    duration: string;
    thumbnailUrl?: string;
    videoUrl?: string;
    authorId: string;
    organizationId: string;
    channelId?: string;
    seriesId?: string;
  }): Effect.Effect<VideoWithDetails, HttpError | ParseError> =>
    fetchEffect("/videos", {
      method: "POST",
      body: data,
    }),

  updateVideo: (
    id: string,
    data: Partial<{
      title: string;
      description: string;
      duration: string;
      thumbnailUrl: string;
      videoUrl: string;
      channelId: string;
      seriesId: string;
    }>,
  ): Effect.Effect<VideoWithDetails, HttpError | ParseError> =>
    fetchEffect(`/videos/${id}`, {
      method: "PUT",
      body: data,
    }),

  deleteVideo: (id: string): Effect.Effect<void, HttpError | ParseError> =>
    fetchEffect(`/videos/${id}`, {
      method: "DELETE",
    }),
};

// =============================================================================
// Organization API Client (Effect-based)
// =============================================================================

export const organizationApiEffect = {
  getOrganizations: (userId?: string): Effect.Effect<unknown[], HttpError | ParseError> => {
    const searchParams = new URLSearchParams();
    if (userId) {
      searchParams.append("userId", userId);
    }
    return fetchEffect(`/organizations?${searchParams.toString()}`);
  },

  getOrganization: (id: string): Effect.Effect<unknown, HttpError | ParseError> => fetchEffect(`/organizations/${id}`),

  createOrganization: (data: {
    name: string;
    slug: string;
    description?: string;
    ownerId: string;
  }): Effect.Effect<unknown, HttpError | ParseError> =>
    fetchEffect("/organizations", {
      method: "POST",
      body: data,
    }),
};

// =============================================================================
// Upload with Progress (Special case - uses XHR for progress)
// =============================================================================

export interface UploadResult {
  videoId: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration: string;
}

/**
 * Upload a video file with progress tracking
 * Returns an Effect that resolves with the upload result
 *
 * Note: This uses XHR internally for progress tracking since fetch doesn't support it
 */
export const uploadVideoEffect = (
  file: File,
  metadata: {
    title: string;
    description?: string;
    organizationId: string;
    authorId: string;
    channelId?: string;
    seriesId?: string;
  },
  onProgress?: (progress: number) => void,
): Effect.Effect<UploadResult, HttpError> =>
  Effect.async<UploadResult, HttpError>((resume) => {
    const formData = new FormData();
    formData.append("video", file);
    formData.append("title", metadata.title);
    if (metadata.description) formData.append("description", metadata.description);
    formData.append("organizationId", metadata.organizationId);
    formData.append("authorId", metadata.authorId);
    if (metadata.channelId) formData.append("channelId", metadata.channelId);
    if (metadata.seriesId) formData.append("seriesId", metadata.seriesId);

    const xhr = new XMLHttpRequest();

    // Track upload progress
    if (onProgress) {
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress(progress);
        }
      });
    }

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          if (response.success) {
            resume(Effect.succeed(response.data));
          } else {
            resume(
              Effect.fail(
                new HttpError({
                  message: response.error || "Upload failed",
                  status: xhr.status,
                }),
              ),
            );
          }
        } catch {
          resume(
            Effect.fail(
              new HttpError({
                message: "Invalid response format",
                status: xhr.status,
              }),
            ),
          );
        }
      } else {
        try {
          const errorResponse = JSON.parse(xhr.responseText);
          resume(
            Effect.fail(
              new HttpError({
                message: errorResponse.error || `HTTP ${xhr.status}`,
                status: xhr.status,
              }),
            ),
          );
        } catch {
          resume(
            Effect.fail(
              new HttpError({
                message: `HTTP ${xhr.status}: ${xhr.statusText}`,
                status: xhr.status,
              }),
            ),
          );
        }
      }
    });

    xhr.addEventListener("error", () => {
      resume(
        Effect.fail(
          new HttpError({
            message: "Network error occurred",
            status: 0,
          }),
        ),
      );
    });

    xhr.addEventListener("timeout", () => {
      resume(
        Effect.fail(
          new HttpError({
            message: "Upload timeout",
            status: 0,
          }),
        ),
      );
    });

    xhr.open("POST", `${API_BASE_URL}/videos/upload`);
    xhr.timeout = 300000; // 5 minutes timeout
    xhr.send(formData);
  });
