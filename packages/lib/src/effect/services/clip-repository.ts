/**
 * Clip Repository Service using Effect-TS
 *
 * Provides type-safe database operations for video clips, moments, and highlight reels.
 */

import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { Context, Effect, Layer } from 'effect';
import {
  type ClipMetadata,
  type ClipStatus,
  type ClipType,
  type HighlightReelConfig,
  type HighlightReelStatus,
  highlightReels,
  type MomentType,
  type User,
  users,
  videoClips,
  videoMoments,
} from '../../db/schema';
import type { PaginatedResponse } from '../../types';
import { DatabaseError, NotFoundError } from '../errors';
import { Database } from './database';
import { Storage } from './storage';

// =============================================================================
// Types
// =============================================================================

export interface VideoMomentWithVideo {
  id: string;
  videoId: string;
  organizationId: string;
  title: string;
  description: string | null;
  startTime: number;
  endTime: number;
  momentType: MomentType;
  confidence: number;
  transcriptExcerpt: string | null;
  metadata: ClipMetadata | null;
  createdAt: Date;
}

export interface VideoClipWithCreator {
  id: string;
  videoId: string;
  organizationId: string;
  momentId: string | null;
  title: string;
  description: string | null;
  startTime: number;
  endTime: number;
  clipType: ClipType;
  momentType: MomentType | null;
  storageKey: string | null;
  thumbnailUrl: string | null;
  status: ClipStatus;
  processingError: string | null;
  transcriptExcerpt: string | null;
  metadata: ClipMetadata | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  creator?: User | null;
}

export interface HighlightReelWithCreator {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  clipIds: string[];
  storageKey: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
  status: HighlightReelStatus;
  processingError: string | null;
  config: HighlightReelConfig | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  creator?: User | null;
}

export interface CreateMomentInput {
  readonly videoId: string;
  readonly organizationId: string;
  readonly title: string;
  readonly description?: string;
  readonly startTime: number;
  readonly endTime: number;
  readonly momentType: MomentType;
  readonly confidence: number;
  readonly transcriptExcerpt?: string;
  readonly metadata?: ClipMetadata;
}

export interface CreateClipInput {
  readonly videoId: string;
  readonly organizationId: string;
  readonly momentId?: string;
  readonly title: string;
  readonly description?: string;
  readonly startTime: number;
  readonly endTime: number;
  readonly clipType?: ClipType;
  readonly momentType?: MomentType;
  readonly transcriptExcerpt?: string;
  readonly metadata?: ClipMetadata;
  readonly createdBy: string;
}

export interface UpdateClipInput {
  readonly title?: string;
  readonly description?: string | null;
  readonly startTime?: number;
  readonly endTime?: number;
  readonly storageKey?: string | null;
  readonly thumbnailUrl?: string | null;
  readonly status?: ClipStatus;
  readonly processingError?: string | null;
}

export interface CreateHighlightReelInput {
  readonly organizationId: string;
  readonly title: string;
  readonly description?: string;
  readonly clipIds?: string[];
  readonly config?: HighlightReelConfig;
  readonly createdBy: string;
}

export interface UpdateHighlightReelInput {
  readonly title?: string;
  readonly description?: string | null;
  readonly clipIds?: string[];
  readonly storageKey?: string | null;
  readonly thumbnailUrl?: string | null;
  readonly duration?: number | null;
  readonly status?: HighlightReelStatus;
  readonly processingError?: string | null;
  readonly config?: HighlightReelConfig | null;
}

export interface ClipRepositoryService {
  // Moments
  readonly getMoments: (
    videoId: string,
    minConfidence?: number,
  ) => Effect.Effect<VideoMomentWithVideo[], DatabaseError>;
  readonly getMomentsByType: (
    videoId: string,
    momentType: MomentType,
  ) => Effect.Effect<VideoMomentWithVideo[], DatabaseError>;
  readonly createMoment: (data: CreateMomentInput) => Effect.Effect<VideoMomentWithVideo, DatabaseError>;
  readonly createMomentsBatch: (data: CreateMomentInput[]) => Effect.Effect<VideoMomentWithVideo[], DatabaseError>;
  readonly deleteMomentsByVideoId: (videoId: string) => Effect.Effect<void, DatabaseError>;

