import { Auth, createFullLayer, handleEffectExit } from '@nuclom/lib/api-handler';
import { aiTopics, decisions, knowledgeNodes } from '@nuclom/lib/db/schema';
import { DatabaseError, UnauthorizedError } from '@nuclom/lib/effect/errors';
import { Database } from '@nuclom/lib/effect/services/database';
import { validateQueryParams } from '@nuclom/lib/validation';
import { and, count, desc, eq, gte } from 'drizzle-orm';
import { Effect, Schema } from 'effect';
import { connection, type NextRequest } from 'next/server';

// =============================================================================
// Query Schema
// =============================================================================

const querySchema = Schema.Struct({
  organizationId: Schema.String,
  period: Schema.optionalWith(Schema.Literal('7d', '30d', '90d', 'all'), { default: () => '30d' as const }),
  limit: Schema.optionalWith(Schema.NumberFromString.pipe(Schema.int(), Schema.between(10, 100)), {
    default: () => 50,
  }),
});

// =============================================================================
// Helper to extract keywords from text
// =============================================================================

function extractKeywords(text: string): string[] {
  // Common stop words to filter out
  const stopWords = new Set([
    'a',
    'an',
    'the',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'by',
    'from',
    'up',
    'about',
    'into',
    'over',
    'after',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'must',
    'shall',
    'can',
    'need',
    'dare',
    'ought',
    'used',
    'it',
    'its',
    'they',
    'them',
    'their',
    'this',
    'that',
    'these',
    'those',
    'i',
    'me',
    'my',
    'myself',
    'we',
    'our',
    'ours',
    'ourselves',
    'you',
    'your',
    'yours',
    'he',
    'him',
    'his',
    'she',
    'her',
    'hers',
    'who',
    'whom',
    'which',
    'what',
    'where',
    'when',
    'why',
    'how',
    'all',
    'each',
    'every',
    'both',
    'few',
    'more',
    'most',
    'other',
    'some',
    'such',
    'no',
    'nor',
    'not',
    'only',
    'own',
    'same',
    'so',
    'than',
    'too',
    'very',
    'just',
    'also',
    'now',
    'here',
    'there',
    'then',
    'once',
    'if',
    'unless',
    'while',
    'although',
    'though',
    'because',
    'since',
    'until',
    'when',
    'whenever',
    'where',
    'wherever',
    'whether',
    'which',
    'whichever',
    'whoever',
    'whomever',
    'going',
    'get',
    'got',
    'getting',
    'like',
    'think',
    'know',
    'want',
    'make',
    'see',
    'use',
    'using',
    'used',
    'let',
    'way',
    'thing',
    'things',
    'something',
    'anything',
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word))
    .slice(0, 100); // Limit per text
}

