/**
 * Video Share Links Repository Service
 *
 * Provides data access for shareable video links.
 */

import { eq, sql } from 'drizzle-orm';
import { Context, Effect, Layer, Option } from 'effect';
import type { VideoShareLink } from '../../db/schema';
import { videoShareLinks } from '../../db/schema';
import { DatabaseError, NotFoundError } from '../errors';
import { Database } from './database';

// =============================================================================
// Types
// =============================================================================

export type VideoShareLinkWithVideo = VideoShareLink & {
  readonly video: {
    readonly id: string;
    readonly title: string;
    readonly videoUrl: string | null;
    readonly thumbnailUrl: string | null;
    readonly duration: string;
    readonly organizationId: string;
  } | null;
};

export type VideoShareLinkWithVideoAndOrganization = VideoShareLink & {
  readonly video: {
    readonly id: string;
    readonly title: string;
    readonly videoUrl: string | null;
    readonly thumbnailUrl: string | null;
    readonly duration: string;
    readonly organizationId: string;
    readonly organization: {
      readonly id: string;
      readonly name: string;
      readonly slug: string;
    } | null;
  } | null;
};

export type VideoShareLinkStatus = VideoShareLink['status'];

// =============================================================================
// Service Interface
// =============================================================================

export interface VideoShareLinksRepositoryService {
  readonly getShareLink: (id: string) => Effect.Effect<VideoShareLink, DatabaseError | NotFoundError>;
  readonly getShareLinkOption: (id: string) => Effect.Effect<Option.Option<VideoShareLink>, DatabaseError>;
  readonly getShareLinkWithVideo: (id: string) => Effect.Effect<VideoShareLinkWithVideo, DatabaseError | NotFoundError>;
  readonly getShareLinkWithVideoOption: (
    id: string,
  ) => Effect.Effect<Option.Option<VideoShareLinkWithVideo>, DatabaseError>;
  readonly getShareLinkWithVideoAndOrganization: (
    id: string,
  ) => Effect.Effect<VideoShareLinkWithVideoAndOrganization, DatabaseError | NotFoundError>;
  readonly getShareLinkWithVideoAndOrganizationOption: (
    id: string,
  ) => Effect.Effect<Option.Option<VideoShareLinkWithVideoAndOrganization>, DatabaseError>;
  readonly incrementShareLinkView: (id: string) => Effect.Effect<void, DatabaseError>;
  readonly updateShareLinkStatus: (id: string, status: VideoShareLinkStatus) => Effect.Effect<void, DatabaseError>;
}

// =============================================================================
// Service Tag
// =============================================================================

export class VideoShareLinksRepository extends Context.Tag('VideoShareLinksRepository')<
  VideoShareLinksRepository,
  VideoShareLinksRepositoryService
>() {}

// =============================================================================
// Service Implementation
// =============================================================================