  // Clips
  readonly getClips: (
    videoId: string,
    page?: number,
    limit?: number,
  ) => Effect.Effect<PaginatedResponse<VideoClipWithCreator>, DatabaseError>;
  readonly getClipsByOrganization: (
    organizationId: string,
    page?: number,
    limit?: number,
  ) => Effect.Effect<PaginatedResponse<VideoClipWithCreator>, DatabaseError>;
  readonly getClip: (id: string) => Effect.Effect<VideoClipWithCreator, DatabaseError | NotFoundError>;
  readonly createClip: (data: CreateClipInput) => Effect.Effect<VideoClipWithCreator, DatabaseError>;
  readonly updateClip: (
    id: string,
    data: UpdateClipInput,
  ) => Effect.Effect<VideoClipWithCreator, DatabaseError | NotFoundError>;
  readonly deleteClip: (id: string) => Effect.Effect<void, DatabaseError | NotFoundError>;

  // Highlight Reels
  readonly getHighlightReels: (
    organizationId: string,
    page?: number,
    limit?: number,
  ) => Effect.Effect<PaginatedResponse<HighlightReelWithCreator>, DatabaseError>;
  readonly getHighlightReel: (id: string) => Effect.Effect<HighlightReelWithCreator, DatabaseError | NotFoundError>;
  readonly createHighlightReel: (
    data: CreateHighlightReelInput,
  ) => Effect.Effect<HighlightReelWithCreator, DatabaseError>;
  readonly updateHighlightReel: (
    id: string,
    data: UpdateHighlightReelInput,
  ) => Effect.Effect<HighlightReelWithCreator, DatabaseError | NotFoundError>;
  readonly deleteHighlightReel: (id: string) => Effect.Effect<void, DatabaseError | NotFoundError>;
}

// =============================================================================
// Clip Repository Tag
// =============================================================================

export class ClipRepository extends Context.Tag('ClipRepository')<ClipRepository, ClipRepositoryService>() {}

// =============================================================================
// Clip Repository Implementation
// =============================================================================

