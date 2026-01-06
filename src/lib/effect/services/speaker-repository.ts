/**
 * Speaker Repository Service
 *
 * Provides database operations for speaker profiles, video speakers,
 * speaker segments, and speaker analytics.
 */

import { and, desc, eq, sql } from 'drizzle-orm';
import { Context, Data, Effect, Layer, Option } from 'effect';
import { normalizeOne } from '@/lib/db/relations';
import type {
  NewSpeakerProfile,
  NewSpeakerSegmentRow,
  NewVideoSpeaker,
  SpeakerProfile,
  SpeakerSegmentRow,
  VideoSpeaker,
} from '@/lib/db/schema';
import { speakerAnalytics, speakerProfiles, speakerSegments, videoSpeakers, videos } from '@/lib/db/schema';
import { Database } from './database';

// =============================================================================
// Error Types
// =============================================================================

export class SpeakerRepositoryError extends Data.TaggedError('SpeakerRepositoryError')<{
  readonly message: string;
  readonly operation?: string;
  readonly cause?: unknown;
}> {}

// =============================================================================
// Types
// =============================================================================

export interface CreateSpeakerProfileInput {
  readonly organizationId: string;
  readonly displayName: string;
  readonly userId?: string;
  readonly metadata?: {
    readonly jobTitle?: string;
    readonly department?: string;
    readonly avatarUrl?: string;
  };
}

export interface UpdateSpeakerProfileInput {
  readonly displayName?: string;
  readonly userId?: string;
  readonly metadata?: {
    readonly jobTitle?: string;
    readonly department?: string;
    readonly avatarUrl?: string;
  };
}

export interface CreateVideoSpeakerInput {
  readonly videoId: string;
  readonly speakerLabel: string;
  readonly speakerProfileId?: string;
  readonly totalSpeakingTime?: number;
  readonly segmentCount?: number;
  readonly speakingPercentage?: number;
}

export interface CreateSpeakerSegmentInput {
  readonly videoId: string;
  readonly videoSpeakerId: string;
  readonly startTime: number; // milliseconds
  readonly endTime: number; // milliseconds
  readonly transcriptText?: string;
  readonly confidence?: number;
}

export interface VideoSpeakerWithProfile extends VideoSpeaker {
  readonly speakerProfile: SpeakerProfile | null;
}

export interface SpeakerProfileWithUser extends SpeakerProfile {
  readonly user: {
    readonly id: string;
    readonly name: string;
    readonly email: string;
    readonly image: string | null;
  } | null;
}

export interface TalkTimeDistribution {
  readonly videoId: string;
  readonly duration: number;
  readonly speakers: ReadonlyArray<{
    readonly speakerId: string;
    readonly speakerLabel: string;
    readonly displayName: string | null;
    readonly userId: string | null;
    readonly totalSpeakingTime: number;
    readonly speakingPercentage: number;
    readonly segmentCount: number;
  }>;
  readonly balanceScore: number;
}

export interface SpeakerTrend {
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly videoCount: number;
  readonly totalSpeakingTime: number;
  readonly avgSpeakingPercentage: number;
}

export interface SpeakerRepositoryService {
  // Speaker Profiles
  readonly createSpeakerProfile: (
    input: CreateSpeakerProfileInput,
  ) => Effect.Effect<SpeakerProfile, SpeakerRepositoryError>;

  readonly getSpeakerProfile: (id: string) => Effect.Effect<Option.Option<SpeakerProfile>, SpeakerRepositoryError>;

  readonly getSpeakerProfiles: (organizationId: string) => Effect.Effect<SpeakerProfile[], SpeakerRepositoryError>;

  readonly getSpeakerProfilesWithUsers: (
    organizationId: string,
  ) => Effect.Effect<SpeakerProfileWithUser[], SpeakerRepositoryError>;

  readonly updateSpeakerProfile: (
    id: string,
    input: UpdateSpeakerProfileInput,
  ) => Effect.Effect<SpeakerProfile, SpeakerRepositoryError>;

  readonly deleteSpeakerProfile: (id: string) => Effect.Effect<void, SpeakerRepositoryError>;

  readonly linkSpeakerToUser: (profileId: string, userId: string) => Effect.Effect<void, SpeakerRepositoryError>;

