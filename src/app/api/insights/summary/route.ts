import { and, count, desc, eq, gte, sql, sum } from "drizzle-orm";
import { Effect } from "effect";
import { connection, type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aiActionItems, decisions, videoSpeakers, videos, videoViews } from "@/lib/db/schema";

class DatabaseError {
  readonly _tag = "DatabaseError";
  constructor(readonly message: string) {}
}

class UnauthorizedError {
  readonly _tag = "UnauthorizedError";
  constructor(readonly message: string) {}
}

function validateQueryParams(searchParams: URLSearchParams) {
  const organizationId = searchParams.get("organizationId");
  const period = searchParams.get("period") || "7d";

  if (!organizationId) {
    return Effect.fail(new UnauthorizedError("Organization ID is required"));
  }

  return Effect.succeed({ organizationId, period });
}

function getDateRangeForPeriod(period: string): Date {
  const now = new Date();
  switch (period) {
    case "7d":
      return new Date(now.setDate(now.getDate() - 7));
    case "30d":
      return new Date(now.setDate(now.getDate() - 30));
    case "90d":
      return new Date(now.setDate(now.getDate() - 90));
    case "monthly":
      return new Date(now.setMonth(now.getMonth() - 1));
    case "weekly":
      return new Date(now.setDate(now.getDate() - 7));
    default:
      return new Date(0);
  }
}