const makeClipRepositoryService = Effect.gen(function* () {
  const { db } = yield* Database;
  const storage = yield* Storage;

  // ==========================================================================
  // Moments
  // ==========================================================================

  const getMoments = (videoId: string, minConfidence = 0): Effect.Effect<VideoMomentWithVideo[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        return await db
          .select()
          .from(videoMoments)
          .where(and(eq(videoMoments.videoId, videoId), sql`${videoMoments.confidence} >= ${minConfidence}`))
          .orderBy(asc(videoMoments.startTime));
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch video moments',
          operation: 'getMoments',
          cause: error,
        }),
    });

  const getMomentsByType = (
    videoId: string,
    momentType: MomentType,
  ): Effect.Effect<VideoMomentWithVideo[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        return await db
          .select()
          .from(videoMoments)
          .where(and(eq(videoMoments.videoId, videoId), eq(videoMoments.momentType, momentType)))
          .orderBy(asc(videoMoments.startTime));
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch video moments by type',
          operation: 'getMomentsByType',
          cause: error,
        }),
    });

  const createMoment = (data: CreateMomentInput): Effect.Effect<VideoMomentWithVideo, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const [moment] = await db.insert(videoMoments).values(data).returning();
        return moment;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to create video moment',
          operation: 'createMoment',
          cause: error,
        }),
    });

  const createMomentsBatch = (data: CreateMomentInput[]): Effect.Effect<VideoMomentWithVideo[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        if (data.length === 0) return [];
        return await db.insert(videoMoments).values(data).returning();
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to create video moments batch',
          operation: 'createMomentsBatch',
          cause: error,
        }),
    });

  const deleteMomentsByVideoId = (videoId: string): Effect.Effect<void, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        await db.delete(videoMoments).where(eq(videoMoments.videoId, videoId));
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to delete video moments',
          operation: 'deleteMomentsByVideoId',
          cause: error,
        }),
    });

  // ==========================================================================
  // Clips
  // ==========================================================================

  const getClips = (
    videoId: string,
    page = 1,
    limit = 20,
  ): Effect.Effect<PaginatedResponse<VideoClipWithCreator>, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const offset = (page - 1) * limit;

        const clipsData = await db
          .select({
            id: videoClips.id,
            videoId: videoClips.videoId,
            organizationId: videoClips.organizationId,
            momentId: videoClips.momentId,
            title: videoClips.title,
            description: videoClips.description,
            startTime: videoClips.startTime,
            endTime: videoClips.endTime,
            clipType: videoClips.clipType,
            momentType: videoClips.momentType,
            storageKey: videoClips.storageKey,
            thumbnailUrl: videoClips.thumbnailUrl,
            status: videoClips.status,
            processingError: videoClips.processingError,
            transcriptExcerpt: videoClips.transcriptExcerpt,
            metadata: videoClips.metadata,
            createdBy: videoClips.createdBy,
            createdAt: videoClips.createdAt,
            updatedAt: videoClips.updatedAt,
            creator: {
              id: users.id,
              name: users.name,
              email: users.email,
              image: users.image,
              emailVerified: users.emailVerified,
              role: users.role,
              createdAt: users.createdAt,
              updatedAt: users.updatedAt,
              banned: users.banned,
              banReason: users.banReason,
              banExpires: users.banExpires,
              twoFactorEnabled: users.twoFactorEnabled,
              lastLoginMethod: users.lastLoginMethod,
            },
          })
          .from(videoClips)
          .leftJoin(users, eq(videoClips.createdBy, users.id))
          .where(eq(videoClips.videoId, videoId))
          .orderBy(asc(videoClips.startTime))
          .offset(offset)
          .limit(limit);

        const totalCount = await db
          .select({ count: sql`count(*)::int` })
          .from(videoClips)
          .where(eq(videoClips.videoId, videoId));

        const total = Number(totalCount[0]?.count ?? 0);

        return {
          data: clipsData as VideoClipWithCreator[],
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        };
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch video clips',
          operation: 'getClips',
          cause: error,
        }),
    });

  const getClipsByOrganization = (
    organizationId: string,
    page = 1,
    limit = 20,
  ): Effect.Effect<PaginatedResponse<VideoClipWithCreator>, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const offset = (page - 1) * limit;

        const clipsData = await db
          .select({
            id: videoClips.id,
            videoId: videoClips.videoId,
            organizationId: videoClips.organizationId,
            momentId: videoClips.momentId,
            title: videoClips.title,
            description: videoClips.description,
            startTime: videoClips.startTime,
            endTime: videoClips.endTime,
            clipType: videoClips.clipType,
            momentType: videoClips.momentType,
            storageKey: videoClips.storageKey,
            thumbnailUrl: videoClips.thumbnailUrl,
            status: videoClips.status,
            processingError: videoClips.processingError,
            transcriptExcerpt: videoClips.transcriptExcerpt,
            metadata: videoClips.metadata,
            createdBy: videoClips.createdBy,
            createdAt: videoClips.createdAt,
            updatedAt: videoClips.updatedAt,
            creator: {
              id: users.id,
              name: users.name,
              email: users.email,
              image: users.image,
              emailVerified: users.emailVerified,
              role: users.role,
              createdAt: users.createdAt,
              updatedAt: users.updatedAt,
              banned: users.banned,
              banReason: users.banReason,
              banExpires: users.banExpires,
              twoFactorEnabled: users.twoFactorEnabled,
              lastLoginMethod: users.lastLoginMethod,
            },
          })
          .from(videoClips)
          .leftJoin(users, eq(videoClips.createdBy, users.id))
          .where(eq(videoClips.organizationId, organizationId))
          .orderBy(desc(videoClips.createdAt))
          .offset(offset)
          .limit(limit);

        const totalCount = await db
          .select({ count: sql`count(*)::int` })
          .from(videoClips)
          .where(eq(videoClips.organizationId, organizationId));

        const total = Number(totalCount[0]?.count ?? 0);

        return {
          data: clipsData as VideoClipWithCreator[],
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        };
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch organization clips',
          operation: 'getClipsByOrganization',
          cause: error,
        }),
    });

  const getClip = (id: string): Effect.Effect<VideoClipWithCreator, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const clipData = yield* Effect.tryPromise({
        try: async () => {
          return await db
            .select({
              id: videoClips.id,
              videoId: videoClips.videoId,
              organizationId: videoClips.organizationId,
              momentId: videoClips.momentId,
              title: videoClips.title,
              description: videoClips.description,
              startTime: videoClips.startTime,
              endTime: videoClips.endTime,
              clipType: videoClips.clipType,
              momentType: videoClips.momentType,
              storageKey: videoClips.storageKey,
              thumbnailUrl: videoClips.thumbnailUrl,
              status: videoClips.status,
              processingError: videoClips.processingError,
              transcriptExcerpt: videoClips.transcriptExcerpt,
              metadata: videoClips.metadata,
              createdBy: videoClips.createdBy,
              createdAt: videoClips.createdAt,
              updatedAt: videoClips.updatedAt,
              creator: {
                id: users.id,
                name: users.name,
                email: users.email,
                image: users.image,
                emailVerified: users.emailVerified,
                role: users.role,
                createdAt: users.createdAt,
                updatedAt: users.updatedAt,
                banned: users.banned,
                banReason: users.banReason,
                banExpires: users.banExpires,
                twoFactorEnabled: users.twoFactorEnabled,
                lastLoginMethod: users.lastLoginMethod,
              },
            })
            .from(videoClips)
            .leftJoin(users, eq(videoClips.createdBy, users.id))
            .where(eq(videoClips.id, id))
            .limit(1);
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to fetch clip',
            operation: 'getClip',
            cause: error,
          }),
      });

      if (!clipData.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Clip not found',
            entity: 'VideoClip',
            id,
          }),
        );
      }

      return clipData[0] as VideoClipWithCreator;
    });

  const createClip = (data: CreateClipInput): Effect.Effect<VideoClipWithCreator, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const [clip] = await db.insert(videoClips).values(data).returning();

        // Fetch with creator
        const [clipWithCreator] = await db
          .select({
            id: videoClips.id,
            videoId: videoClips.videoId,
            organizationId: videoClips.organizationId,
            momentId: videoClips.momentId,
            title: videoClips.title,
            description: videoClips.description,
            startTime: videoClips.startTime,
            endTime: videoClips.endTime,
            clipType: videoClips.clipType,
            momentType: videoClips.momentType,
            storageKey: videoClips.storageKey,
            thumbnailUrl: videoClips.thumbnailUrl,
            status: videoClips.status,
            processingError: videoClips.processingError,
            transcriptExcerpt: videoClips.transcriptExcerpt,
            metadata: videoClips.metadata,
            createdBy: videoClips.createdBy,
            createdAt: videoClips.createdAt,
            updatedAt: videoClips.updatedAt,
            creator: {
              id: users.id,
              name: users.name,
              email: users.email,
              image: users.image,
              emailVerified: users.emailVerified,
              role: users.role,
              createdAt: users.createdAt,
              updatedAt: users.updatedAt,
              banned: users.banned,
              banReason: users.banReason,
              banExpires: users.banExpires,
              twoFactorEnabled: users.twoFactorEnabled,
              lastLoginMethod: users.lastLoginMethod,
            },
          })
          .from(videoClips)
          .leftJoin(users, eq(videoClips.createdBy, users.id))
          .where(eq(videoClips.id, clip.id))
          .limit(1);

        return clipWithCreator as VideoClipWithCreator;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to create clip',
          operation: 'createClip',
          cause: error,
        }),
    });

  const updateClip = (
    id: string,
    data: UpdateClipInput,
  ): Effect.Effect<VideoClipWithCreator, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          return await db
            .update(videoClips)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(videoClips.id, id))
            .returning();
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to update clip',
            operation: 'updateClip',
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Clip not found',
            entity: 'VideoClip',
            id,
          }),
        );
      }

      // Fetch with creator
      return yield* getClip(id);
    });

  const deleteClip = (id: string): Effect.Effect<void, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      // Get clip to check for storage files
      const clipData = yield* Effect.tryPromise({
        try: async () => {
          return await db.select().from(videoClips).where(eq(videoClips.id, id)).limit(1);
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to fetch clip for deletion',
            operation: 'deleteClip.fetch',
            cause: error,
          }),
      });

      if (!clipData.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Clip not found',
            entity: 'VideoClip',
            id,
          }),
        );
      }

      const clip = clipData[0];

      // Delete storage files if they exist
      if (clip.storageKey) {
        yield* storage.deleteFile(clip.storageKey).pipe(
          Effect.catchAll((error) => {
            console.error(`Failed to delete clip file ${clip.storageKey}:`, error);
            return Effect.void;
          }),
        );
      }

      // Delete the database record
      yield* Effect.tryPromise({
        try: async () => {
          await db.delete(videoClips).where(eq(videoClips.id, id));
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to delete clip',
            operation: 'deleteClip',
            cause: error,
          }),
      });
    });

  // ==========================================================================
  // Highlight Reels
  // ==========================================================================

  const getHighlightReels = (
    organizationId: string,
    page = 1,
    limit = 20,
  ): Effect.Effect<PaginatedResponse<HighlightReelWithCreator>, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const offset = (page - 1) * limit;

        const reelsData = await db
          .select({
            id: highlightReels.id,
            organizationId: highlightReels.organizationId,
            title: highlightReels.title,
            description: highlightReels.description,
            clipIds: highlightReels.clipIds,
            storageKey: highlightReels.storageKey,
            thumbnailUrl: highlightReels.thumbnailUrl,
            duration: highlightReels.duration,
            status: highlightReels.status,
            processingError: highlightReels.processingError,
            config: highlightReels.config,
            createdBy: highlightReels.createdBy,
            createdAt: highlightReels.createdAt,
            updatedAt: highlightReels.updatedAt,
            creator: {
              id: users.id,
              name: users.name,
              email: users.email,
              image: users.image,
              emailVerified: users.emailVerified,
              role: users.role,
              createdAt: users.createdAt,
              updatedAt: users.updatedAt,
              banned: users.banned,
              banReason: users.banReason,
              banExpires: users.banExpires,
              twoFactorEnabled: users.twoFactorEnabled,
              lastLoginMethod: users.lastLoginMethod,
            },
          })
          .from(highlightReels)
          .leftJoin(users, eq(highlightReels.createdBy, users.id))
          .where(eq(highlightReels.organizationId, organizationId))
          .orderBy(desc(highlightReels.createdAt))
          .offset(offset)
          .limit(limit);

        const totalCount = await db
          .select({ count: sql`count(*)::int` })
          .from(highlightReels)
          .where(eq(highlightReels.organizationId, organizationId));

        const total = Number(totalCount[0]?.count ?? 0);

        return {
          data: reelsData as HighlightReelWithCreator[],
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        };
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch highlight reels',
          operation: 'getHighlightReels',
          cause: error,
        }),
    });

  const getHighlightReel = (id: string): Effect.Effect<HighlightReelWithCreator, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const reelData = yield* Effect.tryPromise({
        try: async () => {
          return await db
            .select({
              id: highlightReels.id,
              organizationId: highlightReels.organizationId,
              title: highlightReels.title,
              description: highlightReels.description,
              clipIds: highlightReels.clipIds,
              storageKey: highlightReels.storageKey,
              thumbnailUrl: highlightReels.thumbnailUrl,
              duration: highlightReels.duration,
              status: highlightReels.status,
              processingError: highlightReels.processingError,
              config: highlightReels.config,
              createdBy: highlightReels.createdBy,
              createdAt: highlightReels.createdAt,
              updatedAt: highlightReels.updatedAt,
              creator: {
                id: users.id,
                name: users.name,
                email: users.email,
                image: users.image,
                emailVerified: users.emailVerified,
                role: users.role,
                createdAt: users.createdAt,
                updatedAt: users.updatedAt,
                banned: users.banned,
                banReason: users.banReason,
                banExpires: users.banExpires,
                twoFactorEnabled: users.twoFactorEnabled,
                lastLoginMethod: users.lastLoginMethod,
              },
            })
            .from(highlightReels)
            .leftJoin(users, eq(highlightReels.createdBy, users.id))
            .where(eq(highlightReels.id, id))
            .limit(1);
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to fetch highlight reel',
            operation: 'getHighlightReel',
            cause: error,
          }),
      });

      if (!reelData.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Highlight reel not found',
            entity: 'HighlightReel',
            id,
          }),
        );
      }

      return reelData[0] as HighlightReelWithCreator;
    });

  const createHighlightReel = (
    data: CreateHighlightReelInput,
  ): Effect.Effect<HighlightReelWithCreator, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const [reel] = await db.insert(highlightReels).values(data).returning();

        // Fetch with creator
        const [reelWithCreator] = await db
          .select({
            id: highlightReels.id,
            organizationId: highlightReels.organizationId,
            title: highlightReels.title,
            description: highlightReels.description,
            clipIds: highlightReels.clipIds,
            storageKey: highlightReels.storageKey,
            thumbnailUrl: highlightReels.thumbnailUrl,
            duration: highlightReels.duration,
            status: highlightReels.status,
            processingError: highlightReels.processingError,
            config: highlightReels.config,
            createdBy: highlightReels.createdBy,
            createdAt: highlightReels.createdAt,
            updatedAt: highlightReels.updatedAt,
            creator: {
              id: users.id,
              name: users.name,
              email: users.email,
              image: users.image,
              emailVerified: users.emailVerified,
              role: users.role,
              createdAt: users.createdAt,
              updatedAt: users.updatedAt,
              banned: users.banned,
              banReason: users.banReason,
              banExpires: users.banExpires,
              twoFactorEnabled: users.twoFactorEnabled,
              lastLoginMethod: users.lastLoginMethod,
            },
          })
          .from(highlightReels)
          .leftJoin(users, eq(highlightReels.createdBy, users.id))
          .where(eq(highlightReels.id, reel.id))
          .limit(1);

        return reelWithCreator as HighlightReelWithCreator;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to create highlight reel',
          operation: 'createHighlightReel',
          cause: error,
        }),
    });

  const updateHighlightReel = (
    id: string,
    data: UpdateHighlightReelInput,
  ): Effect.Effect<HighlightReelWithCreator, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          return await db
            .update(highlightReels)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(highlightReels.id, id))
            .returning();
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to update highlight reel',
            operation: 'updateHighlightReel',
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Highlight reel not found',
            entity: 'HighlightReel',
            id,
          }),
        );
      }

      return yield* getHighlightReel(id);
    });

  const deleteHighlightReel = (id: string): Effect.Effect<void, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const reelData = yield* Effect.tryPromise({
        try: async () => {
          return await db.select().from(highlightReels).where(eq(highlightReels.id, id)).limit(1);
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to fetch highlight reel for deletion',
            operation: 'deleteHighlightReel.fetch',
            cause: error,
          }),
      });

      if (!reelData.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Highlight reel not found',
            entity: 'HighlightReel',
            id,
          }),
        );
      }

      const reel = reelData[0];

      // Delete storage files if they exist
      if (reel.storageKey) {
        yield* storage.deleteFile(reel.storageKey).pipe(
          Effect.catchAll((error) => {
            console.error(`Failed to delete highlight reel file ${reel.storageKey}:`, error);
            return Effect.void;
          }),
        );
      }

      yield* Effect.tryPromise({
        try: async () => {
          await db.delete(highlightReels).where(eq(highlightReels.id, id));
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to delete highlight reel',
            operation: 'deleteHighlightReel',
            cause: error,
          }),
      });
    });

  return {
    // Moments
    getMoments,
    getMomentsByType,
    createMoment,
    createMomentsBatch,
    deleteMomentsByVideoId,
    // Clips
    getClips,
    getClipsByOrganization,
    getClip,
    createClip,
    updateClip,
    deleteClip,
    // Highlight Reels
    getHighlightReels,
    getHighlightReel,
    createHighlightReel,
    updateHighlightReel,
    deleteHighlightReel,
  } satisfies ClipRepositoryService;
});

