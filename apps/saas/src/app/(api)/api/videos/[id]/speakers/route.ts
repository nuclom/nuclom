/**
 * Video Speakers API
 *
 * Endpoints for managing speakers in a video, including listing speakers,
 * getting talk time distribution, and linking speakers to org members.
 */

import { handleEffectExit, runApiEffect } from '@nuclom/lib/api-handler';
import { normalizeOne } from '@nuclom/lib/db/relations';
import { DatabaseError, NotFoundError } from '@nuclom/lib/effect/errors';
import { SpeakerRepository } from '@nuclom/lib/effect/services/speaker-repository';
import { VideoRepository } from '@nuclom/lib/effect/services/video-repository';
import { validateRequestBody } from '@nuclom/lib/validation';
import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// GET /api/videos/[id]/speakers - Get speakers in a video with talk time stats
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const videoId = resolvedParams.id;

    // Check if video exists and get duration using repository
    const videoRepo = yield* VideoRepository;
    const video = yield* videoRepo.getVideo(videoId);

    // Get speakers with their profiles using repository
    const speakerRepo = yield* SpeakerRepository;
    const speakers = yield* speakerRepo.getVideoSpeakers(videoId);

    // Sort by total speaking time (descending)
    const sortedSpeakers = [...speakers].sort((a, b) => (b.totalSpeakingTime || 0) - (a.totalSpeakingTime || 0));

    // Calculate balance score
    const percentages = sortedSpeakers.map((s) => s.speakingPercentage || 0);
    const speakerCount = sortedSpeakers.length;
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
        speakers: sortedSpeakers.map((s) => {
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

  const exit = await runApiEffect(effect);
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
          message: 'speakerId is required',
          operation: 'validateInput',
        }),
      );
    }

    // Get the video speakers using repository
    const speakerRepo = yield* SpeakerRepository;
    const videoSpeakers = yield* speakerRepo.getVideoSpeakers(videoId);

    const videoSpeaker = videoSpeakers.find((s) => s.id === speakerId);

    if (!videoSpeaker) {
      return yield* Effect.fail(
        new NotFoundError({
          message: 'Speaker not found in this video',
          entity: 'VideoSpeaker',
          id: speakerId,
        }),
      );
    }

    // Update speaker profile if it exists
    const profileId = videoSpeaker.speakerProfileId;
    if (profileId) {
      const updates: { displayName?: string; userId?: string } = {};

      if (displayName) {
        updates.displayName = displayName;
      }
      if (userId) {
        updates.userId = userId;
      }

      if (Object.keys(updates).length > 0) {
        yield* speakerRepo.updateSpeakerProfile(profileId, updates);
      }
    }

    return {
      success: true,
      data: {
        speakerId,
        updated: true,
      },
    };
  });

  const exit = await runApiEffect(effect);
  return handleEffectExit(exit);
}
