import { and, avg, count, desc, eq, gte, sql, sum } from "drizzle-orm";
import { Effect, Schema } from "effect";
import { connection, type NextRequest } from "next/server";
import { Auth, createFullLayer, handleEffectExit } from "@/lib/api-handler";
import { videoSpeakers, videos } from "@/lib/db/schema";
import { DatabaseError, UnauthorizedError } from "@/lib/effect/errors";
import { Database } from "@/lib/effect/services/database";
import { validateQueryParams } from "@/lib/validation";

// =============================================================================
// Query Schema
// =============================================================================

const querySchema = Schema.Struct({
  organizationId: Schema.String,
  period: Schema.optionalWith(Schema.Literal("7d", "30d", "90d", "all"), { default: () => "30d" as const }),
});

function getDateRangeForPeriod(period: string): Date {
  const now = new Date();
  switch (period) {
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "90d":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    default:
      return new Date(0);
  }
}

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

    const startDate = getDateRangeForPeriod(period);

    // Get meeting time distribution (by day of week and hour)
    const timeDistribution = yield* Effect.tryPromise({
      try: async () => {
        const result = await db
          .select({
            dayOfWeek: sql<number>`EXTRACT(DOW FROM ${videos.createdAt})`,
            hour: sql<number>`EXTRACT(HOUR FROM ${videos.createdAt})`,
            count: count(),
          })
          .from(videos)
          .where(and(eq(videos.organizationId, organizationId), gte(videos.createdAt, startDate)))
          .groupBy(sql`EXTRACT(DOW FROM ${videos.createdAt})`, sql`EXTRACT(HOUR FROM ${videos.createdAt})`);
        return result;
      },
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch time distribution: ${error}`,
          operation: "getTimeDistribution",
        }),
    });

    // Get speaker participation metrics
    const speakerParticipation = yield* Effect.tryPromise({
      try: async () => {
        const result = await db
          .select({
            speakerName: videoSpeakers.speakerLabel,
            totalVideos: count(),
            totalSpeakingTime: sum(videoSpeakers.totalSpeakingTime),
            avgSpeakingPercent: avg(videoSpeakers.speakingPercentage),
          })
          .from(videoSpeakers)
          .innerJoin(videos, eq(videoSpeakers.videoId, videos.id))
          .where(and(eq(videos.organizationId, organizationId), gte(videos.createdAt, startDate)))
          .groupBy(videoSpeakers.speakerLabel)
          .orderBy(desc(count()));
        return result;
      },
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch speaker participation: ${error}`,
          operation: "getSpeakerParticipation",
        }),
    });

    // Get meeting frequency by week
    const weeklyFrequency = yield* Effect.tryPromise({
      try: async () => {
        const result = await db
          .select({
            week: sql<string>`TO_CHAR(DATE_TRUNC('week', ${videos.createdAt}), 'YYYY-MM-DD')`,
            count: count(),
            totalDuration: sum(sql`CAST(${videos.duration} AS INTEGER)`),
          })
          .from(videos)
          .where(and(eq(videos.organizationId, organizationId), gte(videos.createdAt, startDate)))
          .groupBy(sql`DATE_TRUNC('week', ${videos.createdAt})`)
          .orderBy(sql`DATE_TRUNC('week', ${videos.createdAt})`);
        return result;
      },
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch weekly frequency: ${error}`,
          operation: "getWeeklyFrequency",
        }),
    });

    // Get co-appearance patterns (which speakers appear together)
    const coAppearances = yield* Effect.tryPromise({
      try: async () => {
        // Get all videos with their speakers
        const videoWithSpeakers = await db
          .select({
            videoId: videos.id,
            speakerLabel: videoSpeakers.speakerLabel,
          })
          .from(videos)
          .innerJoin(videoSpeakers, eq(videos.id, videoSpeakers.videoId))
          .where(and(eq(videos.organizationId, organizationId), gte(videos.createdAt, startDate)));

        // Build co-appearance matrix
        const coAppearanceMap = new Map<string, number>();
        const videoSpeakersMap = new Map<string, string[]>();

        for (const row of videoWithSpeakers) {
          const speakers = videoSpeakersMap.get(row.videoId) || [];
          speakers.push(row.speakerLabel);
          videoSpeakersMap.set(row.videoId, speakers);
        }

        // Count co-appearances
        for (const speakers of videoSpeakersMap.values()) {
          for (let i = 0; i < speakers.length; i++) {
            for (let j = i + 1; j < speakers.length; j++) {
              const key = [speakers[i], speakers[j]].sort().join("|||");
              coAppearanceMap.set(key, (coAppearanceMap.get(key) || 0) + 1);
            }
          }
        }

        // Convert to array and sort
        const coAppearanceList = Array.from(coAppearanceMap.entries())
          .map(([key, count]) => {
            const [speaker1, speaker2] = key.split("|||");
            return { speaker1, speaker2, count };
          })
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        return coAppearanceList;
      },
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch co-appearances: ${error}`,
          operation: "getCoAppearances",
        }),
    });

    // Get meeting duration trends
    const durationStats = yield* Effect.tryPromise({
      try: async () => {
        const result = await db
          .select({
            avgDuration: avg(sql`CAST(${videos.duration} AS INTEGER)`),
            minDuration: sql<number>`MIN(CAST(${videos.duration} AS INTEGER))`,
            maxDuration: sql<number>`MAX(CAST(${videos.duration} AS INTEGER))`,
            totalMeetings: count(),
          })
          .from(videos)
          .where(and(eq(videos.organizationId, organizationId), gte(videos.createdAt, startDate)));
        return result[0] || { avgDuration: 0, minDuration: 0, maxDuration: 0, totalMeetings: 0 };
      },
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch duration stats: ${error}`,
          operation: "getDurationStats",
        }),
    });

    // Format time distribution for heatmap
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const heatmapData = dayNames.map((day, dayIndex) => {
      const hours = Array.from({ length: 24 }, (_, hour) => {
        const entry = timeDistribution.find((d) => Number(d.dayOfWeek) === dayIndex && Number(d.hour) === hour);
        return { hour, count: Number(entry?.count) || 0 };
      });
      return { day, hours };
    });

    // Find peak meeting times
    const peakTimes: { day: string; hour: number; count: number }[] = [];
    for (const entry of timeDistribution) {
      if (Number(entry.count) > 0) {
        peakTimes.push({
          day: dayNames[Number(entry.dayOfWeek)],
          hour: Number(entry.hour),
          count: Number(entry.count),
        });
      }
    }
    peakTimes.sort((a, b) => b.count - a.count);

    // Calculate participation balance
    const totalSpeakingTime = speakerParticipation.reduce((sum, s) => sum + Number(s.totalSpeakingTime || 0), 0);

    // Calculate Gini coefficient for participation balance (0 = perfect equality, 1 = perfect inequality)
    let giniCoefficient = 0;
    if (speakerParticipation.length > 1 && totalSpeakingTime > 0) {
      const sortedTimes = speakerParticipation.map((s) => Number(s.totalSpeakingTime || 0)).sort((a, b) => a - b);
      const n = sortedTimes.length;
      const sumOfRanks = sortedTimes.reduce((sum, time, i) => sum + time * (i + 1), 0);
      giniCoefficient = (2 * sumOfRanks) / (n * totalSpeakingTime) - (n + 1) / n;
    }

    const participationBalance = Math.round((1 - giniCoefficient) * 100);

    return {
      timeDistribution: {
        heatmap: heatmapData,
        peakTimes: peakTimes.slice(0, 5),
      },
      speakerPatterns: {
        participants: speakerParticipation.map((s) => ({
          name: s.speakerName,
          videoCount: Number(s.totalVideos),
          totalSpeakingTime: Number(s.totalSpeakingTime || 0),
          avgSpeakingPercent: Math.round(Number(s.avgSpeakingPercent || 0)),
        })),
        coAppearances,
        participationBalance,
      },
      meetingFrequency: {
        weekly: weeklyFrequency.map((w) => ({
          week: w.week,
          count: Number(w.count),
          totalDuration: Number(w.totalDuration || 0),
        })),
        stats: {
          avgDurationMinutes: Math.round(Number(durationStats.avgDuration || 0) / 60),
          minDurationMinutes: Math.round(Number(durationStats.minDuration || 0) / 60),
          maxDurationMinutes: Math.round(Number(durationStats.maxDuration || 0) / 60),
          totalMeetings: Number(durationStats.totalMeetings),
        },
      },
    };
  });

  const runnable = Effect.provide(effect, FullLayer);
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