// =============================================================================
// Clip Repository Layer
// =============================================================================

export const ClipRepositoryLive = Layer.effect(ClipRepository, makeClipRepositoryService);

// =============================================================================
// Helper Functions
// =============================================================================

// Moments
export const getMoments = (
  videoId: string,
  minConfidence?: number,
): Effect.Effect<VideoMomentWithVideo[], DatabaseError, ClipRepository> =>
  Effect.gen(function* () {
    const repo = yield* ClipRepository;
    return yield* repo.getMoments(videoId, minConfidence);
  });

export const getMomentsByType = (
  videoId: string,
  momentType: MomentType,
): Effect.Effect<VideoMomentWithVideo[], DatabaseError, ClipRepository> =>
  Effect.gen(function* () {
    const repo = yield* ClipRepository;
    return yield* repo.getMomentsByType(videoId, momentType);
  });

export const createMoment = (
  data: CreateMomentInput,
): Effect.Effect<VideoMomentWithVideo, DatabaseError, ClipRepository> =>
  Effect.gen(function* () {
    const repo = yield* ClipRepository;
    return yield* repo.createMoment(data);
  });

export const createMomentsBatch = (
  data: CreateMomentInput[],
): Effect.Effect<VideoMomentWithVideo[], DatabaseError, ClipRepository> =>
  Effect.gen(function* () {
    const repo = yield* ClipRepository;
    return yield* repo.createMomentsBatch(data);
  });

