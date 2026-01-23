/**
 * API Client
 *
 * Client-side API utilities for fetching data from the backend.
 * Provides a Promise-based interface that wraps the Effect-TS client.
 */

import { type Effect, Either } from 'effect';
import {
  organizationApiEffect,
  runClientEffect,
  type UploadResult,
  uploadVideoEffect,
  videoApiEffect,
} from './effect/client';
import { HttpError, type ParseError } from './effect/errors';
import type { PaginatedResponse, VideoWithAuthor, VideoWithDetails } from './types';

// =============================================================================
// Error Class
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
    params: { organizationId?: string; collectionId?: string; page?: number; limit?: number } = {},
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
    collectionId?: string;
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
      collectionId: string;
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
      collectionId?: string;
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
export { organizationApiEffect, uploadVideoEffect, videoApiEffect } from './effect/client';
