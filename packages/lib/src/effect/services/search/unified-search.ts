/**
 * Unified Search Service
 *
 * Provides cross-source search capabilities combining:
 * 1. Videos (existing)
 * 2. Content items (Slack, Notion, GitHub, etc.)
 *
 * Supports keyword search, semantic search, and hybrid search.
 */

import { and, count, desc, eq, gte, ilike, inArray, lte, or, sql } from 'drizzle-orm';
import { Context, Effect, Layer } from 'effect';
import {
  type ContentItem,
  type ContentSource,
  contentItems,
  contentSources,
  topicClusterMembers,
  topicClusters,
  users,
  videos,
} from '../../../db/schema';
import type { VideoWithAuthor } from '../../../types';
import { DatabaseError } from '../../errors';
import { Database, type DrizzleDB } from '../database';
import { Embedding, type EmbeddingServiceInterface } from '../embedding';

// =============================================================================
// Types
// =============================================================================

export type ContentSourceType = 'video' | 'slack' | 'notion' | 'github' | 'google_drive' | 'confluence' | 'linear';
export type ContentItemType =
  | 'video'
  | 'message'
  | 'thread'
  | 'document'
  | 'issue'
  | 'pull_request'
  | 'comment'
  | 'file';

export interface UnifiedSearchParams {
  readonly query: string;
  readonly organizationId: string;

  // Source filtering
  readonly sources?: ContentSourceType[];
  readonly sourceIds?: string[];

  // Content type filtering
  readonly contentTypes?: ContentItemType[];

  // Temporal filtering
  readonly dateRange?: {
    readonly from?: Date;
    readonly to?: Date;
  };

  // Entity filtering
  readonly participants?: string[];
  readonly topicIds?: string[];

  // Search configuration
  readonly mode?: 'keyword' | 'semantic' | 'hybrid';
  readonly semanticWeight?: number; // 0-1, default 0.5
  readonly semanticThreshold?: number; // Default 0.6

  // Result options
  readonly includeVideos?: boolean; // Default true
  readonly includeContentItems?: boolean; // Default true
  readonly includeFacets?: boolean;
  readonly includeHighlights?: boolean;

  // Pagination
  readonly limit?: number;
  readonly offset?: number;
}

export interface UnifiedSearchResult {
  readonly results: UnifiedSearchResultItem[];
  readonly facets?: SearchFacets;
  readonly totalCount: number;
  readonly hasMore: boolean;
  readonly searchTimeMs: number;
}

export interface UnifiedSearchResultItem {
  readonly type: 'video' | 'content_item';
  readonly video?: VideoWithAuthor;
  readonly contentItem?: ContentItemWithSource;

  // Scoring
  readonly score: number;
  readonly scoreBreakdown: {
    readonly keywordScore: number;
    readonly semanticScore: number;
    readonly recencyBoost: number;
  };

  // Highlights
  readonly highlights?: {
    readonly title?: string;
    readonly content?: string;
  };

  // Context
  readonly context?: {
    readonly topicCluster?: { id: string; name: string };
    readonly sourceType?: ContentSourceType;
  };
}

export interface ContentItemWithSource extends ContentItem {
  readonly source?: ContentSource;
  readonly author?: { id: string; name: string | null; email: string | null };
}

export interface SearchFacets {
  readonly sources: Array<{ source: string; count: number }>;
  readonly contentTypes: Array<{ type: string; count: number }>;
  readonly participants: Array<{ name: string; userId?: string; count: number }>;
  readonly topics: Array<{ name: string; clusterId: string; count: number }>;
  readonly dateHistogram: Array<{ date: string; count: number }>;
}

export interface SearchSuggestion {
  readonly text: string;
  readonly type: 'recent' | 'popular' | 'autocomplete';
}

// =============================================================================
// Service Interface
// =============================================================================

export interface UnifiedSearchService {
  /**
   * Unified search across all content types
   */
  search(params: UnifiedSearchParams): Effect.Effect<UnifiedSearchResult, DatabaseError>;

  /**
   * Search only content items (Slack, Notion, GitHub)
   */
  searchContentItems(params: UnifiedSearchParams): Effect.Effect<ContentItemWithSource[], DatabaseError>;