export const deleteMomentsByVideoId = (videoId: string): Effect.Effect<void, DatabaseError, ClipRepository> =>
  Effect.gen(function* () {
    const repo = yield* ClipRepository;
    return yield* repo.deleteMomentsByVideoId(videoId);
  });

// Clips
export const getClips = (
  videoId: string,
  page?: number,
  limit?: number,
): Effect.Effect<PaginatedResponse<VideoClipWithCreator>, DatabaseError, ClipRepository> =>
  Effect.gen(function* () {
    const repo = yield* ClipRepository;
    return yield* repo.getClips(videoId, page, limit);
  });

export const getClipsByOrganization = (
  organizationId: string,
  page?: number,
  limit?: number,
): Effect.Effect<PaginatedResponse<VideoClipWithCreator>, DatabaseError, ClipRepository> =>
  Effect.gen(function* () {
    const repo = yield* ClipRepository;
    return yield* repo.getClipsByOrganization(organizationId, page, limit);
  });

export const getClip = (
  id: string,
): Effect.Effect<VideoClipWithCreator, DatabaseError | NotFoundError, ClipRepository> =>
  Effect.gen(function* () {
    const repo = yield* ClipRepository;
    return yield* repo.getClip(id);
  });

export const createClip = (data: CreateClipInput): Effect.Effect<VideoClipWithCreator, DatabaseError, ClipRepository> =>
  Effect.gen(function* () {
    const repo = yield* ClipRepository;
    return yield* repo.createClip(data);
  });

