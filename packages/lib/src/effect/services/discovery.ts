/**
 * Discovery Service using Effect-TS
 *
 * Provides personalized content discovery across all content types:
 * - Personalized recommendations based on user activity
 * - Related content for specific items
 * - Trending content in organization
 *
 * Content types: decision, document, video, topic_cluster, content_item
 */

import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { Context, Data, Effect, Layer } from 'effect';
import { contentItems, decisions, topicClusters, users, videos } from '../../db/schema';
import { Database } from './database';
import { Embedding } from './embedding';

// =============================================================================
// Types
// =============================================================================

export type ContentType = 'decision' | 'document' | 'video' | 'topic_cluster' | 'content_item';

export interface RecommendedItem {
  readonly id: string;
  readonly type: ContentType;
  readonly title: string;
  readonly description: string | null;
  readonly score: number;
  readonly createdAt: Date;
  readonly author?: {
    readonly id: string;
    readonly name: string | null;
    readonly image: string | null;
  };
}

export interface RelatedItem {
  readonly id: string;
  readonly type: ContentType;
  readonly title: string;
  readonly description: string | null;
  readonly similarity: number;
}

export interface TrendingItem {
  readonly id: string;
  readonly type: ContentType;
  readonly title: string;
  readonly description: string | null;
  readonly trendingScore: number;
  readonly viewCount: number;
  readonly createdAt: Date;
}

export interface GetRecommendationsParams {
  readonly organizationId: string;
  readonly userId: string;
  readonly limit?: number;
  readonly contentTypes?: ReadonlyArray<ContentType>;
}

export interface GetRelatedContentParams {
  readonly itemId: string;
  readonly itemType: ContentType;
  readonly organizationId: string;
  readonly limit?: number;
}

export interface GetTrendingParams {
  readonly organizationId: string;
  readonly timeframe?: 'day' | 'week' | 'month';
  readonly limit?: number;
}

// =============================================================================
// Errors
// =============================================================================

export class DiscoveryError extends Data.TaggedError('DiscoveryError')<{
  readonly message: string;
  readonly operation: string;
  readonly cause?: unknown;
}> {}

// =============================================================================
// Service Interface
// =============================================================================

export interface DiscoveryServiceInterface {
  /**
   * Get personalized recommendations for a user
   */
  readonly getRecommendations: (params: GetRecommendationsParams) => Effect.Effect<RecommendedItem[], DiscoveryError>;

  /**
   * Get related content for a specific item
   */
  readonly getRelatedContent: (params: GetRelatedContentParams) => Effect.Effect<RelatedItem[], DiscoveryError>;

  /**
   * Get trending content in organization
   */
  readonly getTrending: (params: GetTrendingParams) => Effect.Effect<TrendingItem[], DiscoveryError>;
}

// =============================================================================
// Discovery Service Tag
// =============================================================================

export class Discovery extends Context.Tag('Discovery')<Discovery, DiscoveryServiceInterface>() {}

// =============================================================================
// Scoring Weights
// =============================================================================

const SCORING_WEIGHTS = {
  tagOverlap: 0.3,
  embeddingSimilarity: 0.3,
  recency: 0.2,
  popularity: 0.1,
  authorAffinity: 0.1,
} as const;

// =============================================================================
// Discovery Service Implementation
// =============================================================================

