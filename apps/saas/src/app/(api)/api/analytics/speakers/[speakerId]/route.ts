/**
 * Individual Speaker Analytics API
 *
 * Get detailed analytics and trends for a specific speaker,
 * including participation history and speaking patterns over time.
 */

import { createFullLayer, handleEffectExit } from '@nuclom/lib/api-handler';
import { auth } from '@nuclom/lib/auth';
import { db } from '@nuclom/lib/db';
import { normalizeOne } from '@nuclom/lib/db/relations';
import { speakerProfiles, videoSpeakers } from '@nuclom/lib/db/schema';
import { DatabaseError, NotFoundError } from '@nuclom/lib/effect';
import { and, desc, eq } from 'drizzle-orm';
import { Effect } from 'effect';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// =============================================================================
// GET /api/analytics/speakers/[speakerId] - Get individual speaker analytics
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ speakerId: string }> }) {
  // Verify authentication
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user || !session.session?.activeOrganizationId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const organizationId = session.session.activeOrganizationId;

  // Parse query params
  const searchParams = request.nextUrl.searchParams;
  const periodMonths = Number.parseInt(searchParams.get('months') || '6', 10);

  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const { speakerId } = resolvedParams;

    // Get the speaker profile
    const profile = yield* Effect.tryPromise({
      try: () =>
        db.query.speakerProfiles.findFirst({
          where: and(eq(speakerProfiles.id, speakerId), eq(speakerProfiles.organizationId, organizationId)),
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
        }),
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch speaker profile',
          operation: 'getSpeakerProfile',
          cause: error,
        }),
    });

    if (!profile) {
      return yield* Effect.fail(
        new NotFoundError({
          message: 'Speaker profile not found',
          entity: 'SpeakerProfile',
          id: speakerId,
        }),
      );
    }

    // Calculate period start date
    const periodStart = new Date();
    periodStart.setMonth(periodStart.getMonth() - periodMonths);

    // Get all video speaker records for this profile with videos
    const videoSpeakersData = yield* Effect.tryPromise({
      try: () =>
        db.query.videoSpeakers.findMany({
          where: eq(videoSpeakers.speakerProfileId, speakerId),
          with: {
            video: {
              columns: {
                id: true,
                title: true,
                duration: true,
                createdAt: true,
              },
            },
          },
          orderBy: [desc(videoSpeakers.createdAt)],
        }),
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch video speakers',
          operation: 'getVideoSpeakers',
          cause: error,
        }),
    });

    const normalizedSpeakers = videoSpeakersData.map((vs) => ({
      ...vs,
      video: normalizeOne(vs.video),
    }));

    // Filter to period and calculate stats
    const filteredSpeakers = normalizedSpeakers.filter((vs) => vs.video && vs.video.createdAt >= periodStart);

    // Group by month for trends
    const monthlyStats = new Map<
      string,
      { videoCount: number; totalSpeakingTime: number; avgPercentage: number; percentages: number[] }
    >();

    for (const vs of filteredSpeakers) {
      if (!vs.video) continue;
      const monthKey = `${vs.video.createdAt.getFullYear()}-${String(vs.video.createdAt.getMonth() + 1).padStart(2, '0')}`;

      const existing = monthlyStats.get(monthKey) || {
        videoCount: 0,
        totalSpeakingTime: 0,
        avgPercentage: 0,
        percentages: [],
      };

      existing.videoCount++;
      existing.totalSpeakingTime += vs.totalSpeakingTime;
      existing.percentages.push(vs.speakingPercentage || 0);
      monthlyStats.set(monthKey, existing);
    }

    // Calculate averages for each month
    const trends = Array.from(monthlyStats.entries())
      .map(([month, stats]) => ({
        month,
        videoCount: stats.videoCount,
        totalSpeakingTime: stats.totalSpeakingTime,
        avgSpeakingPercentage:
          stats.percentages.length > 0
            ? Math.round(stats.percentages.reduce((a, b) => a + b, 0) / stats.percentages.length)
            : 0,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Calculate overall stats
    const totalVideos = filteredSpeakers.length;
    const totalSpeakingTime = filteredSpeakers.reduce((sum, vs) => sum + vs.totalSpeakingTime, 0);
    const avgSpeakingPercentage =
      totalVideos > 0
        ? Math.round(filteredSpeakers.reduce((sum, vs) => sum + (vs.speakingPercentage || 0), 0) / totalVideos)
        : 0;

    // Get recent videos with details
    const recentVideos = filteredSpeakers.slice(0, 10).map((vs) => ({
      videoId: vs.video?.id,
      videoTitle: vs.video?.title,
      videoDate: vs.video?.createdAt.toISOString(),
      speakingTime: vs.totalSpeakingTime,
      speakingPercentage: vs.speakingPercentage,
      segmentCount: vs.segmentCount,
    }));

    const linkedUser = normalizeOne(profile.user);

    return {
      success: true,
      data: {
        speakerId,
        displayName: profile.displayName,
        linkedUser: linkedUser
          ? {
              id: linkedUser.id,
              name: linkedUser.name,
              email: linkedUser.email,
              image: linkedUser.image,
            }
          : null,
        summary: {
          totalVideos,
          totalSpeakingTime,
          avgSpeakingPercentage,
          periodMonths,
        },
        trends,
        recentVideos,
      },
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}
