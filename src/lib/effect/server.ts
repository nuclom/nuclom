/**
 * Effect Server Utilities for React Server Components
 *
 * Provides type-safe server actions with Next.js caching and revalidation.
 * These utilities are designed for use in Server Components and Server Actions.
 */

import { Cause, Effect, Exit, Option } from 'effect';
import { revalidateTag } from 'next/cache';
import { cache } from 'react';
import { generatePresignedThumbnailUrl, generatePresignedVideoUrl } from '@/lib/api-handler';
import type { CollectionType } from '@/lib/db/schema';
import type {
  CollectionProgressWithDetails,
  CollectionWithProgress,
  CollectionWithVideoCount,
  CollectionWithVideos,
  PaginatedResponse,
  PaginatedResponse as PaginatedResponseType,
  VideoWithAuthor,
  VideoWithDetails,
} from '@/lib/types';
import { AppLive, type AppServices } from './runtime';
import { CollectionRepository } from './services/collection-repository';
import { OrganizationRepository } from './services/organization-repository';
import { Storage } from './services/storage';
import { type VideoProgressData, VideoProgressRepository } from './services/video-progress-repository';
import type { CreateVideoInput, UpdateVideoInput } from './services/video-repository';
import { VideoRepository } from './services/video-repository';

// =============================================================================
// Server Effect Runner
// =============================================================================

/**
 * Run an Effect on the server with the application layer
 * For use in Server Components and Server Actions
 */
export const runServerEffect = async <A, E>(effect: Effect.Effect<A, E, AppServices>): Promise<A> => {
  const runnable = effect.pipe(Effect.provide(AppLive));
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (Option.isSome(error)) {
        throw error.value;
      }
      const defect = Cause.dieOption(cause);
      if (Option.isSome(defect)) {
        throw defect.value;
      }
      throw new Error('Unknown error occurred');
    },
    onSuccess: (value) => value,
  });
};

/**
 * Run an Effect and return a result object (for error handling in components)
 */
export const runServerEffectSafe = async <A, E>(
  effect: Effect.Effect<A, E, AppServices>,
): Promise<{ success: true; data: A } | { success: false; error: unknown }> => {
  const runnable = effect.pipe(Effect.provide(AppLive));
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (Option.isSome(error)) {
        return { success: false as const, error: error.value };
      }
      return { success: false as const, error: new Error('Unexpected defect') };
    },
    onSuccess: (data) => ({ success: true as const, data }),
  });
};

// =============================================================================
// Video Queries (Cached)
// =============================================================================

/**
 * Get videos for an organization (cached per request)
 * Returns videos with presigned URLs for thumbnails and video files
 */
export const getVideos = cache(
  async (organizationId: string, page: number = 1, limit: number = 20): Promise<PaginatedResponse<VideoWithAuthor>> => {
    const effect = Effect.gen(function* () {
      const repo = yield* VideoRepository;
      const storage = yield* Storage;
      const videosData = yield* repo.getVideos(organizationId, page, limit);

      // Generate presigned URLs for all videos
      const videosWithPresignedUrls = yield* Effect.all(
        videosData.data.map((video) =>
          Effect.gen(function* () {
            const [presignedThumbnailUrl, presignedVideoUrl] = yield* Effect.all([
              generatePresignedThumbnailUrl(storage, video.thumbnailUrl),
              generatePresignedVideoUrl(storage, video.videoUrl),
            ]);
            return {
              ...video,
              thumbnailUrl: presignedThumbnailUrl,
              videoUrl: presignedVideoUrl,
            };
          }),
        ),
        { concurrency: 10 },
      );

      return {
        data: videosWithPresignedUrls,
        pagination: videosData.pagination,
      };
    });
    return runServerEffect(effect);
  },
);

/**
 * Get a single video with details (cached per request)
 */
export const getVideo = cache(async (id: string): Promise<VideoWithDetails> => {
  const effect = Effect.gen(function* () {
    const repo = yield* VideoRepository;
    return yield* repo.getVideo(id);
  });
  return runServerEffect(effect);
});

// =============================================================================
// Organization Queries (Cached)
// =============================================================================

/**
 * Get organizations for a user (cached per request)
 */
export const getOrganizations = cache(async (userId: string) => {
  const effect = Effect.gen(function* () {
    const repo = yield* OrganizationRepository;
    return yield* repo.getUserOrganizations(userId);
  });
  return runServerEffect(effect);
});

