import { and, avg, count, eq, gte, sql, sum } from "drizzle-orm";
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
// GET /api/insights/overview - Get organization AI insights overview
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

    // Get total videos analyzed (with AI processing completed)
    const videosAnalyzedResult = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ count: count() })
          .from(videos)
          .where(
            and(
              eq(videos.organizationId, organizationId),
              eq(videos.processingStatus, "completed"),
              gte(videos.createdAt, startDate),
            ),
          ),
      catch: () =>
        new DatabaseError({
          message: "Failed to fetch analyzed videos count",
          operation: "getAnalyzedVideosCount",
        }),
    });
    const totalVideosAnalyzed = videosAnalyzedResult[0]?.count || 0;

    // Get total watch time in hours
    const watchTimeResult = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ total: sum(videoViews.watchDuration) })
          .from(videoViews)
          .where(and(eq(videoViews.organizationId, organizationId), gte(videoViews.createdAt, startDate))),
      catch: () =>
        new DatabaseError({
          message: "Failed to fetch watch time",
          operation: "getWatchTime",
        }),
    });
    const totalHoursAnalyzed = Math.round((Number(watchTimeResult[0]?.total) || 0) / 3600);

    // Get total decisions extracted
    const decisionsResult = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ count: count() })
          .from(decisions)
          .where(and(eq(decisions.organizationId, organizationId), gte(decisions.createdAt, startDate))),
      catch: () =>
        new DatabaseError({
          message: "Failed to fetch decisions count",
          operation: "getDecisionsCount",
        }),
    });
    const totalDecisions = decisionsResult[0]?.count || 0;

    // Get action items stats
    const actionItemsResult = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            total: count(),
            pending: sql<number>`COUNT(*) FILTER (WHERE ${aiActionItems.status} = 'pending')`,
            inProgress: sql<number>`COUNT(*) FILTER (WHERE ${aiActionItems.status} = 'in_progress')`,
            completed: sql<number>`COUNT(*) FILTER (WHERE ${aiActionItems.status} = 'completed')`,
          })
          .from(aiActionItems)
          .where(and(eq(aiActionItems.organizationId, organizationId), gte(aiActionItems.createdAt, startDate))),
      catch: () =>
        new DatabaseError({
          message: "Failed to fetch action items stats",
          operation: "getActionItemsStats",
        }),
    });
    const actionItemsStats = actionItemsResult[0] || { total: 0, pending: 0, inProgress: 0, completed: 0 };

    // Get average decision confidence
    const avgConfidenceResult = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ avg: avg(decisions.confidence) })
          .from(decisions)
          .where(
            and(
              eq(decisions.organizationId, organizationId),
              gte(decisions.createdAt, startDate),
              sql`${decisions.confidence} IS NOT NULL`,
            ),
          ),
      catch: () =>
        new DatabaseError({
          message: "Failed to fetch avg confidence",
          operation: "getAvgConfidence",
        }),
    });
    const avgConfidence = Math.round(Number(avgConfidenceResult[0]?.avg) || 0);

    // Calculate comparison with previous period
    let previousPeriodStartDate: Date;
    const previousPeriodEndDate: Date = startDate;

    switch (period) {
      case "7d":
        previousPeriodStartDate = new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        previousPeriodStartDate = new Date(startDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        previousPeriodStartDate = new Date(startDate.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        previousPeriodStartDate = new Date(0);
    }

    // Get previous period videos count for comparison
    const prevVideosResult = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ count: count() })
          .from(videos)
          .where(
            and(
              eq(videos.organizationId, organizationId),
              eq(videos.processingStatus, "completed"),
              gte(videos.createdAt, previousPeriodStartDate),
              sql`${videos.createdAt} < ${previousPeriodEndDate}`,
            ),
          ),
      catch: () =>
        new DatabaseError({
          message: "Failed to fetch previous period videos",
          operation: "getPrevVideosCount",
        }),
    });
    const prevVideosCount = prevVideosResult[0]?.count || 0;

    // Calculate percentage change
    const videosChange =
      prevVideosCount > 0 ? Math.round(((totalVideosAnalyzed - prevVideosCount) / prevVideosCount) * 100) : 0;

    return {
      overview: {
        totalVideosAnalyzed,
        totalHoursAnalyzed,
        totalDecisions,
        avgConfidence,
        actionItems: {
          total: Number(actionItemsStats.total) || 0,
          pending: Number(actionItemsStats.pending) || 0,
          inProgress: Number(actionItemsStats.inProgress) || 0,
          completed: Number(actionItemsStats.completed) || 0,
          completionRate:
            actionItemsStats.total > 0
              ? Math.round((Number(actionItemsStats.completed) / Number(actionItemsStats.total)) * 100)
              : 0,
        },
      },
      trends: {
        videosChange, // percentage change from previous period
      },
      period,
    };
  });

  const runnable = Effect.provide(effect, FullLayer);
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
