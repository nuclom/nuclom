/**
 * Topic Cluster Service
 *
 * Groups related content items into topic clusters using:
 * 1. Semantic similarity (embedding vectors)
 * 2. Shared entities and tags
 * 3. AI-powered topic extraction
 *
 * Also tracks topic expertise by identifying who contributes most to each topic.
 */

import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { Context, Effect, Layer, Option } from 'effect';
import { db } from '../../../db';
import {
  type ContentItem,
  contentItems,
  contentSources,
  type TopicCluster as TopicClusterType,
  topicClusterMembers,
  topicClusters,
  topicExpertise,
} from '../../../db/schema';
import { ContentProcessingError, DatabaseError, NotFoundError } from '../../errors';
import { AI } from '../ai';
import { ContentRepository, type ContentRepositoryService } from '../content/content-repository';
import { Embedding } from '../embedding';

// =============================================================================
// Types
// =============================================================================

export interface CreateTopicClusterInput {
  readonly organizationId: string;
  readonly name: string;
  readonly description?: string;
  readonly keywords?: string[];
}

export interface TopicClusterWithMembers extends TopicClusterType {
  readonly members: Array<{
    contentItemId: string;
    similarityScore: number;
    contentItem?: {
      id: string;
      title?: string | null;
      type: string;
      sourceId: string;
    };
  }>;
}

export interface TopicExpertiseEntry {
  readonly userId?: string;
  readonly externalId?: string;
  readonly name: string;
  readonly clusterId: string;
  readonly contributionCount: number;
  readonly expertiseScore: number;
}

export interface ClusteringOptions {
  readonly organizationId: string;
  readonly sourceId?: string;
  readonly minClusterSize?: number;
  readonly maxClusters?: number;
  readonly similarityThreshold?: number;
  readonly useAI?: boolean;
}

export interface ClusteringResult {
  readonly clusters: Array<{
    name: string;
    description?: string;
    tags: string[];
    memberIds: string[];
    centroidEmbedding?: number[];
  }>;
  readonly unclusteredItems: string[];
}

// =============================================================================
// Service Interface
// =============================================================================

export interface TopicClusterService {
  /**
   * Create a new topic cluster
   */
  createCluster(input: CreateTopicClusterInput): Effect.Effect<TopicClusterType, DatabaseError>;

  /**
   * Get a cluster by ID with its members
   */
  getCluster(id: string): Effect.Effect<TopicClusterWithMembers, NotFoundError | DatabaseError>;

  /**
   * List clusters for an organization
   */
  listClusters(
    organizationId: string,
    options?: { parentId?: string; limit?: number; offset?: number },
  ): Effect.Effect<TopicClusterType[], DatabaseError>;

  /**
   * Add content items to a cluster
   */
  addToCluster(
    clusterId: string,
    itemIds: string[],
    relevanceScores?: Map<string, number>,
  ): Effect.Effect<void, NotFoundError | DatabaseError>;

  /**
   * Remove content items from a cluster
   */
  removeFromCluster(clusterId: string, itemIds: string[]): Effect.Effect<void, DatabaseError>;

  /**
   * Update cluster metadata
   */
  updateCluster(
    id: string,
    input: Partial<CreateTopicClusterInput>,
  ): Effect.Effect<TopicClusterType, NotFoundError | DatabaseError>;

  /**
   * Delete a cluster
   */
  deleteCluster(id: string): Effect.Effect<void, NotFoundError | DatabaseError>;

  /**
   * Auto-cluster content items using embeddings and AI
   */
  autoCluster(options: ClusteringOptions): Effect.Effect<ClusteringResult, ContentProcessingError | DatabaseError>;

  /**
   * Find the best cluster for a content item
   */
  findBestCluster(
    itemId: string,
  ): Effect.Effect<{ cluster: TopicClusterType; relevance: number } | null, DatabaseError>;

  /**
   * Get topic expertise rankings
   */
  getTopicExperts(clusterId: string, options?: { limit?: number }): Effect.Effect<TopicExpertiseEntry[], DatabaseError>;

  /**
   * Update expertise scores for a cluster
   */
  updateExpertiseScores(clusterId: string): Effect.Effect<void, DatabaseError>;