const makeDiscoveryService = Effect.gen(function* () {
  const { db } = yield* Database;

  /**
   * Get user's recent activity to understand preferences
   */
  const getUserPreferences = async (userId: string, organizationId: string) => {
    // Get recently created content by user
    const recentContent = await db
      .select({
        tags: contentItems.tags,
      })
      .from(contentItems)
      .where(and(eq(contentItems.organizationId, organizationId), eq(contentItems.authorId, userId)))
      .orderBy(desc(contentItems.createdAt))
      .limit(20);

    // Extract preferred tags
    const tagCounts = new Map<string, number>();
    for (const item of recentContent) {
      if (item.tags) {
        for (const tag of item.tags) {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
      }
    }

    return {
      preferredTags: tagCounts,
    };
  };

  /**
   * Calculate recency score (0-1) based on age
   */
  const calculateRecencyScore = (createdAt: Date): number => {
    const ageInDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (ageInDays < 1) return 1.0;
    if (ageInDays < 7) return 0.8;
    if (ageInDays < 30) return 0.6;
    if (ageInDays < 90) return 0.4;
    return 0.2;
  };

  const getRecommendations = (params: GetRecommendationsParams): Effect.Effect<RecommendedItem[], DiscoveryError> =>
    Effect.tryPromise({
      try: async () => {
        const limit = params.limit ?? 20;
        const contentTypes = params.contentTypes ?? ['decision', 'document', 'video', 'topic_cluster', 'content_item'];

        const preferences = await getUserPreferences(params.userId, params.organizationId);
        const results: RecommendedItem[] = [];

        // Fetch decisions if requested
        if (contentTypes.includes('decision')) {
          const decisionResults = await db
            .select({
              id: decisions.id,
              summary: decisions.summary,
              tags: decisions.tags,
              createdAt: decisions.createdAt,
            })
            .from(decisions)
            .where(eq(decisions.organizationId, params.organizationId))
            .orderBy(desc(decisions.createdAt))
            .limit(limit);

          for (const item of decisionResults) {
            let score = 0;

            // Tag overlap scoring
            if (item.tags) {
              for (const tag of item.tags) {
                score += (preferences.preferredTags.get(tag) || 0) * SCORING_WEIGHTS.tagOverlap;
              }
            }

            // Recency scoring
            score += calculateRecencyScore(item.createdAt) * SCORING_WEIGHTS.recency * 10;

            results.push({
              id: item.id,
              type: 'decision',
              title: item.summary,
              description: null,
              score,
              createdAt: item.createdAt,
            });
          }
        }

        // Fetch content items (documents) if requested
        if (contentTypes.includes('document') || contentTypes.includes('content_item')) {
          const documentResults = await db
            .select({
              id: contentItems.id,
              title: contentItems.title,
              summary: contentItems.summary,
              type: contentItems.type,
              createdAt: contentItems.createdAt,
              authorId: contentItems.authorId,
              authorName: contentItems.authorName,
            })
            .from(contentItems)
            .where(eq(contentItems.organizationId, params.organizationId))
            .orderBy(desc(contentItems.createdAt))
            .limit(limit);

          for (const item of documentResults) {
            const score = calculateRecencyScore(item.createdAt) * SCORING_WEIGHTS.recency * 10;

            results.push({
              id: item.id,
              type: item.type === 'document' ? 'document' : 'content_item',
              title: item.title || 'Untitled',
              description: item.summary,
              score,
              createdAt: item.createdAt,
              author: item.authorId
                ? {
                    id: item.authorId,
                    name: item.authorName,
                    image: null,
                  }
                : undefined,
            });
          }
        }

        // Fetch videos if requested
        if (contentTypes.includes('video')) {
          const videoResults = await db
            .select({
              id: videos.id,
              title: videos.title,
              description: videos.description,
              aiTags: videos.aiTags,
              createdAt: videos.createdAt,
              authorId: videos.authorId,
              authorName: users.name,
              authorImage: users.image,
            })
            .from(videos)
            .leftJoin(users, eq(videos.authorId, users.id))
            .where(
              and(
                eq(videos.organizationId, params.organizationId),
                isNull(videos.deletedAt),
                eq(videos.processingStatus, 'completed'),
              ),
            )
            .orderBy(desc(videos.createdAt))
            .limit(limit);

          for (const item of videoResults) {
            let score = 0;

            // Tag overlap scoring
            if (item.aiTags) {
              for (const tag of item.aiTags) {
                score += (preferences.preferredTags.get(tag) || 0) * SCORING_WEIGHTS.tagOverlap;
              }
            }

            // Recency scoring
            score += calculateRecencyScore(item.createdAt) * SCORING_WEIGHTS.recency * 10;

            results.push({
              id: item.id,
              type: 'video',
              title: item.title,
              description: item.description,
              score,
              createdAt: item.createdAt,
              author: item.authorId
                ? {
                    id: item.authorId,
                    name: item.authorName,
                    image: item.authorImage,
                  }
                : undefined,
            });
          }
        }

        // Fetch topic clusters if requested
        if (contentTypes.includes('topic_cluster')) {
          const topicResults = await db
            .select({
              id: topicClusters.id,
              name: topicClusters.name,
              description: topicClusters.description,
              createdAt: topicClusters.createdAt,
            })
            .from(topicClusters)
            .where(eq(topicClusters.organizationId, params.organizationId))
            .orderBy(desc(topicClusters.createdAt))
            .limit(limit);

          for (const item of topicResults) {
            const score = calculateRecencyScore(item.createdAt) * SCORING_WEIGHTS.recency * 10;

            results.push({
              id: item.id,
              type: 'topic_cluster',
              title: item.name,
              description: item.description,
              score,
              createdAt: item.createdAt,
            });
          }
        }

        // Sort by score and return top results
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, limit);
      },
      catch: (error) =>
        new DiscoveryError({
          message: 'Failed to get recommendations',
          operation: 'getRecommendations',
          cause: error,
        }),
    });

  const getRelatedContent = (params: GetRelatedContentParams): Effect.Effect<RelatedItem[], DiscoveryError> =>
    Effect.tryPromise({
      try: async () => {
        const limit = params.limit ?? 10;
        const results: RelatedItem[] = [];

        // Get the source item's tags based on type
        let sourceTags: string[] = [];

        switch (params.itemType) {
          case 'decision': {
            const source = await db
              .select({ tags: decisions.tags })
              .from(decisions)
              .where(eq(decisions.id, params.itemId))
              .limit(1);
            if (source[0]) {
              sourceTags = source[0].tags || [];
            }
            break;
          }
          case 'video': {
            const source = await db
              .select({ aiTags: videos.aiTags })
              .from(videos)
              .where(eq(videos.id, params.itemId))
              .limit(1);
            if (source[0]) {
              sourceTags = source[0].aiTags || [];
            }
            break;
          }
          case 'topic_cluster': {
            const source = await db
              .select({ keywords: topicClusters.keywords })
              .from(topicClusters)
              .where(eq(topicClusters.id, params.itemId))
              .limit(1);
            if (source[0]) {
              sourceTags = source[0].keywords || [];
            }
            break;
          }
          case 'document':
          case 'content_item': {
            const source = await db
              .select({ tags: contentItems.tags })
              .from(contentItems)
              .where(eq(contentItems.id, params.itemId))
              .limit(1);
            if (source[0]) {
              sourceTags = source[0].tags || [];
            }
            break;
          }
        }

        // Find related decisions by tags
        if (sourceTags.length > 0) {
          const relatedDecisions = await db
            .select({
              id: decisions.id,
              summary: decisions.summary,
              tags: decisions.tags,
            })
            .from(decisions)
            .where(and(eq(decisions.organizationId, params.organizationId), sql`${decisions.id} != ${params.itemId}`))
            .limit(limit * 2);

          const sourceTagSet = new Set(sourceTags);
          for (const item of relatedDecisions) {
            if (item.tags) {
              const overlap = item.tags.filter((t) => sourceTagSet.has(t)).length;
              if (overlap > 0) {
                const similarity = overlap / Math.max(sourceTags.length, item.tags.length);
                results.push({
                  id: item.id,
                  type: 'decision',
                  title: item.summary,
                  description: null,
                  similarity,
                });
              }
            }
          }
        }

        // Find related videos by tags
        if (sourceTags.length > 0) {
          const relatedVideos = await db
            .select({
              id: videos.id,
              title: videos.title,
              description: videos.description,
              aiTags: videos.aiTags,
            })
            .from(videos)
            .where(
              and(
                eq(videos.organizationId, params.organizationId),
                isNull(videos.deletedAt),
                eq(videos.processingStatus, 'completed'),
                sql`${videos.id} != ${params.itemId}`,
              ),
            )
            .limit(limit * 2);

          const sourceTagSet = new Set(sourceTags);
          for (const item of relatedVideos) {
            if (item.aiTags) {
              const overlap = item.aiTags.filter((t) => sourceTagSet.has(t)).length;
              if (overlap > 0) {
                const similarity = overlap / Math.max(sourceTags.length, item.aiTags.length);
                results.push({
                  id: item.id,
                  type: 'video',
                  title: item.title,
                  description: item.description,
                  similarity,
                });
              }
            }
          }
        }

        // Sort by similarity and return top results
        results.sort((a, b) => b.similarity - a.similarity);
        return results.slice(0, limit);
      },
      catch: (error) =>
        new DiscoveryError({
          message: 'Failed to get related content',
          operation: 'getRelatedContent',
          cause: error,
        }),
    });

  const getTrending = (params: GetTrendingParams): Effect.Effect<TrendingItem[], DiscoveryError> =>
    Effect.tryPromise({
      try: async () => {
        const limit = params.limit ?? 20;
        const timeframe = params.timeframe ?? 'week';

        // Calculate timeframe date
        const now = new Date();
        const timeframeDays = timeframe === 'day' ? 1 : timeframe === 'week' ? 7 : 30;
        const sinceDate = new Date(now.getTime() - timeframeDays * 24 * 60 * 60 * 1000);

        const results: TrendingItem[] = [];

        // Get trending decisions (by recent creation)
        const trendingDecisions = await db
          .select({
            id: decisions.id,
            summary: decisions.summary,
            createdAt: decisions.createdAt,
          })
          .from(decisions)
          .where(and(eq(decisions.organizationId, params.organizationId), gt(decisions.createdAt, sinceDate)))
          .orderBy(desc(decisions.createdAt))
          .limit(limit);

        for (const item of trendingDecisions) {
          const ageInDays = (Date.now() - item.createdAt.getTime()) / (1000 * 60 * 60 * 24);
          const recencyMultiplier = ageInDays < 1 ? 3 : ageInDays < 7 ? 2 : 1;
          const trendingScore = recencyMultiplier * 10;

          results.push({
            id: item.id,
            type: 'decision',
            title: item.summary,
            description: null,
            trendingScore,
            viewCount: 0,
            createdAt: item.createdAt,
          });
        }

        // Get trending content items
        const trendingContentItems = await db
          .select({
            id: contentItems.id,
            title: contentItems.title,
            summary: contentItems.summary,
            createdAt: contentItems.createdAt,
          })
          .from(contentItems)
          .where(and(eq(contentItems.organizationId, params.organizationId), gt(contentItems.createdAt, sinceDate)))
          .orderBy(desc(contentItems.createdAt))
          .limit(limit);

        for (const item of trendingContentItems) {
          const ageInDays = (Date.now() - item.createdAt.getTime()) / (1000 * 60 * 60 * 24);
          const recencyMultiplier = ageInDays < 1 ? 3 : ageInDays < 7 ? 2 : 1;
          const trendingScore = recencyMultiplier * 10;

          results.push({
            id: item.id,
            type: 'content_item',
            title: item.title || 'Untitled',
            description: item.summary,
            trendingScore,
            viewCount: 0,
            createdAt: item.createdAt,
          });
        }

        // Get trending videos
        const trendingVideos = await db
          .select({
            id: videos.id,
            title: videos.title,
            description: videos.description,
            createdAt: videos.createdAt,
          })
          .from(videos)
          .where(
            and(
              eq(videos.organizationId, params.organizationId),
              isNull(videos.deletedAt),
              eq(videos.processingStatus, 'completed'),
              gt(videos.createdAt, sinceDate),
            ),
          )
          .orderBy(desc(videos.createdAt))
          .limit(limit);

        for (const item of trendingVideos) {
          const ageInDays = (Date.now() - item.createdAt.getTime()) / (1000 * 60 * 60 * 24);
          const recencyMultiplier = ageInDays < 1 ? 3 : ageInDays < 7 ? 2 : 1;
          const trendingScore = recencyMultiplier * 10;

          results.push({
            id: item.id,
            type: 'video',
            title: item.title,
            description: item.description,
            trendingScore,
            viewCount: 0,
            createdAt: item.createdAt,
          });
        }

        // Sort by trending score and return top results
        results.sort((a, b) => b.trendingScore - a.trendingScore);
        return results.slice(0, limit);
      },
      catch: (error) =>
        new DiscoveryError({
          message: 'Failed to get trending content',
          operation: 'getTrending',
          cause: error,
        }),
    });

  return {
    getRecommendations,
    getRelatedContent,
    getTrending,
  } satisfies DiscoveryServiceInterface;
});

// =============================================================================
// Discovery Layer
// =============================================================================

export const DiscoveryLive = Layer.effect(Discovery, makeDiscoveryService);

// =============================================================================
// Helper Functions
// =============================================================================

export const getRecommendations = (
  params: GetRecommendationsParams,
): Effect.Effect<RecommendedItem[], DiscoveryError, Discovery> =>
  Effect.gen(function* () {
    const service = yield* Discovery;
    return yield* service.getRecommendations(params);
  });

export const getRelatedContent = (
  params: GetRelatedContentParams,
): Effect.Effect<RelatedItem[], DiscoveryError, Discovery> =>
  Effect.gen(function* () {
    const service = yield* Discovery;
    return yield* service.getRelatedContent(params);
  });

export const getTrending = (params: GetTrendingParams): Effect.Effect<TrendingItem[], DiscoveryError, Discovery> =>
  Effect.gen(function* () {
    const service = yield* Discovery;
    return yield* service.getTrending(params);
  });