  /**
   * Get search facets for filtering
   */
  getFacets(organizationId: string, query?: string): Effect.Effect<SearchFacets, DatabaseError>;

  /**
   * Get autocomplete suggestions
   */
  getSuggestions(
    prefix: string,
    organizationId: string,
    limit?: number,
  ): Effect.Effect<SearchSuggestion[], DatabaseError>;
}

// =============================================================================
// Service Tag
// =============================================================================

export class UnifiedSearch extends Context.Tag('UnifiedSearch')<UnifiedSearch, UnifiedSearchService>() {}

// =============================================================================
// Service Implementation
// =============================================================================

const makeUnifiedSearchService = (
  db: DrizzleDB,
  embeddingService: EmbeddingServiceInterface,
): UnifiedSearchService => ({
  search: (params) =>
    Effect.gen(function* () {
      const startTime = Date.now();
      const {
        query,
        organizationId,
        sources,
        sourceIds,
        contentTypes,
        dateRange,
        mode = 'hybrid',
        semanticWeight = 0.5,
        semanticThreshold = 0.6,
        includeVideos = true,
        includeContentItems = true,
        includeFacets = false,
        includeHighlights = true,
        limit = 20,
        offset = 0,
      } = params;

      const keywordWeight = 1 - semanticWeight;
      const results: UnifiedSearchResultItem[] = [];
      let facets: SearchFacets | undefined;

      // Generate query embedding for semantic/hybrid search
      let queryEmbedding: number[] | null = null;
      if (mode === 'semantic' || mode === 'hybrid') {
        const embeddingResult = yield* embeddingService.generateEmbedding(query).pipe(
          Effect.map((e) => [...e] as number[]),
          Effect.catchAll(() => Effect.succeed(null)),
        );
        queryEmbedding = embeddingResult;
      }

      // Search videos if enabled
      if (includeVideos && (!sources || sources.includes('video'))) {
        const videoResults = yield* searchVideos({
          db,
          query,
          organizationId,
          queryEmbedding,
          mode,
          keywordWeight,
          semanticWeight,
          semanticThreshold,
          dateRange,
          includeHighlights,
          limit: limit * 2, // Get extra to merge
        });
        results.push(...videoResults);
      }

      // Search content items if enabled
      if (includeContentItems) {
        const contentResults = yield* searchContentItemsInternal({
          db,
          query,
          organizationId,
          queryEmbedding,
          sources: sources?.filter((s) => s !== 'video'),
          sourceIds,
          contentTypes,
          mode,
          keywordWeight,
          semanticWeight,
          semanticThreshold,
          dateRange,
          includeHighlights,
          limit: limit * 2,
        });
        results.push(...contentResults);
      }

      // Sort by combined score
      const sortedResults = results.toSorted((a, b) => b.score - a.score);

      // Apply pagination
      const paginatedResults = sortedResults.slice(offset, offset + limit);

      // Get facets if requested
      if (includeFacets) {
        facets = yield* getFacetsInternal(db, organizationId, query);
      }

      return {
        results: paginatedResults,
        facets,
        totalCount: sortedResults.length,
        hasMore: sortedResults.length > offset + limit,
        searchTimeMs: Date.now() - startTime,
      };
    }),

  searchContentItems: (params) =>
    Effect.gen(function* () {
      const {
        query,
        organizationId,
        sources,
        sourceIds,
        contentTypes,
        dateRange,
        mode = 'hybrid',
        semanticThreshold = 0.6,
        limit = 20,
        offset = 0,
      } = params;

      // Generate embedding
      let queryEmbedding: number[] | null = null;
      if (mode === 'semantic' || mode === 'hybrid') {
        const embeddingResult = yield* embeddingService.generateEmbedding(query).pipe(
          Effect.map((e) => [...e] as number[]),
          Effect.catchAll(() => Effect.succeed(null)),
        );
        queryEmbedding = embeddingResult;
      }

      // Build query conditions
      const conditions = [eq(contentItems.organizationId, organizationId)];

      if (sources && sources.length > 0) {
        // Filter by source type through content_sources join
        conditions.push(
          sql`${contentItems.sourceId} IN (
            SELECT id FROM content_sources
            WHERE type = ANY(${sources})
          )`,
        );
      }

      if (sourceIds && sourceIds.length > 0) {
        conditions.push(inArray(contentItems.sourceId, sourceIds));
      }

      if (contentTypes && contentTypes.length > 0) {
        conditions.push(inArray(contentItems.type, contentTypes));
      }

      if (dateRange?.from) {
        conditions.push(gte(contentItems.createdAtSource, dateRange.from));
      }
      if (dateRange?.to) {
        conditions.push(lte(contentItems.createdAtSource, dateRange.to));
      }

      // Execute search based on mode
      let items: ContentItemWithSource[] = [];

      if (mode === 'keyword' || (mode === 'hybrid' && !queryEmbedding)) {
        // Keyword search using ILIKE
        items = yield* Effect.tryPromise({
          try: () =>
            db
              .select({
                item: contentItems,
                source: contentSources,
              })
              .from(contentItems)
              .leftJoin(contentSources, eq(contentItems.sourceId, contentSources.id))
              .where(
                and(
                  ...conditions,
                  or(
                    ilike(contentItems.title, `%${query}%`),
                    ilike(contentItems.content, `%${query}%`),
                    ilike(contentItems.searchText, `%${query}%`),
                  ),
                ),
              )
              .orderBy(desc(contentItems.createdAtSource))
              .limit(limit)
              .offset(offset)
              .then((rows) =>
                rows.map((r) => ({
                  ...r.item,
                  source: r.source || undefined,
                })),
              ),
          catch: (error) =>
            new DatabaseError({
              message: `Keyword search failed: ${error}`,
              operation: 'searchContentItems',
              cause: error,
            }),
        });
      } else if (queryEmbedding) {
        // Semantic or hybrid search
        const embeddingStr = `[${queryEmbedding.join(',')}]`;

        items = yield* Effect.tryPromise({
          try: () =>
            db
              .execute<{
                id: string;
                organization_id: string;
                source_id: string;
                type: string;
                external_id: string;
                title: string | null;
                content: string | null;
                content_html: string | null;
                author_id: string | null;
                author_external: string | null;
                author_name: string | null;
                created_at_source: Date | null;
                updated_at_source: Date | null;
                metadata: Record<string, unknown>;
                tags: string[];
                processing_status: string;
                processing_error: string | null;
                processed_at: Date | null;
                summary: string | null;
                key_points: unknown[];
                sentiment: string | null;
                embedding_vector: number[] | null;
                search_text: string | null;
                created_at: Date;
                updated_at: Date;
                similarity: number;
                source_type: string | null;
                source_name: string | null;
              }>(sql`
              SELECT
                ci.*,
                1 - (ci.embedding_vector <=> ${embeddingStr}::vector) as similarity,
                cs.type as source_type,
                cs.name as source_name
              FROM content_items ci
              LEFT JOIN content_sources cs ON cs.id = ci.source_id
              WHERE ci.organization_id = ${organizationId}
                AND ci.embedding_vector IS NOT NULL
                ${sources && sources.length > 0 ? sql`AND cs.type = ANY(${sources})` : sql``}
                ${sourceIds && sourceIds.length > 0 ? sql`AND ci.source_id = ANY(${sourceIds})` : sql``}
                ${contentTypes && contentTypes.length > 0 ? sql`AND ci.type = ANY(${contentTypes})` : sql``}
                ${dateRange?.from ? sql`AND ci.created_at_source >= ${dateRange.from}` : sql``}
                ${dateRange?.to ? sql`AND ci.created_at_source <= ${dateRange.to}` : sql``}
                AND 1 - (ci.embedding_vector <=> ${embeddingStr}::vector) >= ${semanticThreshold}
              ORDER BY similarity DESC
              LIMIT ${limit}
              OFFSET ${offset}
            `)
              .then((rows) =>
                rows.map((r) => ({
                  id: r.id,
                  organizationId: r.organization_id,
                  sourceId: r.source_id,
                  type: r.type as ContentItemType,
                  externalId: r.external_id,
                  title: r.title,
                  content: r.content,
                  contentHtml: r.content_html,
                  authorId: r.author_id,
                  authorExternal: r.author_external,
                  authorName: r.author_name,
                  createdAtSource: r.created_at_source,
                  updatedAtSource: r.updated_at_source,
                  metadata: r.metadata,
                  tags: r.tags,
                  processingStatus: r.processing_status,
                  processingError: r.processing_error,
                  processedAt: r.processed_at,
                  summary: r.summary,
                  keyPoints: r.key_points,
                  sentiment: r.sentiment,
                  embeddingVector: r.embedding_vector,
                  searchText: r.search_text,
                  createdAt: r.created_at,
                  updatedAt: r.updated_at,
                  source: r.source_type
                    ? {
                        id: r.source_id,
                        type: r.source_type as ContentSourceType,
                        name: r.source_name || '',
                      }
                    : undefined,
                })),
              ) as Promise<ContentItemWithSource[]>,
          catch: (error) =>
            new DatabaseError({
              message: `Semantic search failed: ${error}`,
              operation: 'searchContentItems',
              cause: error,
            }),
        });
      }

      return items;
    }),

  getFacets: (organizationId, query) => getFacetsInternal(db, organizationId, query),

  getSuggestions: (prefix, organizationId, limit = 10) =>
    Effect.gen(function* () {
      // Get recent search terms from content
      const suggestions = yield* Effect.tryPromise({
        try: async () => {
          const titleMatches = await db
            .selectDistinct({ title: contentItems.title })
            .from(contentItems)
            .where(and(eq(contentItems.organizationId, organizationId), ilike(contentItems.title, `%${prefix}%`)))
            .limit(limit);

          return titleMatches
            .filter((t): t is { title: string } => t.title != null)
            .map((t) => ({
              text: t.title,
              type: 'autocomplete' as const,
            }));
        },
        catch: (error) =>
          new DatabaseError({
            message: `Failed to get suggestions: ${error}`,
            operation: 'getSuggestions',
            cause: error,
          }),
      });

      return suggestions;
    }),
});

