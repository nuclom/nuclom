/**
 * Video Talk Time Analytics API
 *
 * Get talk time distribution for a specific video,
 * showing how much each speaker contributed.
 */

import { handleEffectExit, runApiEffect } from '@nuclom/lib/api-handler';
import { normalizeOne } from '@nuclom/lib/db/relations';
import { SpeakerRepository, VideoRepository } from '@nuclom/lib/effect';
import { Effect } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// GET /api/videos/[id]/analytics/talk-time - Get talk time distribution
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const videoId = resolvedParams.id;

    // Get video with duration using VideoRepository
    const videoRepo = yield* VideoRepository;
    const video = yield* videoRepo.getVideo(videoId);

    // Get all speakers with profiles using SpeakerRepository
    const speakerRepo = yield* SpeakerRepository;
    const speakers = yield* speakerRepo.getVideoSpeakers(videoId);

    if (speakers.length === 0) {
      return {
        success: true,
        data: {
          videoId,
          videoTitle: video.title,
          duration: video.duration,
          hasSpeakers: false,
          message: 'No speaker data available for this video',
        },
      };
    }

    // Calculate total speaking time
    const totalSpeakingTime = speakers.reduce((sum, s) => sum + s.totalSpeakingTime, 0);

    // Calculate balance score
    const percentages = speakers.map((s) => s.speakingPercentage || 0);
    const speakerCount = speakers.length;
    let balanceScore = 100;
    let balanceRating: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';

    if (speakerCount > 1) {
      const idealPercentage = 100 / speakerCount;
      const totalDeviation = percentages.reduce((sum, p) => sum + Math.abs(p - idealPercentage), 0);
      const maxDeviation = 2 * (100 - idealPercentage);
      balanceScore = Math.max(0, Math.round(100 - (totalDeviation / maxDeviation) * 100));

      // Determine rating
      if (balanceScore >= 80) {
        balanceRating = 'excellent';
      } else if (balanceScore >= 60) {
        balanceRating = 'good';
      } else if (balanceScore >= 40) {
        balanceRating = 'fair';
      } else {
        balanceRating = 'poor';
      }
    }

    // Format duration for display
    const durationSeconds = Number.parseInt(video.duration, 10) || 0;
    const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return {
      success: true,
      data: {
        videoId,
        videoTitle: video.title,
        duration: video.duration,
        durationFormatted: formatTime(durationSeconds),
        hasSpeakers: true,
        speakerCount,
        totalSpeakingTime,
        totalSpeakingTimeFormatted: formatTime(totalSpeakingTime),
        distribution: speakers.map((s) => {
          const speakerProfile = normalizeOne(s.speakerProfile);
          const linkedUser = normalizeOne(speakerProfile?.user);

          return {
            speakerId: s.id,
            speakerLabel: s.speakerLabel,
            displayName: speakerProfile?.displayName || `Speaker ${s.speakerLabel}`,
            linkedUser: linkedUser
              ? {
                  id: linkedUser.id,
                  name: linkedUser.name,
                  image: linkedUser.image,
                }
              : null,
            speakingTime: s.totalSpeakingTime,
            speakingTimeFormatted: formatTime(s.totalSpeakingTime),
            speakingPercentage: s.speakingPercentage || 0,
            segmentCount: s.segmentCount,
          };
        }),
        balance: {
          score: balanceScore,
          rating: balanceRating,
          description: getBalanceDescription(balanceScore, speakerCount),
        },
      },
    };
  });

  const exit = await runApiEffect(effect);
  return handleEffectExit(exit);
}

function getBalanceDescription(score: number, speakerCount: number): string {
  if (speakerCount === 1) {
    return 'Single speaker video';
  }

  if (score >= 80) {
    return 'Excellent balance - all participants contributed fairly equally';
  }
  if (score >= 60) {
    return 'Good balance - most participants had meaningful contributions';
  }
  if (score >= 40) {
    return 'Fair balance - some participants dominated the conversation';
  }
  return 'Poor balance - conversation was dominated by one or few participants';
}
