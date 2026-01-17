import { and, count, desc, eq, gte, sql, sum } from 'drizzle-orm';
import { Effect } from 'effect';
import type { NextRequest } from 'next/server';
import { Auth, generatePresignedThumbnailUrl, handleEffectExit, runApiEffect, Storage } from '@/lib/api-handler';
import { db } from '@/lib/db';
import { videos, videoViews } from '@/lib/db/schema';
import { DatabaseError, UnauthorizedError } from '@/lib/effect';

// =============================================================================
// GET /api/organizations/[id]/analytics - Get organization analytics
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const url = new URL(request.url);
  const period = url.searchParams.get('period') || '30d';

  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const organizationId = resolvedParams.id;

    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Verify user belongs to organization
    const isMember = yield* Effect.tryPromise({
      try: () =>
        db.query.members.findFirst({
          where: (members, { and, eq }) => and(eq(members.userId, user.id), eq(members.organizationId, organizationId)),
        }),
      catch: () =>
        new DatabaseError({
          message: 'Failed to verify membership',
          operation: 'checkMembership',
        }),
    });

    if (!isMember) {
      return yield* Effect.fail(
        new UnauthorizedError({
          message: 'You are not a member of this organization',
        }),
      );
    }

    // Calculate date ranges
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0); // All time
    }

    // Get total views in period
    const totalViewsResult = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ count: count() })
          .from(videoViews)
          .where(and(eq(videoViews.organizationId, organizationId), gte(videoViews.createdAt, startDate))),
      catch: () =>
        new DatabaseError({
          message: 'Failed to fetch total views',
          operation: 'getTotalViews',
        }),
    });
    const totalViews = totalViewsResult[0]?.count || 0;

    // Get unique viewers
    const uniqueViewersResult = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ count: sql<number>`COUNT(DISTINCT ${videoViews.userId})` })
          .from(videoViews)
          .where(
            and(
              eq(videoViews.organizationId, organizationId),
              gte(videoViews.createdAt, startDate),
              sql`${videoViews.userId} IS NOT NULL`,
            ),
          ),
      catch: () =>
        new DatabaseError({
          message: 'Failed to fetch unique viewers',
          operation: 'getUniqueViewers',
        }),
    });
    const uniqueViewers = uniqueViewersResult[0]?.count || 0;

    // Get total watch time
    const watchTimeResult = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ total: sum(videoViews.watchDuration) })
          .from(videoViews)
          .where(and(eq(videoViews.organizationId, organizationId), gte(videoViews.createdAt, startDate))),
      catch: () =>
        new DatabaseError({
          message: 'Failed to fetch watch time',
          operation: 'getWatchTime',
        }),
    });
    const totalWatchTime = Number(watchTimeResult[0]?.total) || 0;

    // Get average completion rate
    const avgCompletionResult = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ avg: sql<number>`AVG(${videoViews.completionPercent})` })
          .from(videoViews)
          .where(and(eq(videoViews.organizationId, organizationId), gte(videoViews.createdAt, startDate))),
      catch: () =>
        new DatabaseError({
          message: 'Failed to fetch avg completion',
          operation: 'getAvgCompletion',
        }),
    });
    const avgCompletionPercent = Math.round(Number(avgCompletionResult[0]?.avg) || 0);

    // Get top 10 videos by views
    const topVideos = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            videoId: videoViews.videoId,
            viewCount: count(),
            totalWatchTime: sum(videoViews.watchDuration),
            avgCompletion: sql<number>`AVG(${videoViews.completionPercent})`,
          })
          .from(videoViews)
          .where(and(eq(videoViews.organizationId, organizationId), gte(videoViews.createdAt, startDate)))
          .groupBy(videoViews.videoId)
          .orderBy(desc(count()))
          .limit(10),
      catch: () =>
        new DatabaseError({
          message: 'Failed to fetch top videos',
          operation: 'getTopVideos',
        }),
    });

    // Get video details for top videos
    const topVideoIds = topVideos.map((v) => v.videoId);
    const videoDetails = yield* Effect.tryPromise({
      try: () =>
        topVideoIds.length > 0
          ? db.query.videos.findMany({
              where: (videos, { inArray }) => inArray(videos.id, topVideoIds),
              columns: { id: true, title: true, thumbnailUrl: true, duration: true },
            })
          : Promise.resolve([]),
      catch: () =>
        new DatabaseError({
          message: 'Failed to fetch video details',
          operation: 'getVideoDetails',
        }),
    });

    // Generate presigned URLs for video thumbnails
    const storage = yield* Storage;
    const videoDetailsWithPresignedUrls = yield* Effect.all(
      videoDetails.map((v) =>
        Effect.gen(function* () {
          const presignedThumbnailUrl = yield* generatePresignedThumbnailUrl(storage, v.thumbnailUrl);
          return {
            ...v,
            thumbnailUrl: presignedThumbnailUrl,
          };
        }),
      ),
      { concurrency: 10 },
    );

    const videoDetailsMap = new Map(videoDetailsWithPresignedUrls.map((v) => [v.id, v]));

    // Get views by day
    const viewsByDay = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            date: sql<string>`DATE(${videoViews.createdAt})`,
            viewCount: count(),
          })
          .from(videoViews)
          .where(and(eq(videoViews.organizationId, organizationId), gte(videoViews.createdAt, startDate)))
          .groupBy(sql`DATE(${videoViews.createdAt})`)
          .orderBy(sql`DATE(${videoViews.createdAt})`),
      catch: () =>
        new DatabaseError({
          message: 'Failed to fetch views by day',
          operation: 'getViewsByDay',
        }),
    });

    // Get total video count
    const videoCountResult = yield* Effect.tryPromise({
      try: () => db.select({ count: count() }).from(videos).where(eq(videos.organizationId, organizationId)),
      catch: () =>
        new DatabaseError({
          message: 'Failed to fetch video count',
          operation: 'getVideoCount',
        }),
    });
    const totalVideos = videoCountResult[0]?.count || 0;

    return {
      overview: {
        totalViews,
        uniqueViewers,
        totalWatchTime, // in seconds
        avgCompletionPercent,
        totalVideos,
      },
      topVideos: topVideos.map((v) => ({
        ...v,
        video: videoDetailsMap.get(v.videoId),
        avgCompletion: Math.round(Number(v.avgCompletion) || 0),
        totalWatchTime: Number(v.totalWatchTime) || 0,
      })),
      viewsByDay: viewsByDay.map((v) => ({
        date: v.date,
        viewCount: v.viewCount,
      })),
      period,
    };
  });

  const exit = await runApiEffect(effect);
  return handleEffectExit(exit);
}
