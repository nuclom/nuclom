/**
 * Effect Server Utilities for React Server Components
 *
 * Provides type-safe server actions with Next.js caching and revalidation.
 * These utilities are designed for use in Server Components and Server Actions.
 */

import { Cause, Effect, Exit, Option } from "effect";
import { revalidateTag } from "next/cache";
import { cache } from "react";
import type {
  PaginatedResponse,
  PaginatedResponse as PaginatedResponseType,
  SeriesProgressWithDetails,
  SeriesWithVideoCount,
  SeriesWithVideos,
  VideoWithAuthor,
  VideoWithDetails,
} from "@/lib/types";
import { AppLive, type AppServices } from "./runtime";
import { OrganizationRepository } from "./services/organization-repository";
import { SeriesRepository } from "./services/series-repository";
import { type VideoProgressData, VideoProgressRepository } from "./services/video-progress-repository";
import type { CreateVideoInput, UpdateVideoInput } from "./services/video-repository";
import { VideoRepository } from "./services/video-repository";

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
      throw new Error("Unknown error occurred");
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
      return { success: false as const, error: new Error("Unexpected defect") };
    },
    onSuccess: (data) => ({ success: true as const, data }),
  });
};

// =============================================================================
// Video Queries (Cached)
// =============================================================================

/**
 * Get videos for an organization (cached per request)
 */
export const getVideos = cache(
  async (organizationId: string, page: number = 1, limit: number = 20): Promise<PaginatedResponse<VideoWithAuthor>> => {
    const effect = Effect.gen(function* () {
      const repo = yield* VideoRepository;
      return yield* repo.getVideos(organizationId, page, limit);
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
  revalidateTag("videos", "max");
  if (organizationId) {
    revalidateTag(`videos:${organizationId}`, "max");
  }
};

/**
 * Revalidate a specific video cache
 */
export const revalidateVideo = (videoId: string) => {
  revalidateTag(`video:${videoId}`, "max");
};

/**
 * Revalidate organization-related caches
 */
export const revalidateOrganizations = (userId?: string) => {
  revalidateTag("organizations", "max");
  if (userId) {
    revalidateTag(`organizations:user:${userId}`, "max");
  }
};

/**
 * Revalidate a specific organization cache
 */
export const revalidateOrganization = (slug: string) => {
  revalidateTag(`organization:${slug}`, "max");
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
  revalidateTag(`video-progress:${videoId}:${userId}`, "max");
  revalidateTag(`video-progress:user:${userId}`, "max");
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
// Series Queries (Cached)
// =============================================================================

/**
 * Get series for an organization (cached per request)
 */
export const getSeries = cache(
  async (
    organizationId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedResponseType<SeriesWithVideoCount>> => {
    const effect = Effect.gen(function* () {
      const repo = yield* SeriesRepository;
      return yield* repo.getSeries(organizationId, page, limit);
    });
    return runServerEffect(effect);
  },
);

/**
 * Get a series with its videos (cached per request)
 */
export const getSeriesWithVideos = cache(async (id: string): Promise<SeriesWithVideos> => {
  const effect = Effect.gen(function* () {
    const repo = yield* SeriesRepository;
    return yield* repo.getSeriesWithVideos(id);
  });
  return runServerEffect(effect);
});

/**
 * Get series with user progress (cached per request)
 */
export const getSeriesWithProgress = cache(
  async (
    organizationId: string,
    userId: string,
  ): Promise<(SeriesWithVideoCount & { progress?: SeriesProgressWithDetails })[]> => {
    const effect = Effect.gen(function* () {
      const repo = yield* SeriesRepository;
      return yield* repo.getSeriesWithProgress(organizationId, userId);
    });
    return runServerEffect(effect);
  },
);

/**
 * Get user's progress for a specific series (cached per request)
 */
export const getSeriesProgress = cache(
  async (userId: string, seriesId: string): Promise<SeriesProgressWithDetails | null> => {
    const effect = Effect.gen(function* () {
      const repo = yield* SeriesRepository;
      return yield* repo.getSeriesProgress(userId, seriesId);
    });
    return runServerEffect(effect);
  },
);

// =============================================================================
// Series Revalidation Helpers
// =============================================================================

/**
 * Revalidate series-related caches
 */
export const revalidateSeries = (organizationId?: string) => {
  revalidateTag("series", "max");
  if (organizationId) {
    revalidateTag(`series:${organizationId}`, "max");
  }
};

/**
 * Revalidate a specific series cache
 */
export const revalidateSeriesById = (seriesId: string) => {
  revalidateTag(`series:${seriesId}`, "max");
};

/**
 * Revalidate series progress caches
 */
export const revalidateSeriesProgress = (seriesId: string, userId: string) => {
  revalidateTag(`series-progress:${seriesId}:${userId}`, "max");
  revalidateTag(`series-progress:user:${userId}`, "max");
};
