/**
 * API Client
 *
 * Client-side API utilities for fetching data from the backend.
 * Uses Effect-TS internally while maintaining a Promise-based interface
 * for backwards compatibility with existing React components.
 */

import { Effect, Either, pipe } from "effect";
import {
  fetchEffect,
  runClientEffect,
  videoApiEffect,
  organizationApiEffect,
  uploadVideoEffect,
  type UploadResult,
} from "@/lib/effect/client";
import { HttpError, ParseError } from "@/lib/effect/errors";
import type { ApiResponse, PaginatedResponse, VideoWithAuthor, VideoWithDetails } from "@/lib/types";

// =============================================================================
// Error Class (Backwards Compatible)
// =============================================================================

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// =============================================================================
// Effect to Promise Conversion Utility
// =============================================================================

const effectToPromise = async <T>(effect: Effect.Effect<T, HttpError | ParseError, never>): Promise<T> => {
  const result = await runClientEffect(effect);

  return Either.match(result, {
    onLeft: (error) => {
      if (error instanceof HttpError) {
        throw new ApiError(error.status, error.message);
      }
      throw new Error(error.message);
    },
    onRight: (value) => value,
  });
};

// =============================================================================
// Legacy API Functions (Promise-based, uses Effect internally)
// =============================================================================

const API_BASE_URL = "/api";

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const effect = fetchEffect<T>(endpoint, {
    ...options,
    body: options?.body ? JSON.parse(options.body as string) : undefined,
  });

  return effectToPromise(effect);
}

// =============================================================================
// Video API Functions
// =============================================================================

export const videoApi = {
  async getVideos(
    params: { organizationId?: string; channelId?: string; seriesId?: string; page?: number; limit?: number } = {},
  ): Promise<PaginatedResponse<VideoWithAuthor>> {
    return effectToPromise(videoApiEffect.getVideos(params));
  },

  async getVideo(id: string): Promise<VideoWithDetails> {
    return effectToPromise(videoApiEffect.getVideo(id));
  },

  async createVideo(data: {
    title: string;
    description?: string;
    duration: string;
    thumbnailUrl?: string;
    videoUrl?: string;
    authorId: string;
    organizationId: string;
    channelId?: string;
    seriesId?: string;
  }): Promise<VideoWithDetails> {
    return effectToPromise(videoApiEffect.createVideo(data));
  },

  async updateVideo(
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
  ): Promise<VideoWithDetails> {
    return effectToPromise(videoApiEffect.updateVideo(id, data));
  },

  async deleteVideo(id: string): Promise<void> {
    return effectToPromise(videoApiEffect.deleteVideo(id));
  },

  async uploadVideo(
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
  ): Promise<UploadResult> {
    const effect = uploadVideoEffect(file, metadata, onProgress);
    const result = await runClientEffect(effect);

    return Either.match(result, {
      onLeft: (error) => {
        throw new ApiError(error.status, error.message);
      },
      onRight: (value) => value,
    });
  },
};

// =============================================================================
// Organization API Functions
// =============================================================================

export const organizationApi = {
  async getOrganizations(userId?: string) {
    return effectToPromise(organizationApiEffect.getOrganizations(userId));
  },

  async getOrganization(id: string) {
    return effectToPromise(organizationApiEffect.getOrganization(id));
  },

  async createOrganization(data: { name: string; slug: string; description?: string; ownerId: string }) {
    return effectToPromise(organizationApiEffect.createOrganization(data));
  },
};

// =============================================================================
// Exports
// =============================================================================

export { ApiError };

// Re-export Effect-based API for direct Effect usage
export { videoApiEffect, organizationApiEffect, uploadVideoEffect } from "@/lib/effect/client";