const makeVideoShareLinksRepositoryService = Effect.gen(function* () {
  const { db } = yield* Database;

  const getShareLinkOption = (id: string): Effect.Effect<Option.Option<VideoShareLink>, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const result = await db.query.videoShareLinks.findFirst({
          where: eq(videoShareLinks.id, id),
        });
        return Option.fromNullable(result ?? null);
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch share link',
          operation: 'getShareLink',
          cause: error,
        }),
    });

  const getShareLink = (id: string): Effect.Effect<VideoShareLink, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const result = yield* getShareLinkOption(id);
      if (Option.isNone(result)) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Share link not found',
            entity: 'VideoShareLink',
            id,
          }),
        );
      }
      return result.value;
    });

  const getShareLinkWithVideoOption = (
    id: string,
  ): Effect.Effect<Option.Option<VideoShareLinkWithVideo>, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const result = await db.query.videoShareLinks.findFirst({
          where: eq(videoShareLinks.id, id),
          with: {
            video: {
              columns: {
                id: true,
                title: true,
                videoUrl: true,
                thumbnailUrl: true,
                duration: true,
                organizationId: true,
              },
            },
          },
        });
        return Option.fromNullable(result ?? null) as Option.Option<VideoShareLinkWithVideo>;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch share link with video',
          operation: 'getShareLinkWithVideo',
          cause: error,
        }),
    });

  const getShareLinkWithVideo = (id: string): Effect.Effect<VideoShareLinkWithVideo, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const result = yield* getShareLinkWithVideoOption(id);
      if (Option.isNone(result)) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Share link not found',
            entity: 'VideoShareLink',
            id,
          }),
        );
      }
      return result.value;
    });

  const getShareLinkWithVideoAndOrganizationOption = (
    id: string,
  ): Effect.Effect<Option.Option<VideoShareLinkWithVideoAndOrganization>, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const result = await db.query.videoShareLinks.findFirst({
          where: eq(videoShareLinks.id, id),
          with: {
            video: {
              columns: {
                id: true,
                title: true,
                videoUrl: true,
                thumbnailUrl: true,
                duration: true,
                organizationId: true,
              },
              with: {
                organization: {
                  columns: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        });
        return Option.fromNullable(result ?? null) as Option.Option<VideoShareLinkWithVideoAndOrganization>;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch share link with video and organization',
          operation: 'getShareLinkWithVideoAndOrganization',
          cause: error,
        }),
    });

  const getShareLinkWithVideoAndOrganization = (
    id: string,
  ): Effect.Effect<VideoShareLinkWithVideoAndOrganization, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const result = yield* getShareLinkWithVideoAndOrganizationOption(id);
      if (Option.isNone(result)) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Share link not found',
            entity: 'VideoShareLink',
            id,
          }),
        );
      }
      return result.value;
    });

  const incrementShareLinkView = (id: string): Effect.Effect<void, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        await db
          .update(videoShareLinks)
          .set({
            viewCount: sql`${videoShareLinks.viewCount} + 1`,
            lastAccessedAt: new Date(),
          })
          .where(eq(videoShareLinks.id, id));
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to increment share link views',
          operation: 'incrementShareLinkView',
          cause: error,
        }),
    });

  const updateShareLinkStatus = (id: string, status: VideoShareLinkStatus): Effect.Effect<void, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        await db.update(videoShareLinks).set({ status }).where(eq(videoShareLinks.id, id));
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to update share link status',
          operation: 'updateShareLinkStatus',
          cause: error,
        }),
    });

  return {
    getShareLink,
    getShareLinkOption,
    getShareLinkWithVideo,
    getShareLinkWithVideoOption,
    getShareLinkWithVideoAndOrganization,
    getShareLinkWithVideoAndOrganizationOption,
    incrementShareLinkView,
    updateShareLinkStatus,
  } satisfies VideoShareLinksRepositoryService;
});

// =============================================================================
// Repository Layer
// =============================================================================

export const VideoShareLinksRepositoryLive = Layer.effect(
  VideoShareLinksRepository,
  makeVideoShareLinksRepositoryService,
);

// =============================================================================
// Helper Functions
// =============================================================================

export const getShareLink = (
  id: string,
): Effect.Effect<VideoShareLink, DatabaseError | NotFoundError, VideoShareLinksRepository> =>
  Effect.gen(function* () {
    const repo = yield* VideoShareLinksRepository;
    return yield* repo.getShareLink(id);
  });

export const getShareLinkOption = (
  id: string,
): Effect.Effect<Option.Option<VideoShareLink>, DatabaseError, VideoShareLinksRepository> =>
  Effect.gen(function* () {
    const repo = yield* VideoShareLinksRepository;
    return yield* repo.getShareLinkOption(id);
  });

export const getShareLinkWithVideoAndOrganization = (
  id: string,
): Effect.Effect<VideoShareLinkWithVideoAndOrganization, DatabaseError | NotFoundError, VideoShareLinksRepository> =>
  Effect.gen(function* () {
    const repo = yield* VideoShareLinksRepository;
    return yield* repo.getShareLinkWithVideoAndOrganization(id);
  });

export const getShareLinkWithVideoAndOrganizationOption = (
  id: string,
): Effect.Effect<Option.Option<VideoShareLinkWithVideoAndOrganization>, DatabaseError, VideoShareLinksRepository> =>
  Effect.gen(function* () {
    const repo = yield* VideoShareLinksRepository;
    return yield* repo.getShareLinkWithVideoAndOrganizationOption(id);
  });

export const incrementShareLinkView = (id: string): Effect.Effect<void, DatabaseError, VideoShareLinksRepository> =>
  Effect.gen(function* () {
    const repo = yield* VideoShareLinksRepository;
    return yield* repo.incrementShareLinkView(id);
  });

export const updateShareLinkStatus = (
  id: string,
  status: VideoShareLinkStatus,
): Effect.Effect<void, DatabaseError, VideoShareLinksRepository> =>
  Effect.gen(function* () {
    const repo = yield* VideoShareLinksRepository;
    return yield* repo.updateShareLinkStatus(id, status);
  });
