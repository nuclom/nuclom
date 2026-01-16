import { and, count, desc, eq, gte } from 'drizzle-orm';
import { Effect, Schema } from 'effect';
import { connection, type NextRequest } from 'next/server';
import { Auth, createFullLayer, handleEffectExit } from '@/lib/api-handler';
import { aiTopics, knowledgeNodes } from '@/lib/db/schema';
import { DatabaseError, UnauthorizedError } from '@/lib/effect';
import { Database } from '@/lib/effect/services/database';
import { validateQueryParams } from '@/lib/validation';

// =============================================================================
// Query Schema
// =============================================================================

const querySchema = Schema.Struct({
  organizationId: Schema.String,
  period: Schema.optionalWith(Schema.Literal('7d', '30d', '90d', 'all'), { default: () => '30d' as const }),
  limit: Schema.optionalWith(Schema.NumberFromString.pipe(Schema.int(), Schema.between(1, 50)), {
    default: () => 20,
  }),
});

// =============================================================================
// GET /api/insights/topics - Get organization topic trends
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
    const { organizationId, period, limit } = params;

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

    // Get topics from aiTopics table (aggregated)
    const topics = yield* Effect.tryPromise({
      try: () =>
        db.query.aiTopics.findMany({
          where: and(eq(aiTopics.organizationId, organizationId), gte(aiTopics.lastMentionedAt, startDate)),
          orderBy: [desc(aiTopics.mentionCount)],
          limit,
        }),
      catch: () =>
        new DatabaseError({
          message: 'Failed to fetch topics',
          operation: 'getTopics',
        }),
    });

    // Also get topic nodes from knowledge graph for fallback/additional data
    const topicNodesResult = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            name: knowledgeNodes.name,
            count: count(),
          })
          .from(knowledgeNodes)
          .where(
            and(
              eq(knowledgeNodes.organizationId, organizationId),
              eq(knowledgeNodes.type, 'topic'),
              gte(knowledgeNodes.createdAt, startDate),
            ),
          )
          .groupBy(knowledgeNodes.name)
          .orderBy(desc(count()))
          .limit(limit),
      catch: () =>
        new DatabaseError({
          message: 'Failed to fetch topic nodes',
          operation: 'getTopicNodes',
        }),
    });

    // Get trending topics (mentioned more recently, higher in ranking)
    const midPeriod = new Date((now.getTime() + startDate.getTime()) / 2);

    const recentTopicsResult = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            name: knowledgeNodes.name,
            count: count(),
          })
          .from(knowledgeNodes)
          .where(
            and(
              eq(knowledgeNodes.organizationId, organizationId),
              eq(knowledgeNodes.type, 'topic'),
              gte(knowledgeNodes.createdAt, midPeriod),
            ),
          )
          .groupBy(knowledgeNodes.name)
          .orderBy(desc(count()))
          .limit(10),
      catch: () =>
        new DatabaseError({
          message: 'Failed to fetch recent topics',
          operation: 'getRecentTopics',
        }),
    });

    // Create a map of recent topics for trend calculation
    const recentTopicsMap = new Map(recentTopicsResult.map((t) => [t.name, t.count]));

    // Calculate trend direction for each topic
    const topicsWithTrends = topicNodesResult.map((topic) => {
      const recentCount = recentTopicsMap.get(topic.name) || 0;

      let trend: 'rising' | 'stable' | 'declining' = 'stable';
      let trendScore = 0;

      if (topic.count > 0) {
        const recentRatio = recentCount / topic.count;
        if (recentRatio > 0.6) {
          trend = 'rising';
          trendScore = Math.round((recentRatio - 0.5) * 200);
        } else if (recentRatio < 0.3) {
          trend = 'declining';
          trendScore = Math.round((recentRatio - 0.5) * 200);
        }
      }

      return {
        name: topic.name,
        mentionCount: topic.count,
        trend,
        trendScore,
      };
    });

    // Combine and deduplicate with aiTopics data
    const aiTopicsMap = new Map(topics.map((t) => [t.normalizedName, t]));
    const combinedTopics = topicsWithTrends.map((t) => {
      const aiTopic = aiTopicsMap.get(t.name.toLowerCase().trim());
      if (aiTopic) {
        return {
          id: aiTopic.id,
          name: aiTopic.name,
          mentionCount: aiTopic.mentionCount,
          videoCount: aiTopic.videoCount,
          trend: aiTopic.trend,
          trendScore: aiTopic.trendScore,
          keywords: aiTopic.keywords,
          lastMentionedAt: aiTopic.lastMentionedAt,
        };
      }
      return {
        id: null,
        name: t.name,
        mentionCount: t.mentionCount,
        videoCount: null,
        trend: t.trend,
        trendScore: t.trendScore,
        keywords: [],
        lastMentionedAt: null,
      };
    });

    // Get rising/declining summary
    const risingTopics = combinedTopics.filter((t) => t.trend === 'rising').slice(0, 5);
    const decliningTopics = combinedTopics.filter((t) => t.trend === 'declining').slice(0, 5);

    return {
      topics: combinedTopics,
      summary: {
        totalTopics: combinedTopics.length,
        risingCount: risingTopics.length,
        decliningCount: decliningTopics.length,
      },
      trending: {
        rising: risingTopics,
        declining: decliningTopics,
      },
      period,
    };
  });

  const runnable = Effect.provide(effect, FullLayer);
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