export const updateClip = (
  id: string,
  data: UpdateClipInput,
): Effect.Effect<VideoClipWithCreator, DatabaseError | NotFoundError, ClipRepository> =>
  Effect.gen(function* () {
    const repo = yield* ClipRepository;
    return yield* repo.updateClip(id, data);
  });

export const deleteClip = (id: string): Effect.Effect<void, DatabaseError | NotFoundError, ClipRepository> =>
  Effect.gen(function* () {
    const repo = yield* ClipRepository;
    return yield* repo.deleteClip(id);
  });

// Highlight Reels
export const getHighlightReels = (
  organizationId: string,
  page?: number,
  limit?: number,
): Effect.Effect<PaginatedResponse<HighlightReelWithCreator>, DatabaseError, ClipRepository> =>
  Effect.gen(function* () {
    const repo = yield* ClipRepository;
    return yield* repo.getHighlightReels(organizationId, page, limit);
  });

export const getHighlightReel = (
  id: string,
): Effect.Effect<HighlightReelWithCreator, DatabaseError | NotFoundError, ClipRepository> =>
  Effect.gen(function* () {
    const repo = yield* ClipRepository;
    return yield* repo.getHighlightReel(id);
  });

export const createHighlightReel = (
  data: CreateHighlightReelInput,
): Effect.Effect<HighlightReelWithCreator, DatabaseError, ClipRepository> =>
  Effect.gen(function* () {
    const repo = yield* ClipRepository;
    return yield* repo.createHighlightReel(data);
  });

export const updateHighlightReel = (
  id: string,
  data: UpdateHighlightReelInput,
): Effect.Effect<HighlightReelWithCreator, DatabaseError | NotFoundError, ClipRepository> =>
  Effect.gen(function* () {
    const repo = yield* ClipRepository;
    return yield* repo.updateHighlightReel(id, data);
  });

export const deleteHighlightReel = (id: string): Effect.Effect<void, DatabaseError | NotFoundError, ClipRepository> =>
  Effect.gen(function* () {
    const repo = yield* ClipRepository;
    return yield* repo.deleteHighlightReel(id);
  });