  /**
   * Get related clusters
   */
  getRelatedClusters(
    clusterId: string,
    options?: { limit?: number; minSimilarity?: number },
  ): Effect.Effect<Array<{ cluster: TopicClusterType; similarity: number }>, DatabaseError>;

  /**
   * Extract topics from content using AI
   */
  extractTopics(
    contentItemId: string,
  ): Effect.Effect<Array<{ topic: string; confidence: number }>, ContentProcessingError | DatabaseError>;
}

// =============================================================================
// Service Tag
// =============================================================================

export class TopicCluster extends Context.Tag('TopicCluster')<TopicCluster, TopicClusterService>() {}

// =============================================================================
// Service Implementation
// =============================================================================

const makeTopicClusterService = (
  contentRepository: ContentRepositoryService,
  embedding: Context.Tag.Service<Embedding>,
  ai: Context.Tag.Service<AI>,
): TopicClusterService => ({
  createCluster: (input) =>
    Effect.gen(function* () {
      // Generate embedding for the cluster
      const embeddingText = `${input.name} ${input.description || ''} ${(input.keywords || []).join(' ')}`;
      const embeddingResult = yield* embedding.generateEmbedding(embeddingText).pipe(Effect.option);

      const clusterData = {
        organizationId: input.organizationId,
        name: input.name,
        description: input.description,
        keywords: input.keywords || [],
        embeddingCentroid: Option.isSome(embeddingResult) ? [...embeddingResult.value] : undefined,
      };

      const result = yield* Effect.tryPromise({
        try: () =>
          db
            .insert(topicClusters)
            .values(clusterData)
            .returning()
            .then((rows) => rows[0]),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to create cluster: ${error}`,
            operation: 'insert',
            cause: error,
          }),
      });

      return result;
    }),

  getCluster: (id) =>
    Effect.gen(function* () {
      const cluster = yield* Effect.tryPromise({
        try: () => db.query.topicClusters.findFirst({ where: eq(topicClusters.id, id) }),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to get cluster: ${error}`,
            operation: 'select',
            cause: error,
          }),
      });

      if (!cluster) {
        return yield* Effect.fail(
          new NotFoundError({
            message: `Cluster not found: ${id}`,
            entity: 'topicCluster',
            id,
          }),
        );
      }

      // Get members
      const members = yield* Effect.tryPromise({
        try: () =>
          db
            .select({
              contentItemId: topicClusterMembers.contentItemId,
              similarityScore: topicClusterMembers.similarityScore,
              contentItem: {
                id: contentItems.id,
                title: contentItems.title,
                type: contentItems.type,
                sourceId: contentItems.sourceId,
              },
            })
            .from(topicClusterMembers)
            .leftJoin(contentItems, eq(topicClusterMembers.contentItemId, contentItems.id))
            .where(eq(topicClusterMembers.clusterId, id))
            .orderBy(desc(topicClusterMembers.similarityScore)),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to get members: ${error}`,
            operation: 'select',
            cause: error,
          }),
      });

      return {
        ...cluster,
        members: members.map((m) => ({
          contentItemId: m.contentItemId,
          similarityScore: m.similarityScore,
          contentItem: m.contentItem
            ? {
                id: m.contentItem.id,
                title: m.contentItem.title,
                type: m.contentItem.type,
                sourceId: m.contentItem.sourceId,
              }
            : undefined,
        })),
      } as TopicClusterWithMembers;
    }),

  listClusters: (organizationId, options = {}) =>
    Effect.gen(function* () {
      const { limit = 50, offset = 0 } = options;

      const result = yield* Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(topicClusters)
            .where(eq(topicClusters.organizationId, organizationId))
            .orderBy(desc(topicClusters.createdAt))
            .limit(limit)
            .offset(offset),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to list clusters: ${error}`,
            operation: 'select',
            cause: error,
          }),
      });

      return result;
    }),

  addToCluster: (clusterId, itemIds, similarityScores) =>
    Effect.gen(function* () {
      if (itemIds.length === 0) return;

      const values = itemIds.map((itemId) => ({
        clusterId: clusterId,
        contentItemId: itemId,
        similarityScore: similarityScores?.get(itemId) ?? 1.0,
      }));

      yield* Effect.tryPromise({
        try: () =>
          db
            .insert(topicClusterMembers)
            .values(values)
            .onConflictDoUpdate({
              target: [topicClusterMembers.clusterId, topicClusterMembers.contentItemId],
              set: {
                similarityScore: sql`EXCLUDED.similarity_score`,
              },
            }),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to add items to cluster: ${error}`,
            operation: 'insert',
            cause: error,
          }),
      });

      // Update cluster content count
      yield* Effect.tryPromise({
        try: () =>
          db
            .update(topicClusters)
            .set({
              contentCount: sql`(SELECT COUNT(*) FROM topic_cluster_members WHERE cluster_id = ${clusterId})`,
              updatedAt: new Date(),
            })
            .where(eq(topicClusters.id, clusterId)),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to update cluster count: ${error}`,
            operation: 'update',
            cause: error,
          }),
      });
    }),

  removeFromCluster: (clusterId, itemIds) =>
    Effect.gen(function* () {
      if (itemIds.length === 0) return;

      yield* Effect.tryPromise({
        try: () =>
          db
            .delete(topicClusterMembers)
            .where(
              and(eq(topicClusterMembers.clusterId, clusterId), inArray(topicClusterMembers.contentItemId, itemIds)),
            ),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to remove items from cluster: ${error}`,
            operation: 'delete',
            cause: error,
          }),
      });

      // Update cluster content count
      yield* Effect.tryPromise({
        try: () =>
          db
            .update(topicClusters)
            .set({
              contentCount: sql`(SELECT COUNT(*) FROM topic_cluster_members WHERE cluster_id = ${clusterId})`,
              updatedAt: new Date(),
            })
            .where(eq(topicClusters.id, clusterId)),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to update cluster count: ${error}`,
            operation: 'update',
            cause: error,
          }),
      });
    }),

  updateCluster: (id, input) =>
    Effect.gen(function* () {
      const updateData: Partial<TopicClusterType> = {};

      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.keywords !== undefined) updateData.keywords = input.keywords;

      updateData.updatedAt = new Date();

      // Regenerate embedding if name/description/keywords changed
      if (input.name || input.description || input.keywords) {
        const current = yield* Effect.tryPromise({
          try: () => db.query.topicClusters.findFirst({ where: eq(topicClusters.id, id) }),
          catch: (error) =>
            new DatabaseError({
              message: `Failed to get cluster: ${error}`,
              operation: 'select',
              cause: error,
            }),
        });

        if (current) {
          const embeddingText = `${input.name || current.name} ${input.description || current.description || ''} ${(input.keywords || current.keywords || []).join(' ')}`;
          const embeddingResult = yield* embedding.generateEmbedding(embeddingText).pipe(Effect.option);

          if (Option.isSome(embeddingResult)) {
            (updateData as { embeddingCentroid?: number[] }).embeddingCentroid = [...embeddingResult.value];
          }
        }
      }

      const result = yield* Effect.tryPromise({
        try: () =>
          db
            .update(topicClusters)
            .set(updateData)
            .where(eq(topicClusters.id, id))
            .returning()
            .then((rows) => rows[0]),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to update cluster: ${error}`,
            operation: 'update',
            cause: error,
          }),
      });

      if (!result) {
        return yield* Effect.fail(
          new NotFoundError({
            message: `Cluster not found: ${id}`,
            entity: 'topicCluster',
            id,
          }),
        );
      }

      return result;
    }),

  deleteCluster: (id) =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: () => db.delete(topicClusters).where(eq(topicClusters.id, id)).returning(),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to delete cluster: ${error}`,
            operation: 'delete',
            cause: error,
          }),
      });

      if (result.length === 0) {
        return yield* Effect.fail(
          new NotFoundError({
            message: `Cluster not found: ${id}`,
            entity: 'topicCluster',
            id,
          }),
        );
      }
    }),

  autoCluster: (options) =>
    Effect.gen(function* () {
      const {
        organizationId,
        sourceId,
        minClusterSize = 3,
        maxClusters = 20,
        similarityThreshold = 0.7,
        useAI = true,
      } = options;

      // Get content items with embeddings
      const items = yield* Effect.tryPromise({
        try: () => {
          const conditions = [eq(contentItems.organizationId, organizationId), sql`embedding_vector IS NOT NULL`];
          if (sourceId) {
            conditions.push(eq(contentItems.sourceId, sourceId));
          }
          return db
            .select()
            .from(contentItems)
            .where(and(...conditions))
            .limit(500);
        },
        catch: (error) =>
          new DatabaseError({
            message: `Failed to get items: ${error}`,
            operation: 'select',
            cause: error,
          }),
      });

      if (items.length < minClusterSize) {
        return { clusters: [], unclusteredItems: items.map((i) => i.id) };
      }

      // Simple clustering using K-means-like approach
      const clusters: Array<{
        name: string;
        description?: string;
        tags: string[];
        memberIds: string[];
        centroidEmbedding?: number[];
      }> = [];
      const clustered = new Set<string>();

      // Find cluster seeds (items that have many similar items)
      const itemEmbeddings = items.map((i) => ({
        id: i.id,
        title: i.title,
        tags: i.tags as string[],
        embedding: i.embeddingVector as number[],
      }));

      for (const item of itemEmbeddings) {
        if (clustered.has(item.id) || clusters.length >= maxClusters) {
          continue;
        }

        // Find similar items
        const similarItems = itemEmbeddings.filter((other) => {
          if (other.id === item.id || clustered.has(other.id)) {
            return false;
          }
          const similarity = cosineSimilarity(item.embedding, other.embedding);
          return similarity >= similarityThreshold;
        });

        if (similarItems.length >= minClusterSize - 1) {
          // Create cluster
          const clusterMembers = [item, ...similarItems];
          clusterMembers.forEach((m) => clustered.add(m.id));

          // Calculate centroid
          const centroid = calculateCentroid(clusterMembers.map((m) => m.embedding));

          // Extract common tags
          const tagCounts = new Map<string, number>();
          clusterMembers.forEach((m) => {
            (m.tags || []).forEach((tag) => {
              tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
            });
          });
          const commonTags = [...tagCounts.entries()]
            .filter(([_, count]) => count >= Math.ceil(clusterMembers.length / 2))
            .map(([tag]) => tag);

          // Generate cluster name
          let clusterName = `Topic ${clusters.length + 1}`;
          let clusterDescription: string | undefined;

          if (useAI && clusterMembers.length > 0) {
            // Use AI to generate a better name
            const titles = clusterMembers
              .slice(0, 5)
              .map((m) => m.title)
              .filter(Boolean)
              .join('\n');

            const nameResult = yield* ai
              .generateText(
                `Based on these content titles, suggest a short topic name (2-4 words) and brief description (1 sentence):
Titles:
${titles}

Tags: ${commonTags.join(', ')}

Return as JSON: {"name": "...", "description": "..."}`,
              )
              .pipe(Effect.option);

            if (Option.isSome(nameResult)) {
              try {
                const parsed = JSON.parse(nameResult.value);
                clusterName = parsed.name || clusterName;
                clusterDescription = parsed.description;
              } catch {
                // Use default name
              }
            }
          }

          clusters.push({
            name: clusterName,
            description: clusterDescription,
            tags: commonTags,
            memberIds: clusterMembers.map((m) => m.id),
            centroidEmbedding: centroid,
          });
        }
      }

      const unclusteredItems = items.filter((i) => !clustered.has(i.id)).map((i) => i.id);

      return { clusters, unclusteredItems };
    }),

  findBestCluster: (itemId) =>
    Effect.gen(function* () {
      // Get the item
      const itemOption = yield* contentRepository.getItemOption(itemId);
      if (Option.isNone(itemOption)) {
        return null;
      }
      const item = itemOption.value;

      if (!item.embeddingVector) {
        return null;
      }

      // Find most similar cluster
      const result = yield* Effect.tryPromise({
        try: () =>
          db
            .select({
              cluster: topicClusters,
              similarity: sql<number>`1 - (embedding_centroid <=> ${JSON.stringify(item.embeddingVector)}::vector)`,
            })
            .from(topicClusters)
            .where(and(eq(topicClusters.organizationId, item.organizationId), sql`embedding_centroid IS NOT NULL`))
            .orderBy(sql`embedding_centroid <=> ${JSON.stringify(item.embeddingVector)}::vector`)
            .limit(1),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to find cluster: ${error}`,
            operation: 'select',
            cause: error,
          }),
      });

      if (result.length === 0 || result[0].similarity < 0.5) {
        return null;
      }

      return {
        cluster: result[0].cluster,
        relevance: result[0].similarity,
      };
    }),

  getTopicExperts: (clusterId, options = {}) =>
    Effect.gen(function* () {
      const { limit = 10 } = options;

      const experts = yield* Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(topicExpertise)
            .where(eq(topicExpertise.clusterId, clusterId))
            .orderBy(desc(topicExpertise.expertiseScore))
            .limit(limit),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to get experts: ${error}`,
            operation: 'select',
            cause: error,
          }),
      });

      return experts.map((e) => ({
        userId: e.userId || undefined,
        externalId: e.externalId || undefined,
        name: e.name,
        clusterId: e.clusterId,
        contributionCount: e.contributionCount,
        expertiseScore: e.expertiseScore,
      }));
    }),

  updateExpertiseScores: (clusterId) =>
    Effect.gen(function* () {
      // Get all members with their authors
      const members = yield* Effect.tryPromise({
        try: () =>
          db
            .select({
              contentItemId: topicClusterMembers.contentItemId,
              similarityScore: topicClusterMembers.similarityScore,
              authorId: contentItems.authorId,
              authorExternal: contentItems.authorExternal,
              authorName: contentItems.authorName,
            })
            .from(topicClusterMembers)
            .innerJoin(contentItems, eq(topicClusterMembers.contentItemId, contentItems.id))
            .where(eq(topicClusterMembers.clusterId, clusterId)),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to get members: ${error}`,
            operation: 'select',
            cause: error,
          }),
      });

      // Aggregate by author
      const authorStats = new Map<
        string,
        { userId?: string; externalId?: string; name: string; count: number; similarity: number }
      >();

      for (const member of members) {
        const key = member.authorId || member.authorExternal || member.authorName || 'unknown';
        const existing = authorStats.get(key) || {
          userId: member.authorId || undefined,
          externalId: member.authorExternal || undefined,
          name: member.authorName || 'Unknown',
          count: 0,
          similarity: 0,
        };

        existing.count++;
        existing.similarity += member.similarityScore;
        authorStats.set(key, existing);
      }

      // Calculate expertise scores and update
      const maxCount = Math.max(...[...authorStats.values()].map((s) => s.count), 1);
      const maxSimilarity = Math.max(...[...authorStats.values()].map((s) => s.similarity), 1);

      for (const [_, stats] of authorStats) {
        const expertiseScore = (stats.count / maxCount) * 0.5 + (stats.similarity / maxSimilarity) * 0.5;

        yield* Effect.tryPromise({
          try: () =>
            db
              .insert(topicExpertise)
              .values({
                clusterId: clusterId,
                userId: stats.userId,
                externalId: stats.externalId,
                name: stats.name,
                contributionCount: stats.count,
                expertiseScore,
              })
              .onConflictDoUpdate({
                target: [topicExpertise.clusterId, topicExpertise.externalId],
                set: {
                  contributionCount: stats.count,
                  expertiseScore,
                  updatedAt: new Date(),
                },
              }),
          catch: (error) =>
            new DatabaseError({
              message: `Failed to update expertise: ${error}`,
              operation: 'upsert',
              cause: error,
            }),
        });
      }
    }),

  getRelatedClusters: (clusterId, options = {}) =>
    Effect.gen(function* () {
      const { limit = 5, minSimilarity = 0.5 } = options;

      // Get the cluster
      const cluster = yield* Effect.tryPromise({
        try: () => db.query.topicClusters.findFirst({ where: eq(topicClusters.id, clusterId) }),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to get cluster: ${error}`,
            operation: 'select',
            cause: error,
          }),
      });

      if (!cluster || !cluster.embeddingCentroid) {
        return [];
      }

      // Find similar clusters
      const result = yield* Effect.tryPromise({
        try: () =>
          db
            .select({
              cluster: topicClusters,
              similarity: sql<number>`1 - (embedding_centroid <=> ${JSON.stringify(cluster.embeddingCentroid)}::vector)`,
            })
            .from(topicClusters)
            .where(
              and(
                eq(topicClusters.organizationId, cluster.organizationId),
                sql`id != ${clusterId}`,
                sql`embedding_centroid IS NOT NULL`,
              ),
            )
            .orderBy(sql`embedding_centroid <=> ${JSON.stringify(cluster.embeddingCentroid)}::vector`)
            .limit(limit),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to find related clusters: ${error}`,
            operation: 'select',
            cause: error,
          }),
      });

      return result
        .filter((r) => r.similarity >= minSimilarity)
        .map((r) => ({
          cluster: r.cluster,
          similarity: r.similarity,
        }));
    }),

  extractTopics: (contentItemId) =>
    Effect.gen(function* () {
      // Get the content item
      const itemOption = yield* contentRepository.getItemOption(contentItemId);
      if (Option.isNone(itemOption)) {
        return yield* Effect.fail(
          new ContentProcessingError({
            message: `Content item not found: ${contentItemId}`,
            itemId: contentItemId,
            stage: 'extracting',
          }),
        );
      }

      const item = itemOption.value;
      const content = `${item.title || ''} ${item.content || ''}`.trim();

      if (content.length < 20) {
        return [];
      }

      // Use AI to extract topics
      const result = yield* ai
        .generateText(
          `Extract the main topics from this content. Return as JSON array with topic name and confidence (0-1):
Content: ${content.slice(0, 3000)}

Return format: [{"topic": "topic name", "confidence": 0.9}, ...]`,
        )
        .pipe(
          Effect.mapError(
            (err) =>
              new ContentProcessingError({
                message: `Topic extraction failed: ${err.message}`,
                itemId: contentItemId,
                stage: 'extracting',
                cause: err,
              }),
          ),
        );

      try {
        const jsonMatch = result.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          return [];
        }

        const topics = JSON.parse(jsonMatch[0]) as Array<{ topic: string; confidence: number }>;
        return topics.filter((t) => t.topic && t.confidence >= 0.5);
      } catch {
        return [];
      }
    }),
});

// =============================================================================
// Helper Functions
// =============================================================================

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

function calculateCentroid(embeddings: number[][]): number[] {
  if (embeddings.length === 0) return [];

  const dim = embeddings[0].length;
  const centroid = new Array(dim).fill(0);

  for (const embedding of embeddings) {
    for (let i = 0; i < dim; i++) {
      centroid[i] += embedding[i];
    }
  }

  for (let i = 0; i < dim; i++) {
    centroid[i] /= embeddings.length;
  }

  return centroid;
}

// =============================================================================
// Layer
// =============================================================================

export const TopicClusterLive = Layer.effect(
  TopicCluster,
  Effect.gen(function* () {
    const contentRepository = yield* ContentRepository;
    const embeddingService = yield* Embedding;
    const aiService = yield* AI;

    return makeTopicClusterService(contentRepository, embeddingService, aiService);
  }),
);

// =============================================================================
// Convenience Functions
// =============================================================================

export const createTopicCluster = (input: CreateTopicClusterInput) =>
  Effect.gen(function* () {
    const service = yield* TopicCluster;
    return yield* service.createCluster(input);
  });

export const getTopicCluster = (id: string) =>
  Effect.gen(function* () {
    const service = yield* TopicCluster;
    return yield* service.getCluster(id);
  });

export const autoClusterContent = (options: ClusteringOptions) =>
  Effect.gen(function* () {
    const service = yield* TopicCluster;
    return yield* service.autoCluster(options);
  });

export const getTopicExperts = (clusterId: string, options?: { limit?: number }) =>
  Effect.gen(function* () {
    const service = yield* TopicCluster;
    return yield* service.getTopicExperts(clusterId, options);
  });