  // Video Speakers
  readonly createVideoSpeaker: (input: CreateVideoSpeakerInput) => Effect.Effect<VideoSpeaker, SpeakerRepositoryError>;

  readonly createVideoSpeakers: (
    inputs: CreateVideoSpeakerInput[],
  ) => Effect.Effect<VideoSpeaker[], SpeakerRepositoryError>;

  readonly getVideoSpeakers: (videoId: string) => Effect.Effect<VideoSpeakerWithProfile[], SpeakerRepositoryError>;

  readonly linkVideoSpeakerToProfile: (
    videoSpeakerId: string,
    speakerProfileId: string,
  ) => Effect.Effect<void, SpeakerRepositoryError>;

  readonly updateVideoSpeakerLabel: (
    videoSpeakerId: string,
    newLabel: string,
  ) => Effect.Effect<void, SpeakerRepositoryError>;

  // Speaker Segments
  readonly createSpeakerSegments: (
    inputs: CreateSpeakerSegmentInput[],
  ) => Effect.Effect<SpeakerSegmentRow[], SpeakerRepositoryError>;

  readonly getSpeakerSegments: (
    videoId: string,
    speakerId?: string,
  ) => Effect.Effect<SpeakerSegmentRow[], SpeakerRepositoryError>;

  readonly getSpeakerSegmentsByTimeRange: (
    videoId: string,
    startTime: number,
    endTime: number,
  ) => Effect.Effect<SpeakerSegmentRow[], SpeakerRepositoryError>;

  // Analytics
  readonly getTalkTimeDistribution: (
    videoId: string,
  ) => Effect.Effect<Option.Option<TalkTimeDistribution>, SpeakerRepositoryError>;

  readonly getSpeakerTrends: (
    speakerProfileId: string,
    limit?: number,
  ) => Effect.Effect<SpeakerTrend[], SpeakerRepositoryError>;

  readonly getOrganizationSpeakerStats: (
    organizationId: string,
    options?: { startDate?: Date; endDate?: Date },
  ) => Effect.Effect<
    Array<{
      speakerId: string;
      displayName: string;
      userId: string | null;
      videoCount: number;
      totalSpeakingTime: number;
      avgSpeakingPercentage: number;
    }>,
    SpeakerRepositoryError
  >;

  // Cleanup
  readonly deleteVideoSpeakerData: (videoId: string) => Effect.Effect<void, SpeakerRepositoryError>;
}

// =============================================================================
// Speaker Repository Tag
// =============================================================================

export class SpeakerRepository extends Context.Tag('SpeakerRepository')<
  SpeakerRepository,
  SpeakerRepositoryService
>() {}

// =============================================================================
// Implementation
// =============================================================================

