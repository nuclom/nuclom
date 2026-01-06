/**
 * API Client
 *
 * Client-side API utilities for fetching data from the backend.
 * Uses Effect-TS internally while maintaining a Promise-based interface
 * for backwards compatibility with existing React components.
 */

import { type Effect, Either } from 'effect';
import {
  organizationApiEffect,
  runClientEffect,
  type UploadResult,
  uploadVideoEffect,
  videoApiEffect,
} from '@/lib/effect/client';
import { HttpError, type ParseError } from '@/lib/effect/errors';
import type { PaginatedResponse, VideoWithAuthor, VideoWithDetails } from '@/lib/types';

// =============================================================================
// Error Class (Backwards Compatible)
// =============================================================================

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
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
export { organizationApiEffect, uploadVideoEffect, videoApiEffect } from '@/lib/effect/client';
