/**
 * Video Talk Time Analytics API
 *
 * Get talk time distribution for a specific video,
 * showing how much each speaker contributed.
 */

import { desc, eq } from 'drizzle-orm';
import { Effect } from 'effect';
import type { NextRequest } from 'next/server';
import { createPublicLayer, handleEffectExit } from '@/lib/api-handler';
import { db } from '@/lib/db';
import { normalizeOne } from '@/lib/db/relations';
import { videoSpeakers, videos } from '@/lib/db/schema';
import { DatabaseError, NotFoundError } from '@/lib/effect';

// =============================================================================
// GET /api/videos/[id]/analytics/talk-time - Get talk time distribution
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const videoId = resolvedParams.id;

    // Get video with duration
    const video = yield* Effect.tryPromise({
      try: () =>
        db.query.videos.findFirst({
          where: eq(videos.id, videoId),
          columns: { id: true, duration: true, title: true },
        }),
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch video',
          operation: 'getVideo',
          cause: error,
        }),
    });

    if (!video) {
      return yield* Effect.fail(
        new NotFoundError({
          message: 'Video not found',
          entity: 'Video',
          id: videoId,
        }),
      );
    }

    // Get all speakers with profiles
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
          message: 'Failed to fetch speakers',
          operation: 'getSpeakers',
          cause: error,
        }),
    });

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

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);
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
