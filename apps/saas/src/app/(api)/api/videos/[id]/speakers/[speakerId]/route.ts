/**
 * Individual Speaker API
 *
 * Endpoints for managing a specific speaker in a video,
 * including getting segments and updating speaker details.
 */

import { handleEffectExit, runPublicApiEffect } from '@nuclom/lib/api-handler';
import { normalizeOne } from '@nuclom/lib/db/relations';
import { SpeakerRepository } from '@nuclom/lib/effect/services/speaker-repository';
import { VideoRepository } from '@nuclom/lib/effect/services/video-repository';
import { Effect } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// GET /api/videos/[id]/speakers/[speakerId] - Get speaker details and segments
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string; speakerId: string }> }) {
  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const { id: videoId, speakerId } = resolvedParams;

    // Verify video exists
    const videoRepo = yield* VideoRepository;
    yield* videoRepo.getVideo(videoId);

    // Get the video speaker with profile
    const speakerRepo = yield* SpeakerRepository;
    const videoSpeaker = yield* speakerRepo.getVideoSpeaker(videoId, speakerId);

    // Get all segments for this speaker
    const segments = yield* speakerRepo.getSpeakerSegments(videoId, speakerId);

    const speakerProfile = normalizeOne(videoSpeaker.speakerProfile);
    const linkedUser = normalizeOne(speakerProfile?.user);

    return {
      success: true,
      data: {
        id: videoSpeaker.id,
        videoId,
        speakerLabel: videoSpeaker.speakerLabel,
        displayName: speakerProfile?.displayName || `Speaker ${videoSpeaker.speakerLabel}`,
        totalSpeakingTime: videoSpeaker.totalSpeakingTime,
        segmentCount: videoSpeaker.segmentCount,
        speakingPercentage: videoSpeaker.speakingPercentage || 0,
        linkedUser: linkedUser
          ? {
              id: linkedUser.id,
              name: linkedUser.name,
              email: linkedUser.email,
              image: linkedUser.image,
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

  const exit = await runPublicApiEffect(effect);
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

    // Get the video speaker
    const speakerRepo = yield* SpeakerRepository;
    const videoSpeaker = yield* speakerRepo.getVideoSpeaker(videoId, speakerId);

    // Unlink user from speaker profile (keep profile but remove user association)
    const profileId = videoSpeaker.speakerProfileId;
    if (profileId) {
      yield* speakerRepo.updateSpeakerProfile(profileId, { userId: null });
    }

    return {
      success: true,
      data: {
        speakerId,
        unlinked: true,
      },
    };
  });

  const exit = await runPublicApiEffect(effect);
  return handleEffectExit(exit);
}
