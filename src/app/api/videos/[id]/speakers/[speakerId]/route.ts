/**
 * Individual Speaker API
 *
 * Endpoints for managing a specific speaker in a video,
 * including getting segments and updating speaker details.
 */

import { and, asc, eq } from "drizzle-orm";
import { Effect } from "effect";
import type { NextRequest } from "next/server";
import { createPublicLayer, handleEffectExit } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { speakerProfiles, speakerSegments, videoSpeakers, videos } from "@/lib/db/schema";
import { DatabaseError, NotFoundError } from "@/lib/effect";

// =============================================================================
// GET /api/videos/[id]/speakers/[speakerId] - Get speaker details and segments
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string; speakerId: string }> }) {
  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const { id: videoId, speakerId } = resolvedParams;

    // Check if video exists
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

    // Get the video speaker with profile
    const videoSpeaker = yield* Effect.tryPromise({
      try: () =>
        db.query.videoSpeakers.findFirst({
          where: and(eq(videoSpeakers.id, speakerId), eq(videoSpeakers.videoId, videoId)),
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
        }),
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch speaker",
          operation: "getSpeaker",
          cause: error,
        }),
    });

    if (!videoSpeaker) {
      return yield* Effect.fail(
        new NotFoundError({
          message: "Speaker not found in this video",
          entity: "VideoSpeaker",
          id: speakerId,
        }),
      );
    }

    // Get all segments for this speaker
    const segments = yield* Effect.tryPromise({
      try: () =>
        db.query.speakerSegments.findMany({
          where: eq(speakerSegments.videoSpeakerId, speakerId),
          orderBy: [asc(speakerSegments.startTime)],
        }),
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch segments",
          operation: "getSegments",
          cause: error,
        }),
    });

    return {
      success: true,
      data: {
        id: videoSpeaker.id,
        videoId,
        speakerLabel: videoSpeaker.speakerLabel,
        displayName: videoSpeaker.speakerProfile?.displayName || `Speaker ${videoSpeaker.speakerLabel}`,
        totalSpeakingTime: videoSpeaker.totalSpeakingTime,
        segmentCount: videoSpeaker.segmentCount,
        speakingPercentage: videoSpeaker.speakingPercentage || 0,
        linkedUser: videoSpeaker.speakerProfile?.user
          ? {
              id: videoSpeaker.speakerProfile.user.id,
              name: videoSpeaker.speakerProfile.user.name,
              email: videoSpeaker.speakerProfile.user.email,
              image: videoSpeaker.speakerProfile.user.image,
            }
          : null,
        segments: segments.map((s) => ({
          id: s.id,
          startTime: s.startTime, // milliseconds
          endTime: s.endTime, // milliseconds
          text: s.transcriptText,
          confidence: s.confidence,
        })),
      },
    };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}

// =============================================================================
// DELETE /api/videos/[id]/speakers/[speakerId] - Unlink speaker from user
// =============================================================================

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; speakerId: string }> },
) {
  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const { id: videoId, speakerId } = resolvedParams;

    // Get the video speaker with profile
    const videoSpeaker = yield* Effect.tryPromise({
      try: () =>
        db.query.videoSpeakers.findFirst({
          where: and(eq(videoSpeakers.id, speakerId), eq(videoSpeakers.videoId, videoId)),
        }),
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch speaker",
          operation: "getSpeaker",
          cause: error,
        }),
    });

    if (!videoSpeaker) {
      return yield* Effect.fail(
        new NotFoundError({
          message: "Speaker not found in this video",
          entity: "VideoSpeaker",
          id: speakerId,
        }),
      );
    }

    // Unlink user from speaker profile (keep profile but remove user association)
    const profileId = videoSpeaker.speakerProfileId;
    if (profileId) {
      yield* Effect.tryPromise({
        try: () =>
          db
            .update(speakerProfiles)
            .set({ userId: null, updatedAt: new Date() })
            .where(eq(speakerProfiles.id, profileId)),
        catch: (error) =>
          new DatabaseError({
            message: "Failed to unlink speaker",
            operation: "unlinkSpeaker",
            cause: error,
          }),
      });
    }

    return {
      success: true,
      data: {
        speakerId,
        unlinked: true,
      },
    };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}