const makeService = Effect.gen(function* () {
  const { db } = yield* Database;

  // ==========================================================================
  // Speaker Profiles
  // ==========================================================================

  const createSpeakerProfile = (
    input: CreateSpeakerProfileInput,
  ): Effect.Effect<SpeakerProfile, SpeakerRepositoryError> =>
    Effect.tryPromise({
      try: async () => {
        const [profile] = await db
          .insert(speakerProfiles)
          .values({
            organizationId: input.organizationId,
            displayName: input.displayName,
            userId: input.userId,
            metadata: input.metadata,
          } satisfies NewSpeakerProfile)
          .returning();
        return profile;
      },
      catch: (error) =>
        new SpeakerRepositoryError({
          message: 'Failed to create speaker profile',
          operation: 'createSpeakerProfile',
          cause: error,
        }),
    });

  const getSpeakerProfile = (id: string): Effect.Effect<Option.Option<SpeakerProfile>, SpeakerRepositoryError> =>
    Effect.tryPromise({
      try: async () => {
        const profile = await db.query.speakerProfiles.findFirst({
          where: eq(speakerProfiles.id, id),
        });
        return profile ? Option.some(profile) : Option.none();
      },
      catch: (error) =>
        new SpeakerRepositoryError({
          message: 'Failed to get speaker profile',
          operation: 'getSpeakerProfile',
          cause: error,
        }),
    });

  const getSpeakerProfiles = (organizationId: string): Effect.Effect<SpeakerProfile[], SpeakerRepositoryError> =>
    Effect.tryPromise({
      try: async () => {
        return await db.query.speakerProfiles.findMany({
          where: eq(speakerProfiles.organizationId, organizationId),
          orderBy: [desc(speakerProfiles.createdAt)],
        });
      },
      catch: (error) =>
        new SpeakerRepositoryError({
          message: 'Failed to get speaker profiles',
          operation: 'getSpeakerProfiles',
          cause: error,
        }),
    });

  const getSpeakerProfilesWithUsers = (
    organizationId: string,
  ): Effect.Effect<SpeakerProfileWithUser[], SpeakerRepositoryError> =>
    Effect.tryPromise({
      try: async () => {
        const profiles = await db.query.speakerProfiles.findMany({
          where: eq(speakerProfiles.organizationId, organizationId),
          with: {
            user: {
              columns: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
          orderBy: [desc(speakerProfiles.createdAt)],
        });
        return profiles as SpeakerProfileWithUser[];
      },
      catch: (error) =>
        new SpeakerRepositoryError({
          message: 'Failed to get speaker profiles with users',
          operation: 'getSpeakerProfilesWithUsers',
          cause: error,
        }),
    });

  const updateSpeakerProfile = (
    id: string,
    input: UpdateSpeakerProfileInput,
  ): Effect.Effect<SpeakerProfile, SpeakerRepositoryError> =>
    Effect.tryPromise({
      try: async () => {
        const [profile] = await db
          .update(speakerProfiles)
          .set({
            ...input,
            updatedAt: new Date(),
          })
          .where(eq(speakerProfiles.id, id))
          .returning();
        return profile;
      },
      catch: (error) =>
        new SpeakerRepositoryError({
          message: 'Failed to update speaker profile',
          operation: 'updateSpeakerProfile',
          cause: error,
        }),
    });

  const deleteSpeakerProfile = (id: string): Effect.Effect<void, SpeakerRepositoryError> =>
    Effect.tryPromise({
      try: async () => {
        await db.delete(speakerProfiles).where(eq(speakerProfiles.id, id));
      },
      catch: (error) =>
        new SpeakerRepositoryError({
          message: 'Failed to delete speaker profile',
          operation: 'deleteSpeakerProfile',
          cause: error,
        }),
    });

  const linkSpeakerToUser = (profileId: string, userId: string): Effect.Effect<void, SpeakerRepositoryError> =>
    Effect.tryPromise({
      try: async () => {
        await db
          .update(speakerProfiles)
          .set({ userId, updatedAt: new Date() })
          .where(eq(speakerProfiles.id, profileId));
      },
      catch: (error) =>
        new SpeakerRepositoryError({
          message: 'Failed to link speaker to user',
          operation: 'linkSpeakerToUser',
          cause: error,
        }),
    });

  // ==========================================================================
  // Video Speakers
  // ==========================================================================

  const createVideoSpeaker = (input: CreateVideoSpeakerInput): Effect.Effect<VideoSpeaker, SpeakerRepositoryError> =>
    Effect.tryPromise({
      try: async () => {
        const [speaker] = await db
          .insert(videoSpeakers)
          .values({
            videoId: input.videoId,
            speakerLabel: input.speakerLabel,
            speakerProfileId: input.speakerProfileId,
            totalSpeakingTime: input.totalSpeakingTime ?? 0,
            segmentCount: input.segmentCount ?? 0,
            speakingPercentage: input.speakingPercentage,
          } satisfies NewVideoSpeaker)
          .returning();
        return speaker;
      },
      catch: (error) =>
        new SpeakerRepositoryError({
          message: 'Failed to create video speaker',
          operation: 'createVideoSpeaker',
          cause: error,
        }),
    });

  const createVideoSpeakers = (
    inputs: CreateVideoSpeakerInput[],
  ): Effect.Effect<VideoSpeaker[], SpeakerRepositoryError> =>
    Effect.tryPromise({
      try: async () => {
        if (inputs.length === 0) return [];
        const speakers = await db
          .insert(videoSpeakers)
          .values(
            inputs.map((input) => ({
              videoId: input.videoId,
              speakerLabel: input.speakerLabel,
              speakerProfileId: input.speakerProfileId,
              totalSpeakingTime: input.totalSpeakingTime ?? 0,
              segmentCount: input.segmentCount ?? 0,
              speakingPercentage: input.speakingPercentage,
            })),
          )
          .returning();
        return speakers;
      },
      catch: (error) =>
        new SpeakerRepositoryError({
          message: 'Failed to create video speakers',
          operation: 'createVideoSpeakers',
          cause: error,
        }),
    });

  const getVideoSpeakers = (videoId: string): Effect.Effect<VideoSpeakerWithProfile[], SpeakerRepositoryError> =>
    Effect.tryPromise({
      try: async () => {
        const speakers = await db.query.videoSpeakers.findMany({
          where: eq(videoSpeakers.videoId, videoId),
          with: {
            speakerProfile: true,
          },
          orderBy: [desc(videoSpeakers.totalSpeakingTime)],
        });
        return speakers as VideoSpeakerWithProfile[];
      },
      catch: (error) =>
        new SpeakerRepositoryError({
          message: 'Failed to get video speakers',
          operation: 'getVideoSpeakers',
          cause: error,
        }),
    });

  const linkVideoSpeakerToProfile = (
    videoSpeakerId: string,
    speakerProfileId: string,
  ): Effect.Effect<void, SpeakerRepositoryError> =>
    Effect.tryPromise({
      try: async () => {
        await db
          .update(videoSpeakers)
          .set({ speakerProfileId, updatedAt: new Date() })
          .where(eq(videoSpeakers.id, videoSpeakerId));
      },
      catch: (error) =>
        new SpeakerRepositoryError({
          message: 'Failed to link video speaker to profile',
          operation: 'linkVideoSpeakerToProfile',
          cause: error,
        }),
    });

  const updateVideoSpeakerLabel = (
    videoSpeakerId: string,
    newLabel: string,
  ): Effect.Effect<void, SpeakerRepositoryError> =>
    Effect.tryPromise({
      try: async () => {
        await db
          .update(videoSpeakers)
          .set({ speakerLabel: newLabel, updatedAt: new Date() })
          .where(eq(videoSpeakers.id, videoSpeakerId));
      },
      catch: (error) =>
        new SpeakerRepositoryError({
          message: 'Failed to update video speaker label',
          operation: 'updateVideoSpeakerLabel',
          cause: error,
        }),
    });

  // ==========================================================================
  // Speaker Segments
  // ==========================================================================

  const createSpeakerSegments = (
    inputs: CreateSpeakerSegmentInput[],
  ): Effect.Effect<SpeakerSegmentRow[], SpeakerRepositoryError> =>
    Effect.tryPromise({
      try: async () => {
        if (inputs.length === 0) return [];
        const segments = await db
          .insert(speakerSegments)
          .values(
            inputs.map(
              (input) =>
                ({
                  videoId: input.videoId,
                  videoSpeakerId: input.videoSpeakerId,
                  startTime: input.startTime,
                  endTime: input.endTime,
                  transcriptText: input.transcriptText,
                  confidence: input.confidence,
                }) satisfies NewSpeakerSegmentRow,
            ),
          )
          .returning();
        return segments;
      },
      catch: (error) =>
        new SpeakerRepositoryError({
          message: 'Failed to create speaker segments',
          operation: 'createSpeakerSegments',
          cause: error,
        }),
    });

  const getSpeakerSegments = (
    videoId: string,
    speakerId?: string,
  ): Effect.Effect<SpeakerSegmentRow[], SpeakerRepositoryError> =>
    Effect.tryPromise({
      try: async () => {
        const conditions = [eq(speakerSegments.videoId, videoId)];
        if (speakerId) {
          conditions.push(eq(speakerSegments.videoSpeakerId, speakerId));
        }
        return await db.query.speakerSegments.findMany({
          where: and(...conditions),
          orderBy: [speakerSegments.startTime],
        });
      },
      catch: (error) =>
        new SpeakerRepositoryError({
          message: 'Failed to get speaker segments',
          operation: 'getSpeakerSegments',
          cause: error,
        }),
    });

  const getSpeakerSegmentsByTimeRange = (
    videoId: string,
    startTime: number,
    endTime: number,
  ): Effect.Effect<SpeakerSegmentRow[], SpeakerRepositoryError> =>
    Effect.tryPromise({
      try: async () => {
        return await db.query.speakerSegments.findMany({
          where: and(
            eq(speakerSegments.videoId, videoId),
            sql`${speakerSegments.startTime} >= ${startTime}`,
            sql`${speakerSegments.endTime} <= ${endTime}`,
          ),
          orderBy: [speakerSegments.startTime],
        });
      },
      catch: (error) =>
        new SpeakerRepositoryError({
          message: 'Failed to get speaker segments by time range',
          operation: 'getSpeakerSegmentsByTimeRange',
          cause: error,
        }),
    });

  // ==========================================================================
  // Analytics
  // ==========================================================================

  const getTalkTimeDistribution = (
    videoId: string,
  ): Effect.Effect<Option.Option<TalkTimeDistribution>, SpeakerRepositoryError> =>
    Effect.tryPromise({
      try: async () => {
        // Get video duration
        const video = await db.query.videos.findFirst({
          where: eq(videos.id, videoId),
          columns: { duration: true },
        });

        if (!video) {
          return Option.none();
        }

        // Get speakers with profile info
        const speakers = await db.query.videoSpeakers.findMany({
          where: eq(videoSpeakers.videoId, videoId),
          with: {
            speakerProfile: true,
          },
          orderBy: [desc(videoSpeakers.totalSpeakingTime)],
        });

        if (speakers.length === 0) {
          return Option.none();
        }

        // Calculate balance score
        const percentages = speakers.map((s) => s.speakingPercentage || 0);
        const idealPercentage = 100 / speakers.length;
        const totalDeviation = percentages.reduce((sum, p) => sum + Math.abs(p - idealPercentage), 0);
        const maxDeviation = 2 * (100 - idealPercentage);
        const balanceScore = Math.max(0, Math.round(100 - (totalDeviation / maxDeviation) * 100));

        return Option.some({
          videoId,
          duration: Number.parseInt(video.duration, 10) * 1000, // Convert to ms
          speakers: speakers.map((s) => {
            const speakerProfile = normalizeOne(s.speakerProfile);

            return {
              speakerId: s.id,
              speakerLabel: s.speakerLabel,
              displayName: speakerProfile?.displayName || null,
              userId: speakerProfile?.userId || null,
              totalSpeakingTime: s.totalSpeakingTime,
              speakingPercentage: s.speakingPercentage || 0,
              segmentCount: s.segmentCount,
            };
          }),
          balanceScore,
        });
      },
      catch: (error) =>
        new SpeakerRepositoryError({
          message: 'Failed to get talk time distribution',
          operation: 'getTalkTimeDistribution',
          cause: error,
        }),
    });

  const getSpeakerTrends = (
    speakerProfileId: string,
    limit = 12,
  ): Effect.Effect<SpeakerTrend[], SpeakerRepositoryError> =>
    Effect.tryPromise({
      try: async () => {
        const analytics = await db.query.speakerAnalytics.findMany({
          where: eq(speakerAnalytics.speakerProfileId, speakerProfileId),
          orderBy: [desc(speakerAnalytics.periodStart)],
          limit,
        });
        return analytics.map((a) => ({
          periodStart: a.periodStart,
          periodEnd: a.periodEnd,
          videoCount: a.videoCount,
          totalSpeakingTime: a.totalSpeakingTime,
          avgSpeakingPercentage: a.avgSpeakingPercentage || 0,
        }));
      },
      catch: (error) =>
        new SpeakerRepositoryError({
          message: 'Failed to get speaker trends',
          operation: 'getSpeakerTrends',
          cause: error,
        }),
    });

  const getOrganizationSpeakerStats = (
    organizationId: string,
    _options?: { startDate?: Date; endDate?: Date },
  ): Effect.Effect<
    Array<{
      speakerId: string;
      displayName: string;
      userId: string | null;
      videoCount: number;
      totalSpeakingTime: number;
      avgSpeakingPercentage: number;
    }>,
    SpeakerRepositoryError
  > =>
    Effect.tryPromise({
      try: async () => {
        // Get all speaker profiles for the organization
        const profiles = await db.query.speakerProfiles.findMany({
          where: eq(speakerProfiles.organizationId, organizationId),
        });

        const profileIds = profiles.map((p) => p.id);
        if (profileIds.length === 0) return [];

        // Get aggregated video speaker stats for each profile
        const results = await Promise.all(
          profiles.map(async (profile) => {
            const videoSpeakerRecords = await db.query.videoSpeakers.findMany({
              where: eq(videoSpeakers.speakerProfileId, profile.id),
            });

            const videoCount = videoSpeakerRecords.length;
            const totalSpeakingTime = videoSpeakerRecords.reduce((sum, vs) => sum + vs.totalSpeakingTime, 0);
            const avgSpeakingPercentage =
              videoCount > 0
                ? Math.round(
                    videoSpeakerRecords.reduce((sum, vs) => sum + (vs.speakingPercentage || 0), 0) / videoCount,
                  )
                : 0;

            return {
              speakerId: profile.id,
              displayName: profile.displayName,
              userId: profile.userId,
              videoCount,
              totalSpeakingTime,
              avgSpeakingPercentage,
            };
          }),
        );

        // Sort by total speaking time descending
        return results.sort((a, b) => b.totalSpeakingTime - a.totalSpeakingTime);
      },
      catch: (error) =>
        new SpeakerRepositoryError({
          message: 'Failed to get organization speaker stats',
          operation: 'getOrganizationSpeakerStats',
          cause: error,
        }),
    });

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  const deleteVideoSpeakerData = (videoId: string): Effect.Effect<void, SpeakerRepositoryError> =>
    Effect.tryPromise({
      try: async () => {
        // Cascade will handle speakerSegments, but we delete explicitly for clarity
        await db.delete(speakerSegments).where(eq(speakerSegments.videoId, videoId));
        await db.delete(videoSpeakers).where(eq(videoSpeakers.videoId, videoId));
      },
      catch: (error) =>
        new SpeakerRepositoryError({
          message: 'Failed to delete video speaker data',
          operation: 'deleteVideoSpeakerData',
          cause: error,
        }),
    });

  return {
    createSpeakerProfile,
    getSpeakerProfile,
    getSpeakerProfiles,
    getSpeakerProfilesWithUsers,
    updateSpeakerProfile,
    deleteSpeakerProfile,
    linkSpeakerToUser,
    createVideoSpeaker,
    createVideoSpeakers,
    getVideoSpeakers,
    linkVideoSpeakerToProfile,
    updateVideoSpeakerLabel,
    createSpeakerSegments,
    getSpeakerSegments,
    getSpeakerSegmentsByTimeRange,
    getTalkTimeDistribution,
    getSpeakerTrends,
    getOrganizationSpeakerStats,
    deleteVideoSpeakerData,
  } satisfies SpeakerRepositoryService;
});

// =============================================================================
// Layer
// =============================================================================

export const SpeakerRepositoryLive = Layer.effect(SpeakerRepository, makeService);

// =============================================================================
// Helper Functions
// =============================================================================

export const createSpeakerProfile = (
  input: CreateSpeakerProfileInput,
): Effect.Effect<SpeakerProfile, SpeakerRepositoryError, SpeakerRepository> =>
  Effect.flatMap(SpeakerRepository, (repo) => repo.createSpeakerProfile(input));

export const getSpeakerProfile = (
  id: string,
): Effect.Effect<Option.Option<SpeakerProfile>, SpeakerRepositoryError, SpeakerRepository> =>
  Effect.flatMap(SpeakerRepository, (repo) => repo.getSpeakerProfile(id));

export const getSpeakerProfiles = (
  organizationId: string,
): Effect.Effect<SpeakerProfile[], SpeakerRepositoryError, SpeakerRepository> =>
  Effect.flatMap(SpeakerRepository, (repo) => repo.getSpeakerProfiles(organizationId));

export const getVideoSpeakers = (
  videoId: string,
): Effect.Effect<VideoSpeakerWithProfile[], SpeakerRepositoryError, SpeakerRepository> =>
  Effect.flatMap(SpeakerRepository, (repo) => repo.getVideoSpeakers(videoId));

export const getTalkTimeDistribution = (
  videoId: string,
): Effect.Effect<Option.Option<TalkTimeDistribution>, SpeakerRepositoryError, SpeakerRepository> =>
  Effect.flatMap(SpeakerRepository, (repo) => repo.getTalkTimeDistribution(videoId));

export const linkVideoSpeakerToProfile = (
  videoSpeakerId: string,
  speakerProfileId: string,
): Effect.Effect<void, SpeakerRepositoryError, SpeakerRepository> =>
  Effect.flatMap(SpeakerRepository, (repo) => repo.linkVideoSpeakerToProfile(videoSpeakerId, speakerProfileId));