/**
 * Get organization by slug (cached per request)
 */
export const getOrganizationBySlug = cache(async (slug: string) => {
  const effect = Effect.gen(function* () {
    const repo = yield* OrganizationRepository;
    return yield* repo.getOrganizationBySlug(slug);
  });
  return runServerEffect(effect);
});

// =============================================================================
// Revalidation Helpers
// =============================================================================

/**
 * Revalidate video-related caches
 */
export const revalidateVideos = (organizationId?: string) => {
  revalidateTag('videos', 'max');
  if (organizationId) {
    revalidateTag(`videos:${organizationId}`, 'max');
  }
};

/**
 * Revalidate a specific video cache
 */
export const revalidateVideo = (videoId: string) => {
  revalidateTag(`video:${videoId}`, 'max');
};

/**
 * Revalidate organization-related caches
 */
export const revalidateOrganizations = (userId?: string) => {
  revalidateTag('organizations', 'max');
  if (userId) {
    revalidateTag(`organizations:user:${userId}`, 'max');
  }
};

/**
 * Revalidate a specific organization cache
 */
export const revalidateOrganization = (slug: string) => {
  revalidateTag(`organization:${slug}`, 'max');
};

// =============================================================================
// Server Actions
// =============================================================================

/**
 * Create a video (server action)
 */
export const createVideo = async (data: CreateVideoInput) => {
  const result = await runServerEffectSafe(
    Effect.gen(function* () {
      const repo = yield* VideoRepository;
      return yield* repo.createVideo(data);
    }),
  );

  if (result.success) {
    revalidateVideos(data.organizationId);
  }

  return result;
};

/**
 * Update a video (server action)
 */
export const updateVideo = async (id: string, data: UpdateVideoInput, organizationId?: string) => {
  const result = await runServerEffectSafe(
    Effect.gen(function* () {
      const repo = yield* VideoRepository;
      return yield* repo.updateVideo(id, data);
    }),
  );

  if (result.success) {
    revalidateVideo(id);
    if (organizationId) {
      revalidateVideos(organizationId);
    }
  }

  return result;
};

/**
 * Delete a video (server action)
 */
export const deleteVideo = async (id: string, organizationId?: string) => {
  const result = await runServerEffectSafe(
    Effect.gen(function* () {
      const repo = yield* VideoRepository;
      yield* repo.deleteVideo(id);
      return { deleted: true };
    }),
  );

  if (result.success) {
    revalidateVideo(id);
    if (organizationId) {
      revalidateVideos(organizationId);
    }
  }

  return result;
};

// =============================================================================
// Video Progress Queries
// =============================================================================

/**
 * Get video progress for a user (cached per request)
 */
export const getVideoProgress = cache(async (videoId: string, userId: string): Promise<VideoProgressData | null> => {
  const effect = Effect.gen(function* () {
    const repo = yield* VideoProgressRepository;
    return yield* repo.getProgress(videoId, userId);
  });
  return runServerEffect(effect);
});

/**
 * Get all video progress for a user (for "Continue Watching")
 */
export const getUserVideoProgress = cache(async (userId: string, limit: number = 10): Promise<VideoProgressData[]> => {
  const effect = Effect.gen(function* () {
    const repo = yield* VideoProgressRepository;
    return yield* repo.getUserProgress(userId, limit);
  });
  return runServerEffect(effect);
});

/**
 * Revalidate video progress caches
 */
export const revalidateVideoProgress = (videoId: string, userId: string) => {
  revalidateTag(`video-progress:${videoId}:${userId}`, 'max');
  revalidateTag(`video-progress:user:${userId}`, 'max');
};

// =============================================================================
// Utility for creating cached queries
// =============================================================================

/**
 * Create a cached server query from an Effect
 * Uses React cache for request-level deduplication
 */
export const createCachedQuery = <TArgs extends unknown[], TResult>(
  _keyFn: (...args: TArgs) => string[],
  effectFn: (...args: TArgs) => Effect.Effect<TResult, unknown, AppServices>,
  _options?: {
    revalidate?: number | false;
  },
) => {
  return cache(async (...args: TArgs): Promise<TResult> => {
    const effect = effectFn(...args);
    return runServerEffect(effect);
  });
};

// =============================================================================
// Collection Queries (Cached)
// =============================================================================

/**
 * Get collections for an organization (cached per request)
 */
