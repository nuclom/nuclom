import { and, avg, count, eq, gte, sql } from "drizzle-orm";
import { Effect, Schema } from "effect";
import { connection, type NextRequest } from "next/server";
import { Auth, createFullLayer, handleEffectExit } from "@/lib/api-handler";
import { aiActionItems, decisions, videos, videoViews } from "@/lib/db/schema";
import { DatabaseError, UnauthorizedError } from "@/lib/effect";
import { Database } from "@/lib/effect/services/database";
import { validateQueryParams } from "@/lib/validation";

// =============================================================================
// Query Schema
// =============================================================================

const querySchema = Schema.Struct({
  organizationId: Schema.String,
  period: Schema.optionalWith(Schema.Literal("7d", "30d", "90d", "all"), { default: () => "30d" as const }),
});

// =============================================================================
// Helper to parse duration string (e.g., "15:30" or "1:30:45") to seconds
// =============================================================================

function parseDurationToSeconds(duration: string): number {
  const parts = duration.split(":").map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

// =============================================================================
// GET /api/insights/effectiveness - Get meeting effectiveness metrics
// =============================================================================

export async function GET(request: NextRequest) {
  await connection();
  const FullLayer = createFullLayer();

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Validate query params
    const params = yield* validateQueryParams(querySchema, request.url);
    const { organizationId, period } = params;

    // Get database service
    const { db } = yield* Database;

    // Verify user belongs to organization
    const isMember = yield* Effect.tryPromise({
      try: () =>
        db.query.members.findFirst({
          where: (members, { and, eq }) => and(eq(members.userId, user.id), eq(members.organizationId, organizationId)),
        }),
      catch: () =>
        new DatabaseError({
          message: "Failed to verify membership",
          operation: "checkMembership",
        }),
    });

    if (!isMember) {
      return yield* Effect.fail(
        new UnauthorizedError({
          message: "You are not a member of this organization",
        }),
      );
    }

    // Calculate date ranges
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0); // All time
    }

    // Get video stats for meeting metrics
    const videoStatsResult = yield* Effect.tryPromise({
      try: () =>
        db.query.videos.findMany({
          where: (videos, { and, eq, gte }) =>
            and(
              eq(videos.organizationId, organizationId),
              eq(videos.processingStatus, "completed"),
              gte(videos.createdAt, startDate),
            ),
          columns: {
            id: true,
            duration: true,
            createdAt: true,
          },
        }),
      catch: () =>
        new DatabaseError({
          message: "Failed to fetch video stats",
          operation: "getVideoStats",
        }),
    });

    const totalMeetings = videoStatsResult.length;
    const totalDurationSeconds = videoStatsResult.reduce((acc, v) => acc + parseDurationToSeconds(v.duration), 0);
    const avgDurationMinutes = totalMeetings > 0 ? Math.round(totalDurationSeconds / totalMeetings / 60) : 0;

    // Get decisions per meeting
    const decisionsResult = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            videoId: decisions.videoId,
            decisionCount: count(),
          })
          .from(decisions)
          .where(and(eq(decisions.organizationId, organizationId), gte(decisions.createdAt, startDate)))
          .groupBy(decisions.videoId),
      catch: () =>
        new DatabaseError({
          message: "Failed to fetch decisions stats",
          operation: "getDecisionsStats",
        }),
    });

    const totalDecisions = decisionsResult.reduce((acc, d) => acc + d.decisionCount, 0);
    const meetingsWithDecisions = decisionsResult.length;
    const avgDecisionsPerMeeting = totalMeetings > 0 ? (totalDecisions / totalMeetings).toFixed(1) : "0";
    const decisionRate = totalMeetings > 0 ? Math.round((meetingsWithDecisions / totalMeetings) * 100) : 0;

    // Get action items per meeting
    const actionItemsResult = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            videoId: aiActionItems.videoId,
            itemCount: count(),
            completedCount: sql<number>`COUNT(*) FILTER (WHERE ${aiActionItems.status} = 'completed')`,
          })
          .from(aiActionItems)
          .where(and(eq(aiActionItems.organizationId, organizationId), gte(aiActionItems.createdAt, startDate)))
          .groupBy(aiActionItems.videoId),
      catch: () =>
        new DatabaseError({
          message: "Failed to fetch action items stats",
          operation: "getActionItemsStats",
        }),
    });

    const totalActionItems = actionItemsResult.reduce((acc, a) => acc + a.itemCount, 0);
    const completedActionItems = actionItemsResult.reduce((acc, a) => acc + Number(a.completedCount), 0);
    const avgActionItemsPerMeeting = totalMeetings > 0 ? (totalActionItems / totalMeetings).toFixed(1) : "0";
    const actionItemCompletionRate =
      totalActionItems > 0 ? Math.round((completedActionItems / totalActionItems) * 100) : 0;

    // Get engagement metrics (views, completion)
    const engagementResult = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            avgCompletion: avg(videoViews.completionPercent),
            totalViews: count(),
          })
          .from(videoViews)
          .where(and(eq(videoViews.organizationId, organizationId), gte(videoViews.createdAt, startDate))),
      catch: () =>
        new DatabaseError({
          message: "Failed to fetch engagement stats",
          operation: "getEngagementStats",
        }),
    });

    const avgEngagement = Math.round(Number(engagementResult[0]?.avgCompletion) || 0);
    const totalViews = engagementResult[0]?.totalViews || 0;

    // Calculate effectiveness score (weighted composite)
    // Components: decision rate (30%), action item completion (30%), engagement (20%), consistency (20%)
    const effectivenessScore = Math.round(
      decisionRate * 0.3 + actionItemCompletionRate * 0.3 + avgEngagement * 0.2 + (totalMeetings > 0 ? 80 : 0) * 0.2, // Placeholder for consistency
    );

    // Get trends over time (weekly buckets)
    const weeklyTrendsResult = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            week: sql<string>`DATE_TRUNC('week', ${videos.createdAt})`,
            meetingCount: count(),
            totalDuration: sql<number>`SUM(CASE
              WHEN ${videos.duration} LIKE '%:%:%' THEN
                SPLIT_PART(${videos.duration}, ':', 1)::int * 3600 +
                SPLIT_PART(${videos.duration}, ':', 2)::int * 60 +
                SPLIT_PART(${videos.duration}, ':', 3)::int
              WHEN ${videos.duration} LIKE '%:%' THEN
                SPLIT_PART(${videos.duration}, ':', 1)::int * 60 +
                SPLIT_PART(${videos.duration}, ':', 2)::int
              ELSE 0
            END)`,
          })
          .from(videos)
          .where(
            and(
              eq(videos.organizationId, organizationId),
              eq(videos.processingStatus, "completed"),
              gte(videos.createdAt, startDate),
            ),
          )
          .groupBy(sql`DATE_TRUNC('week', ${videos.createdAt})`)
          .orderBy(sql`DATE_TRUNC('week', ${videos.createdAt})`),
      catch: () =>
        new DatabaseError({
          message: "Failed to fetch weekly trends",
          operation: "getWeeklyTrends",
        }),
    });

    return {
      metrics: {
        totalMeetings,
        avgDurationMinutes,
        totalDecisions,
        avgDecisionsPerMeeting: Number(avgDecisionsPerMeeting),
        decisionRate,
        totalActionItems,
        completedActionItems,
        avgActionItemsPerMeeting: Number(avgActionItemsPerMeeting),
        actionItemCompletionRate,
        avgEngagement,
        totalViews,
      },
      effectivenessScore,
      scoreBreakdown: {
        decisionMaking: decisionRate,
        followThrough: actionItemCompletionRate,
        engagement: avgEngagement,
        consistency: totalMeetings > 0 ? 80 : 0, // Placeholder
      },
      weeklyTrends: weeklyTrendsResult.map((w) => ({
        week: w.week,
        meetingCount: w.meetingCount,
        avgDurationMinutes: w.meetingCount > 0 ? Math.round(Number(w.totalDuration) / w.meetingCount / 60) : 0,
      })),
      period,
    };
  });

  const runnable = Effect.provide(effect, FullLayer);
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