export async function GET(request: NextRequest) {
  await connection();

  const program = Effect.gen(function* () {
    const { organizationId, period } = yield* validateQueryParams(request.nextUrl.searchParams);
    const startDate = getDateRangeForPeriod(period);

    // Get video stats for the period
    const videoStats = yield* Effect.tryPromise({
      try: async () => {
        const result = await db
          .select({
            totalVideos: count(),
            totalDuration: sum(sql`CAST(${videos.duration} AS INTEGER)`),
          })
          .from(videos)
          .where(and(eq(videos.organizationId, organizationId), gte(videos.createdAt, startDate)));
        return result[0] || { totalVideos: 0, totalDuration: 0 };
      },
      catch: (error) => new DatabaseError(`Failed to fetch video stats: ${error}`),
    });

    // Get decision stats
    const decisionStats = yield* Effect.tryPromise({
      try: async () => {
        const result = await db
          .select({
            totalDecisions: count(),
          })
          .from(decisions)
          .where(and(eq(decisions.organizationId, organizationId), gte(decisions.createdAt, startDate)));
        return result[0] || { totalDecisions: 0 };
      },
      catch: (error) => new DatabaseError(`Failed to fetch decision stats: ${error}`),
    });

    // Get action item stats
    const actionItemStats = yield* Effect.tryPromise({
      try: async () => {
        const result = await db
          .select({
            total: count(),
            completed: sum(sql`CASE WHEN ${aiActionItems.status} = 'completed' THEN 1 ELSE 0 END`),
            pending: sum(sql`CASE WHEN ${aiActionItems.status} = 'pending' THEN 1 ELSE 0 END`),
          })
          .from(aiActionItems)
          .where(and(eq(aiActionItems.organizationId, organizationId), gte(aiActionItems.createdAt, startDate)));
        return result[0] || { total: 0, completed: 0, pending: 0 };
      },
      catch: (error) => new DatabaseError(`Failed to fetch action item stats: ${error}`),
    });

    // Get top speakers
    const topSpeakers = yield* Effect.tryPromise({
      try: async () => {
        const result = await db
          .select({
            name: videoSpeakers.speakerLabel,
            speakingTime: sum(videoSpeakers.totalSpeakingTime),
            videoCount: count(),
          })
          .from(videoSpeakers)
          .innerJoin(videos, eq(videoSpeakers.videoId, videos.id))
          .where(and(eq(videos.organizationId, organizationId), gte(videos.createdAt, startDate)))
          .groupBy(videoSpeakers.speakerLabel)
          .orderBy(desc(sum(videoSpeakers.totalSpeakingTime)))
          .limit(5);
        return result;
      },
      catch: (error) => new DatabaseError(`Failed to fetch top speakers: ${error}`),
    });

    // Get top viewed videos
    const topVideos = yield* Effect.tryPromise({
      try: async () => {
        const result = await db
          .select({
            id: videos.id,
            title: videos.title,
            views: count(videoViews.id),
          })
          .from(videos)
          .leftJoin(videoViews, eq(videos.id, videoViews.videoId))
          .where(and(eq(videos.organizationId, organizationId), gte(videos.createdAt, startDate)))
          .groupBy(videos.id, videos.title)
          .orderBy(desc(count(videoViews.id)))
          .limit(5);
        return result;
      },
      catch: (error) => new DatabaseError(`Failed to fetch top videos: ${error}`),
    });

    // Calculate key highlights
    const totalHours = Math.round(((Number(videoStats.totalDuration) || 0) / 3600) * 10) / 10;
    const completionRate =
      actionItemStats.total > 0
        ? Math.round((Number(actionItemStats.completed) / Number(actionItemStats.total)) * 100)
        : 0;

    // Generate summary highlights
    const highlights: string[] = [];

    if (Number(videoStats.totalVideos) > 0) {
      highlights.push(`Analyzed ${videoStats.totalVideos} videos (${totalHours} hours of content)`);
    }

    if (Number(decisionStats.totalDecisions) > 0) {
      highlights.push(`Captured ${decisionStats.totalDecisions} key decisions`);
    }

    if (Number(actionItemStats.completed) > 0) {
      highlights.push(`Completed ${actionItemStats.completed} action items (${completionRate}% completion rate)`);
    }

    if (Number(actionItemStats.pending) > 0) {
      highlights.push(`${actionItemStats.pending} action items still pending`);
    }

    // Generate recommendations based on data
    const recommendations: string[] = [];

    if (completionRate < 50 && Number(actionItemStats.total) > 0) {
      recommendations.push("Action item completion rate is below 50%. Consider reviewing assignment workload.");
    }

    if (Number(videoStats.totalVideos) === 0) {
      recommendations.push("No videos recorded this period. Schedule regular team meetings to capture insights.");
    }

    if (topSpeakers.length > 0) {
      const topSpeaker = topSpeakers[0];
      if (Number(topSpeaker.speakingTime) > totalHours * 3600 * 0.5) {
        recommendations.push(`Consider balancing speaking time. ${topSpeaker.name} contributed most this period.`);
      }
    }

    return {
      summary: {
        period,
        periodLabel:
          period === "7d"
            ? "Last 7 days"
            : period === "30d"
              ? "Last 30 days"
              : period === "90d"
                ? "Last 90 days"
                : "This period",
        generatedAt: new Date().toISOString(),
      },
      stats: {
        totalVideos: Number(videoStats.totalVideos),
        totalHours,
        totalDecisions: Number(decisionStats.totalDecisions),
        actionItems: {
          total: Number(actionItemStats.total),
          completed: Number(actionItemStats.completed),
          pending: Number(actionItemStats.pending),
          completionRate,
        },
      },
      highlights,
      recommendations,
      topSpeakers: topSpeakers.map((s) => ({
        name: s.name,
        speakingTime: Number(s.speakingTime) || 0,
        videoCount: Number(s.videoCount),
      })),
      topVideos: topVideos.map((v) => ({
        id: v.id,
        title: v.title,
        views: Number(v.views),
      })),
    };
  });

  const result = await Effect.runPromise(
    program.pipe(
      Effect.catchAll((error) => {
        if (error._tag === "UnauthorizedError") {
          return Effect.succeed({ error: error.message, status: 401 });
        }
        return Effect.succeed({ error: error.message, status: 500 });
      }),
    ),
  );

  if ("error" in result) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ success: true, data: result });
}
