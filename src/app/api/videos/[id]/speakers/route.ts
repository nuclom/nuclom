/**
 * Video Speakers API
 *
 * Endpoints for managing speakers in a video, including listing speakers,
 * getting talk time distribution, and linking speakers to org members.
 */

import { desc, eq } from "drizzle-orm";
import { Effect, Schema } from "effect";
import type { NextRequest } from "next/server";
import { createPublicLayer, handleEffectExit } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { normalizeOne } from "@/lib/db/relations";
import { speakerProfiles, videoSpeakers, videos } from "@/lib/db/schema";
import { DatabaseError, NotFoundError } from "@/lib/effect";
import { validateRequestBody } from "@/lib/validation";

// =============================================================================
// GET /api/videos/[id]/speakers - Get speakers in a video with talk time stats
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const videoId = resolvedParams.id;

    // Check if video exists and get duration
    const video = yield* Effect.tryPromise({
      try: () =>
        db.query.videos.findFirst({
          where: eq(videos.id, videoId),
          columns: { id: true, duration: true },
        }),
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch video",
          operation: "getVideo",
          cause: error,
        }),
    });

    if (!video) {
      return yield* Effect.fail(
        new NotFoundError({
          message: "Video not found",
          entity: "Video",
          id: videoId,
        }),
      );
    }

    // Get speakers with their profiles
    const speakers = yield* Effect.tryPromise({
      try: () =>
        db.query.videoSpeakers.findMany({
          where: eq(videoSpeakers.videoId, videoId),
          with: {
            speakerProfile: {
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
            },
          },
          orderBy: [desc(videoSpeakers.totalSpeakingTime)],
        }),
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch speakers",
          operation: "getSpeakers",
          cause: error,
        }),
    });

    // Calculate balance score
    const percentages = speakers.map((s) => s.speakingPercentage || 0);
    const speakerCount = speakers.length;
    let balanceScore = 100;

    if (speakerCount > 1) {
      const idealPercentage = 100 / speakerCount;
      const totalDeviation = percentages.reduce((sum, p) => sum + Math.abs(p - idealPercentage), 0);
      const maxDeviation = 2 * (100 - idealPercentage);
      balanceScore = Math.max(0, Math.round(100 - (totalDeviation / maxDeviation) * 100));
    }

    return {
      success: true,
      data: {
        videoId,
        duration: video.duration,
        speakerCount,
        speakers: speakers.map((s) => {
          const speakerProfile = normalizeOne(s.speakerProfile);
          const linkedUser = normalizeOne(speakerProfile?.user);

          return {
            id: s.id,
            speakerLabel: s.speakerLabel,
            displayName: speakerProfile?.displayName || `Speaker ${s.speakerLabel}`,
            totalSpeakingTime: s.totalSpeakingTime,
            segmentCount: s.segmentCount,
            speakingPercentage: s.speakingPercentage || 0,
            linkedUser: linkedUser
              ? {
                  id: linkedUser.id,
                  name: linkedUser.name,
                  email: linkedUser.email,
                  image: linkedUser.image,
                }
              : null,
            speakerProfileId: s.speakerProfileId,
          };
        }),
        balanceScore,
      },
    };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}

// =============================================================================
// PATCH /api/videos/[id]/speakers - Update speaker label or link to profile
// =============================================================================

const UpdateSpeakerRequestSchema = Schema.Struct({
  speakerId: Schema.String,
  displayName: Schema.optional(Schema.String),
  userId: Schema.optional(Schema.String),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const videoId = resolvedParams.id;

    // Parse request body
    const body = yield* validateRequestBody(UpdateSpeakerRequestSchema, request);

    const { speakerId, displayName, userId } = body;

    if (!speakerId) {
      return yield* Effect.fail(
        new DatabaseError({
          message: "speakerId is required",
          operation: "validateInput",
        }),
      );
    }

    // Get the video speaker record
    const videoSpeaker = yield* Effect.tryPromise({
      try: () =>
        db.query.videoSpeakers.findFirst({
          where: eq(videoSpeakers.id, speakerId),
          with: {
            speakerProfile: true,
          },
        }),
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch speaker",
          operation: "getSpeaker",
          cause: error,
        }),
    });

    if (!videoSpeaker || videoSpeaker.videoId !== videoId) {
      return yield* Effect.fail(
        new NotFoundError({
          message: "Speaker not found in this video",
          entity: "VideoSpeaker",
          id: speakerId,
        }),
      );
    }

    // Update speaker profile if it exists
    const profileId = videoSpeaker.speakerProfileId;
    if (profileId) {
      const updates: { displayName?: string; userId?: string; updatedAt: Date } = {
        updatedAt: new Date(),
      };

      if (displayName) {
        updates.displayName = displayName;
      }
      if (userId) {
        updates.userId = userId;
      }

      yield* Effect.tryPromise({
        try: () => db.update(speakerProfiles).set(updates).where(eq(speakerProfiles.id, profileId)),
        catch: (error) =>
          new DatabaseError({
            message: "Failed to update speaker profile",
            operation: "updateProfile",
            cause: error,
          }),
      });
    }

    return {
      success: true,
      data: {
        speakerId,
        updated: true,
      },
    };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}