export const getCollections = cache(
  async (
    organizationId: string,
    options?: {
      type?: CollectionType;
      page?: number;
      limit?: number;
    },
  ): Promise<PaginatedResponseType<CollectionWithVideoCount>> => {
    const effect = Effect.gen(function* () {
      const repo = yield* CollectionRepository;
      return yield* repo.getCollections(organizationId, options);
    });
    return runServerEffect(effect);
  },
);

/**
 * Get a collection with its videos (cached per request)
 */
export const getCollectionWithVideos = cache(async (id: string): Promise<CollectionWithVideos> => {
  const effect = Effect.gen(function* () {
    const repo = yield* CollectionRepository;
    return yield* repo.getCollectionWithVideos(id);
  });
  return runServerEffect(effect);
});

/**
 * Get collections with user progress (cached per request)
 */
export const getCollectionsWithProgress = cache(
  async (organizationId: string, userId: string, type?: CollectionType): Promise<CollectionWithProgress[]> => {
    const effect = Effect.gen(function* () {
      const repo = yield* CollectionRepository;
      return yield* repo.getCollectionsWithProgress(organizationId, userId, type);
    });
    return runServerEffect(effect);
  },
);

/**
 * Get user's progress for a specific collection (cached per request)
 */
export const getCollectionProgress = cache(
  async (userId: string, collectionId: string): Promise<CollectionProgressWithDetails | null> => {
    const effect = Effect.gen(function* () {
      const repo = yield* CollectionRepository;
      return yield* repo.getCollectionProgress(userId, collectionId);
    });
    return runServerEffect(effect);
  },
);

// Legacy aliases for backward compatibility during migration
/** @deprecated Use getCollections instead */
export const getSeries = (organizationId: string, page = 1, limit = 20) =>
  getCollections(organizationId, { type: 'playlist', page, limit });

/** @deprecated Use getCollectionWithVideos instead */
export const getSeriesWithVideos = getCollectionWithVideos;

/** @deprecated Use getCollectionsWithProgress instead */
export const getSeriesWithProgress = (organizationId: string, userId: string) =>
  getCollectionsWithProgress(organizationId, userId, 'playlist');

/** @deprecated Use getCollectionProgress instead */
export const getSeriesProgress = getCollectionProgress;

/** @deprecated Use getCollections with type: 'folder' instead */
export const getChannels = (organizationId: string, page = 1, limit = 20) =>
  getCollections(organizationId, { type: 'folder', page, limit });

// =============================================================================
// Collection Revalidation Helpers
// =============================================================================

/**
 * Revalidate collection-related caches
 */
export const revalidateCollections = (organizationId?: string) => {
  revalidateTag('collections', 'max');
  if (organizationId) {
    revalidateTag(`collections:${organizationId}`, 'max');
  }
};

/**
 * Revalidate a specific collection cache
 */
export const revalidateCollectionById = (collectionId: string) => {
  revalidateTag(`collection:${collectionId}`, 'max');
};

/**
 * Revalidate collection progress caches
 */
export const revalidateCollectionProgress = (collectionId: string, userId: string) => {
  revalidateTag(`collection-progress:${collectionId}:${userId}`, 'max');
  revalidateTag(`collection-progress:user:${userId}`, 'max');
};

// Legacy aliases
/** @deprecated Use revalidateCollections instead */
export const revalidateSeries = revalidateCollections;
/** @deprecated Use revalidateCollectionById instead */
export const revalidateSeriesById = revalidateCollectionById;
/** @deprecated Use revalidateCollectionProgress instead */
export const revalidateSeriesProgress = revalidateCollectionProgress;

// =============================================================================
// User's Own Videos Queries (Cached)
// =============================================================================

/**
 * Get videos created by a specific user within an organization (cached per request)
 */
export const getVideosByAuthor = cache(
  async (
    authorId: string,
    organizationId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedResponse<VideoWithAuthor>> => {
    const effect = Effect.gen(function* () {
      const repo = yield* VideoRepository;
      return yield* repo.getVideosByAuthor(authorId, organizationId, page, limit);
    });
    return runServerEffect(effect);
  },
);

/**
 * Get videos shared by others in the organization (not authored by the user) (cached per request)
 */
export const getVideosSharedByOthers = cache(
  async (
    userId: string,
    organizationId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedResponse<VideoWithAuthor>> => {
    const effect = Effect.gen(function* () {
      const repo = yield* VideoRepository;
      return yield* repo.getVideosSharedByOthers(userId, organizationId, page, limit);
    });
    return runServerEffect(effect);
  },
);
