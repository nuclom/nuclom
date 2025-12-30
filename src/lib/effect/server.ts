/**
 * Effect Server Utilities for React Server Components
 *
 * Provides type-safe server actions with Next.js caching and revalidation.
 * These utilities are designed for use in Server Components and Server Actions.
 */

import { Effect, Exit, Cause, Option } from "effect";
import { unstable_cache } from "next/cache";
import { revalidateTag } from "next/cache";
import { AppLive, type AppServices } from "./runtime";
import { VideoRepository } from "./services/video-repository";
import { OrganizationRepository } from "./services/organization-repository";
import { VideoProgressRepository, type VideoProgressData } from "./services/video-progress-repository";
import type { PaginatedResponse, VideoWithAuthor, VideoWithDetails } from "@/lib/types";
import type { CreateVideoInput, UpdateVideoInput } from "./services/video-repository";

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
 * Get videos for an organization (cached)
 */
export const getVideos = async (
  organizationId: string,
  page: number = 1,
  limit: number = 20,
): Promise<PaginatedResponse<VideoWithAuthor>> => {
  const cachedFn = unstable_cache(
    async () => {
      const effect = Effect.gen(function* () {
        const repo = yield* VideoRepository;
        return yield* repo.getVideos(organizationId, page, limit);
      });
      return runServerEffect(effect);
    },
    [`videos`, `videos:${organizationId}`, `page:${page}`, `limit:${limit}`],
    {
      tags: [`videos`, `videos:${organizationId}`],
      revalidate: 60,
    },
  );

  return cachedFn();
};

/**
 * Get a single video with details (cached)
 */
export const getVideo = async (id: string): Promise<VideoWithDetails> => {
  const cachedFn = unstable_cache(
    async () => {
      const effect = Effect.gen(function* () {
        const repo = yield* VideoRepository;
        return yield* repo.getVideo(id);
      });
      return runServerEffect(effect);
    },
    [`video:${id}`],
    {
      tags: [`video:${id}`],
      revalidate: 60,
    },
  );

  return cachedFn();
};

// =============================================================================
// Organization Queries (Cached)
// =============================================================================

/**
 * Get organizations for a user (cached)
 */
export const getOrganizations = async (userId: string) => {
  const cachedFn = unstable_cache(
    async () => {
      const effect = Effect.gen(function* () {
        const repo = yield* OrganizationRepository;
        return yield* repo.getUserOrganizations(userId);
      });
      return runServerEffect(effect);
    },
    [`organizations`, `organizations:user:${userId}`],
    {
      tags: [`organizations`, `organizations:user:${userId}`],
      revalidate: 300,
    },
  );

  return cachedFn();
};

/**
 * Get organization by slug (cached)
 */
export const getOrganizationBySlug = async (slug: string) => {
  const cachedFn = unstable_cache(
    async () => {
      const effect = Effect.gen(function* () {
        const repo = yield* OrganizationRepository;
        return yield* repo.getOrganizationBySlug(slug);
      });
      return runServerEffect(effect);
    },
    [`organization:${slug}`],
    {
      tags: [`organization:${slug}`],
      revalidate: 300,
    },
  );

  return cachedFn();
};

// =============================================================================
// Revalidation Helpers
// =============================================================================

/**
 * Revalidate video-related caches
 */
export const revalidateVideos = (organizationId?: string) => {
  revalidateTag("videos");
  if (organizationId) {
    revalidateTag(`videos:${organizationId}`);
  }
};

/**
 * Revalidate a specific video cache
 */
export const revalidateVideo = (videoId: string) => {
  revalidateTag(`video:${videoId}`);
};

/**
 * Revalidate organization-related caches
 */
export const revalidateOrganizations = (userId?: string) => {
  revalidateTag("organizations");
  if (userId) {
    revalidateTag(`organizations:user:${userId}`);
  }
};

/**
 * Revalidate a specific organization cache
 */
export const revalidateOrganization = (slug: string) => {
  revalidateTag(`organization:${slug}`);
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
 * Get video progress for a user (short-lived cache)
 * Uses a short revalidation time since progress changes frequently
 */
export const getVideoProgress = async (videoId: string, userId: string): Promise<VideoProgressData | null> => {
  const cachedFn = unstable_cache(
    async () => {
      const effect = Effect.gen(function* () {
        const repo = yield* VideoProgressRepository;
        return yield* repo.getProgress(videoId, userId);
      });
      return runServerEffect(effect);
    },
    [`video-progress:${videoId}:${userId}`],
    {
      tags: [`video-progress:${videoId}:${userId}`, `video-progress:user:${userId}`],
      revalidate: 10, // Short cache - progress updates frequently
    },
  );

  return cachedFn();
};

/**
 * Get all video progress for a user (for "Continue Watching")
 */
export const getUserVideoProgress = async (userId: string, limit: number = 10): Promise<VideoProgressData[]> => {
  const cachedFn = unstable_cache(
    async () => {
      const effect = Effect.gen(function* () {
        const repo = yield* VideoProgressRepository;
        return yield* repo.getUserProgress(userId, limit);
      });
      return runServerEffect(effect);
    },
    [`video-progress:user:${userId}`, `limit:${limit}`],
    {
      tags: [`video-progress:user:${userId}`],
      revalidate: 30,
    },
  );

  return cachedFn();
};

/**
 * Revalidate video progress caches
 */
export const revalidateVideoProgress = (videoId: string, userId: string) => {
  revalidateTag(`video-progress:${videoId}:${userId}`);
  revalidateTag(`video-progress:user:${userId}`);
};

// =============================================================================
// Utility for creating cached queries
// =============================================================================

/**
 * Create a cached server query from an Effect
 * Uses Next.js unstable_cache for automatic caching and revalidation
 */
export const createCachedQuery = <TArgs extends unknown[], TResult>(
  keyFn: (...args: TArgs) => string[],
  effectFn: (...args: TArgs) => Effect.Effect<TResult, unknown, AppServices>,
  options?: {
    revalidate?: number | false;
  },
) => {
  return async (...args: TArgs): Promise<TResult> => {
    const keys = keyFn(...args);

    const cachedFn = unstable_cache(
      async () => {
        const effect = effectFn(...args);
        return runServerEffect(effect);
      },
      keys,
      {
        tags: keys,
        revalidate: options?.revalidate,
      },
    );

    return cachedFn();
  };
};