// =============================================================================
// GET /api/insights/keywords - Get keyword frequency for word cloud
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

    // Get keywords from AI topics
    const topicsResult = yield* Effect.tryPromise({
      try: () =>
        db.query.aiTopics.findMany({
          where: and(eq(aiTopics.organizationId, organizationId), gte(aiTopics.lastMentionedAt, startDate)),
          columns: {
            name: true,
            keywords: true,
            mentionCount: true,
          },
        }),
      catch: () =>
        new DatabaseError({
          message: 'Failed to fetch topics',
          operation: 'getTopics',
        }),
    });

    // Get topic names from knowledge nodes
    const knowledgeTopicsResult = yield* Effect.tryPromise({
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
          .limit(100),
      catch: () =>
        new DatabaseError({
          message: 'Failed to fetch knowledge topics',
          operation: 'getKnowledgeTopics',
        }),
    });

    // Get decision tags for additional keywords
    const decisionTagsResult = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            tags: decisions.tags,
          })
          .from(decisions)
          .where(and(eq(decisions.organizationId, organizationId), gte(decisions.createdAt, startDate))),
      catch: () =>
        new DatabaseError({
          message: 'Failed to fetch decision tags',
          operation: 'getDecisionTags',
        }),
    });

    // Get video titles and AI tags for keywords
    const videosResult = yield* Effect.tryPromise({
      try: () =>
        db.query.videos.findMany({
          where: (videos, { and, eq, gte }) =>
            and(eq(videos.organizationId, organizationId), gte(videos.createdAt, startDate)),
          columns: {
            title: true,
            aiTags: true,
          },
          limit: 200,
        }),
      catch: () =>
        new DatabaseError({
          message: 'Failed to fetch videos',
          operation: 'getVideos',
        }),
    });

    // Aggregate keywords from all sources
    const keywordCounts = new Map<string, number>();

    // Add topic names with their mention counts
    for (const topic of topicsResult) {
      const normalizedName = topic.name.toLowerCase().trim();
      keywordCounts.set(normalizedName, (keywordCounts.get(normalizedName) || 0) + topic.mentionCount);

      // Add associated keywords
      if (topic.keywords) {
        for (const keyword of topic.keywords) {
          const normalizedKeyword = keyword.toLowerCase().trim();
          if (normalizedKeyword.length > 2) {
            keywordCounts.set(normalizedKeyword, (keywordCounts.get(normalizedKeyword) || 0) + 1);
          }
        }
      }
    }

    // Add knowledge node topics
    for (const topic of knowledgeTopicsResult) {
      const normalizedName = topic.name.toLowerCase().trim();
      keywordCounts.set(normalizedName, (keywordCounts.get(normalizedName) || 0) + topic.count);
    }

    // Add decision tags
    for (const decision of decisionTagsResult) {
      if (decision.tags) {
        for (const tag of decision.tags) {
          const normalizedTag = tag.toLowerCase().trim();
          if (normalizedTag.length > 2) {
            keywordCounts.set(normalizedTag, (keywordCounts.get(normalizedTag) || 0) + 1);
          }
        }
      }
    }

    // Add video AI tags
    for (const video of videosResult) {
      if (video.aiTags) {
        for (const tag of video.aiTags) {
          const normalizedTag = tag.toLowerCase().trim();
          if (normalizedTag.length > 2) {
            keywordCounts.set(normalizedTag, (keywordCounts.get(normalizedTag) || 0) + 1);
          }
        }
      }

      // Extract keywords from titles
      if (video.title) {
        const titleKeywords = extractKeywords(video.title);
        for (const keyword of titleKeywords) {
          keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
        }
      }
    }

    // Convert to array and sort by count
    const sortedKeywords = Array.from(keywordCounts.entries())
      .filter(([word]) => word.length > 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    // Normalize weights for visualization (1-10 scale)
    const maxCount = sortedKeywords[0]?.[1] || 1;
    const minCount = sortedKeywords[sortedKeywords.length - 1]?.[1] || 1;

    const keywords = sortedKeywords.map(([word, count]) => ({
      word,
      count,
      weight: Math.round(((count - minCount) / (maxCount - minCount || 1)) * 9 + 1),
    }));

    // Group keywords by category (approximate)
    const categories = {
      technical: keywords.filter((k) =>
        ['api', 'database', 'code', 'bug', 'feature', 'deploy', 'test', 'build', 'integration'].some((t) =>
          k.word.includes(t),
        ),
      ),
      product: keywords.filter((k) =>
        ['user', 'customer', 'design', 'ux', 'ui', 'experience', 'feedback', 'launch'].some((t) => k.word.includes(t)),
      ),
      process: keywords.filter((k) =>
        ['meeting', 'sprint', 'review', 'planning', 'standup', 'retro', 'deadline', 'timeline'].some((t) =>
          k.word.includes(t),
        ),
      ),
    };

    return {
      keywords,
      summary: {
        totalKeywords: keywords.length,
        totalOccurrences: keywords.reduce((sum, k) => sum + k.count, 0),
      },
      categories,
      period,
    };
  });

  const runnable = Effect.provide(effect, FullLayer);
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