// =============================================================================
// Internal Helper Functions
// =============================================================================

interface InternalSearchParams {
  db: DrizzleDB;
  query: string;
  organizationId: string;
  queryEmbedding: number[] | null;
  mode: 'keyword' | 'semantic' | 'hybrid';
  keywordWeight: number;
  semanticWeight: number;
  semanticThreshold: number;
  dateRange?: { from?: Date; to?: Date };
  includeHighlights: boolean;
  limit: number;
}

interface ContentSearchParams extends InternalSearchParams {
  sources?: ContentSourceType[];
  sourceIds?: string[];
  contentTypes?: ContentItemType[];
}

const searchVideos = (params: InternalSearchParams): Effect.Effect<UnifiedSearchResultItem[], DatabaseError> =>
  Effect.tryPromise({
    try: async () => {
      const {
        db,
        query,
        organizationId,
        queryEmbedding,
        mode,
        keywordWeight,
        semanticWeight,
        semanticThreshold,
        dateRange,
        includeHighlights,
        limit,
      } = params;

      const results: UnifiedSearchResultItem[] = [];

      // Build base conditions
      const conditions = [eq(videos.organizationId, organizationId)];
      if (dateRange?.from) conditions.push(gte(videos.createdAt, dateRange.from));
      if (dateRange?.to) conditions.push(lte(videos.createdAt, dateRange.to));

      // Keyword search
      if (mode === 'keyword' || mode === 'hybrid') {
        const keywordResults = await db
          .select({
            video: videos,
            author: users,
          })
          .from(videos)
          .leftJoin(users, eq(videos.authorId, users.id))
          .where(
            and(
              ...conditions,
              or(
                ilike(videos.title, `%${query}%`),
                ilike(videos.description, `%${query}%`),
                ilike(videos.transcript, `%${query}%`),
              ),
            ),
          )
          .orderBy(desc(videos.createdAt))
          .limit(limit);

        for (const row of keywordResults) {
          const video = {
            ...row.video,
            author: row.author,
          } as VideoWithAuthor;

          results.push({
            type: 'video',
            video,
            score: keywordWeight, // Base score for keyword match
            scoreBreakdown: {
              keywordScore: 1,
              semanticScore: 0,
              recencyBoost: calculateRecencyBoost(row.video.createdAt),
            },
            highlights: includeHighlights ? generateHighlights(query, row.video) : undefined,
            context: { sourceType: 'video' },
          });
        }
      }

      // Semantic search (if embedding available)
      if ((mode === 'semantic' || mode === 'hybrid') && queryEmbedding) {
        const embeddingStr = `[${queryEmbedding.join(',')}]`;

        // Search transcript chunks
        const semanticResults = await db.execute<{
          video_id: string;
          similarity: number;
          text_preview: string;
        }>(sql`
          SELECT DISTINCT ON (tc.video_id)
            tc.video_id,
            1 - (tc.embedding::vector <=> ${embeddingStr}::vector) as similarity,
            LEFT(tc.text, 200) as text_preview
          FROM transcript_chunks tc
          JOIN videos v ON v.id = tc.video_id
          WHERE tc.organization_id = ${organizationId}
            AND tc.embedding IS NOT NULL
            AND 1 - (tc.embedding::vector <=> ${embeddingStr}::vector) >= ${semanticThreshold}
          ORDER BY tc.video_id, similarity DESC
          LIMIT ${limit}
        `);

        // Fetch video details for semantic results
        const videoIds = semanticResults.map((r) => r.video_id);
        if (videoIds.length > 0) {
          const videosData = await db
            .select({
              video: videos,
              author: users,
            })
            .from(videos)
            .leftJoin(users, eq(videos.authorId, users.id))
            .where(inArray(videos.id, videoIds));

          const videoMap = new Map(videosData.map((v) => [v.video.id, v]));

          for (const row of semanticResults) {
            const videoData = videoMap.get(row.video_id);
            if (!videoData) continue;

            // Check if already in results from keyword search
            const existingIdx = results.findIndex((r) => r.video?.id === row.video_id);
            if (existingIdx >= 0) {
              // Merge scores
              const existing = results[existingIdx];
              results[existingIdx] = {
                ...existing,
                score: existing.scoreBreakdown.keywordScore * keywordWeight + row.similarity * semanticWeight,
                scoreBreakdown: {
                  ...existing.scoreBreakdown,
                  semanticScore: row.similarity,
                },
              };
            } else {
              const video = {
                ...videoData.video,
                author: videoData.author,
              } as VideoWithAuthor;

              results.push({
                type: 'video',
                video,
                score: row.similarity * semanticWeight,
                scoreBreakdown: {
                  keywordScore: 0,
                  semanticScore: row.similarity,
                  recencyBoost: calculateRecencyBoost(videoData.video.createdAt),
                },
                highlights: includeHighlights ? { content: row.text_preview } : undefined,
                context: { sourceType: 'video' },
              });
            }
          }
        }
      }

      return results;
    },
    catch: (error) =>
      new DatabaseError({
        message: `Video search failed: ${error}`,
        operation: 'searchVideos',
        cause: error,
      }),
  });

const searchContentItemsInternal = (
  params: ContentSearchParams,
): Effect.Effect<UnifiedSearchResultItem[], DatabaseError> =>
  Effect.tryPromise({
    try: async () => {
      const {
        db,
        query,
        organizationId,
        queryEmbedding,
        sources,
        sourceIds,
        contentTypes,
        mode,
        keywordWeight,
        semanticWeight,
        semanticThreshold,
        dateRange,
        includeHighlights,
        limit,
      } = params;

      const results: UnifiedSearchResultItem[] = [];

      // Build base conditions
      const baseConditions: string[] = [`ci.organization_id = '${organizationId}'`];
      if (sources && sources.length > 0) {
        baseConditions.push(`cs.type = ANY(ARRAY['${sources.join("','")}'])`);
      }
      if (sourceIds && sourceIds.length > 0) {
        baseConditions.push(`ci.source_id = ANY(ARRAY['${sourceIds.join("','")}'])`);
      }
      if (contentTypes && contentTypes.length > 0) {
        baseConditions.push(`ci.type = ANY(ARRAY['${contentTypes.join("','")}'])`);
      }
      if (dateRange?.from) {
        baseConditions.push(`ci.created_at_source >= '${dateRange.from.toISOString()}'`);
      }
      if (dateRange?.to) {
        baseConditions.push(`ci.created_at_source <= '${dateRange.to.toISOString()}'`);
      }

      // Keyword search
      if (mode === 'keyword' || mode === 'hybrid') {
        const escapedQuery = query.replace(/'/g, "''");
        const keywordResults = await db.execute<{
          id: string;
          title: string | null;
          content: string | null;
          type: string;
          source_id: string;
          source_type: string;
          source_name: string;
          author_name: string | null;
          created_at_source: Date | null;
          created_at: Date;
        }>(
          sql.raw(`
          SELECT
            ci.id,
            ci.title,
            LEFT(ci.content, 500) as content,
            ci.type,
            ci.source_id,
            cs.type as source_type,
            cs.name as source_name,
            ci.author_name,
            ci.created_at_source,
            ci.created_at
          FROM content_items ci
          LEFT JOIN content_sources cs ON cs.id = ci.source_id
          WHERE ${baseConditions.join(' AND ')}
            AND (
              ci.title ILIKE '%${escapedQuery}%'
              OR ci.content ILIKE '%${escapedQuery}%'
              OR ci.search_text ILIKE '%${escapedQuery}%'
            )
          ORDER BY ci.created_at_source DESC NULLS LAST
          LIMIT ${limit}
        `),
        );

        for (const row of keywordResults) {
          results.push({
            type: 'content_item',
            contentItem: {
              id: row.id,
              title: row.title,
              content: row.content,
              type: row.type as ContentItemType,
              sourceId: row.source_id,
              source: {
                id: row.source_id,
                type: row.source_type as ContentSourceType,
                name: row.source_name,
              },
              authorName: row.author_name,
              createdAtSource: row.created_at_source,
              createdAt: row.created_at,
            } as ContentItemWithSource,
            score: keywordWeight,
            scoreBreakdown: {
              keywordScore: 1,
              semanticScore: 0,
              recencyBoost: calculateRecencyBoost(row.created_at_source || row.created_at),
            },
            highlights: includeHighlights ? generateContentHighlights(query, row.title, row.content) : undefined,
            context: { sourceType: row.source_type as ContentSourceType },
          });
        }
      }

      // Semantic search
      if ((mode === 'semantic' || mode === 'hybrid') && queryEmbedding) {
        const embeddingStr = `[${queryEmbedding.join(',')}]`;

        const semanticResults = await db.execute<{
          id: string;
          title: string | null;
          content: string | null;
          type: string;
          source_id: string;
          source_type: string;
          source_name: string;
          author_name: string | null;
          created_at_source: Date | null;
          created_at: Date;
          similarity: number;
        }>(sql`
          SELECT
            ci.id,
            ci.title,
            LEFT(ci.content, 500) as content,
            ci.type,
            ci.source_id,
            cs.type as source_type,
            cs.name as source_name,
            ci.author_name,
            ci.created_at_source,
            ci.created_at,
            1 - (ci.embedding_vector <=> ${embeddingStr}::vector) as similarity
          FROM content_items ci
          LEFT JOIN content_sources cs ON cs.id = ci.source_id
          WHERE ci.organization_id = ${organizationId}
            AND ci.embedding_vector IS NOT NULL
            ${sources && sources.length > 0 ? sql`AND cs.type = ANY(${sources})` : sql``}
            ${sourceIds && sourceIds.length > 0 ? sql`AND ci.source_id = ANY(${sourceIds})` : sql``}
            ${contentTypes && contentTypes.length > 0 ? sql`AND ci.type = ANY(${contentTypes})` : sql``}
            ${dateRange?.from ? sql`AND ci.created_at_source >= ${dateRange.from}` : sql``}
            ${dateRange?.to ? sql`AND ci.created_at_source <= ${dateRange.to}` : sql``}
            AND 1 - (ci.embedding_vector <=> ${embeddingStr}::vector) >= ${semanticThreshold}
          ORDER BY similarity DESC
          LIMIT ${limit}
        `);

        for (const row of semanticResults) {
          // Check if already in results
          const existingIdx = results.findIndex((r) => r.contentItem?.id === row.id);
          if (existingIdx >= 0) {
            // Merge scores
            const existing = results[existingIdx];
            results[existingIdx] = {
              ...existing,
              score: existing.scoreBreakdown.keywordScore * keywordWeight + row.similarity * semanticWeight,
              scoreBreakdown: {
                ...existing.scoreBreakdown,
                semanticScore: row.similarity,
              },
            };
          } else {
            results.push({
              type: 'content_item',
              contentItem: {
                id: row.id,
                title: row.title,
                content: row.content,
                type: row.type as ContentItemType,
                sourceId: row.source_id,
                source: {
                  id: row.source_id,
                  type: row.source_type as ContentSourceType,
                  name: row.source_name,
                },
                authorName: row.author_name,
                createdAtSource: row.created_at_source,
                createdAt: row.created_at,
              } as ContentItemWithSource,
              score: row.similarity * semanticWeight,
              scoreBreakdown: {
                keywordScore: 0,
                semanticScore: row.similarity,
                recencyBoost: calculateRecencyBoost(row.created_at_source || row.created_at),
              },
              highlights: includeHighlights ? { content: row.content?.slice(0, 200) } : undefined,
              context: { sourceType: row.source_type as ContentSourceType },
            });
          }
        }
      }

      return results;
    },
    catch: (error) =>
      new DatabaseError({
        message: `Content item search failed: ${error}`,
        operation: 'searchContentItems',
        cause: error,
      }),
  });

const getFacetsInternal = (
  db: DrizzleDB,
  organizationId: string,
  _query?: string,
): Effect.Effect<SearchFacets, DatabaseError> =>
  Effect.tryPromise({
    try: async () => {
      // Get source type counts
      const sourceCounts = await db
        .select({
          source: contentSources.type,
          count: count(),
        })
        .from(contentItems)
        .innerJoin(contentSources, eq(contentItems.sourceId, contentSources.id))
        .where(eq(contentItems.organizationId, organizationId))
        .groupBy(contentSources.type);

      // Get content type counts
      const typeCounts = await db
        .select({
          type: contentItems.type,
          count: count(),
        })
        .from(contentItems)
        .where(eq(contentItems.organizationId, organizationId))
        .groupBy(contentItems.type);

      // Get topic counts
      const topicCounts = await db
        .select({
          clusterId: topicClusters.id,
          name: topicClusters.name,
          count: count(),
        })
        .from(topicClusterMembers)
        .innerJoin(topicClusters, eq(topicClusterMembers.clusterId, topicClusters.id))
        .innerJoin(contentItems, eq(topicClusterMembers.contentItemId, contentItems.id))
        .where(eq(contentItems.organizationId, organizationId))
        .groupBy(topicClusters.id, topicClusters.name)
        .orderBy(desc(count()))
        .limit(20);

      // Get participant counts - aggregate by author name/id
      const participantCounts = await db.execute<{
        author_name: string | null;
        author_id: string | null;
        count: string;
      }>(sql`
        SELECT
          ci.author_name,
          ci.author_id,
          COUNT(*) as count
        FROM content_items ci
        WHERE ci.organization_id = ${organizationId}
          AND (ci.author_name IS NOT NULL OR ci.author_id IS NOT NULL)
        GROUP BY ci.author_name, ci.author_id
        ORDER BY count DESC
        LIMIT 20
      `);

      // Get date histogram - group by week for the last 12 weeks
      const dateHistogramData = await db.execute<{
        week_start: string;
        count: string;
      }>(sql`
        SELECT
          DATE_TRUNC('week', COALESCE(ci.created_at_source, ci.created_at)) as week_start,
          COUNT(*) as count
        FROM content_items ci
        WHERE ci.organization_id = ${organizationId}
          AND COALESCE(ci.created_at_source, ci.created_at) >= NOW() - INTERVAL '12 weeks'
        GROUP BY week_start
        ORDER BY week_start DESC
      `);

      return {
        sources: sourceCounts.map((s) => ({ source: s.source, count: Number(s.count) })),
        contentTypes: typeCounts.map((t) => ({ type: t.type, count: Number(t.count) })),
        participants: participantCounts
          .filter((p) => p.author_name || p.author_id)
          .map((p) => ({
            name: p.author_name || 'Unknown',
            userId: p.author_id || undefined,
            count: Number(p.count),
          })),
        topics: topicCounts.map((t) => ({
          name: t.name,
          clusterId: t.clusterId,
          count: Number(t.count),
        })),
        dateHistogram: dateHistogramData.map((d) => ({
          date: new Date(d.week_start).toISOString().split('T')[0],
          count: Number(d.count),
        })),
      };
    },
    catch: (error) =>
      new DatabaseError({
        message: `Failed to get facets: ${error}`,
        operation: 'getFacets',
        cause: error,
      }),
  });

// =============================================================================
// Utility Functions
// =============================================================================

function calculateRecencyBoost(date: Date): number {
  const ageMs = Date.now() - date.getTime();
  const ageDays = ageMs / (24 * 60 * 60 * 1000);

  // Linear decay over 365 days
  return Math.max(0, 1 - ageDays / 365) * 0.1;
}

function generateHighlights(
  query: string,
  video: { title: string; description: string | null; transcript: string | null },
): { title?: string; content?: string } {
  const highlights: { title?: string; content?: string } = {};
  const queryLower = query.toLowerCase();

  // Highlight in title
  if (video.title.toLowerCase().includes(queryLower)) {
    highlights.title = highlightText(video.title, query);
  }

  // Highlight in transcript
  if (video.transcript?.toLowerCase().includes(queryLower)) {
    const idx = video.transcript.toLowerCase().indexOf(queryLower);
    const start = Math.max(0, idx - 100);
    const end = Math.min(video.transcript.length, idx + query.length + 100);
    const excerpt = video.transcript.slice(start, end);
    highlights.content = highlightText(excerpt, query);
  } else if (video.description?.toLowerCase().includes(queryLower)) {
    highlights.content = highlightText(video.description, query);
  }

  return highlights;
}

function generateContentHighlights(
  query: string,
  title: string | null,
  content: string | null,
): { title?: string; content?: string } {
  const highlights: { title?: string; content?: string } = {};
  const queryLower = query.toLowerCase();

  if (title?.toLowerCase().includes(queryLower)) {
    highlights.title = highlightText(title, query);
  }

  if (content?.toLowerCase().includes(queryLower)) {
    const idx = content.toLowerCase().indexOf(queryLower);
    const start = Math.max(0, idx - 100);
    const end = Math.min(content.length, idx + query.length + 100);
    const excerpt = content.slice(start, end);
    highlights.content = highlightText(excerpt, query);
  } else if (content) {
    highlights.content = content.slice(0, 200);
  }

  return highlights;
}

function highlightText(text: string, query: string): string {
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// =============================================================================
// Layer
// =============================================================================

export const UnifiedSearchLive = Layer.effect(
  UnifiedSearch,
  Effect.gen(function* () {
    const { db } = yield* Database;
    const embeddingService = yield* Embedding;
    return makeUnifiedSearchService(db, embeddingService);
  }),
);

// =============================================================================
// Convenience Functions
// =============================================================================

export const unifiedSearch = (params: UnifiedSearchParams) =>
  Effect.gen(function* () {
    const service = yield* UnifiedSearch;
    return yield* service.search(params);
  });

export const searchContentItems = (params: UnifiedSearchParams) =>
  Effect.gen(function* () {
    const service = yield* UnifiedSearch;
    return yield* service.searchContentItems(params);
  });

export const getSearchFacets = (organizationId: string, query?: string) =>
  Effect.gen(function* () {
    const service = yield* UnifiedSearch;
    return yield* service.getFacets(organizationId, query);
  });
