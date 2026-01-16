/**
 * Semantic Search Repository Service using Effect-TS
 *
 * Provides type-safe database operations for semantic search using vector embeddings.
 * Supports storing transcript chunks with embeddings and performing similarity searches.
 */

import { eq, inArray, sql } from 'drizzle-orm';
import { Context, Effect, Layer } from 'effect';
import { type NewTranscriptChunk, type TranscriptChunk, transcriptChunks, users, videos } from '@/lib/db/schema';
import type { VideoWithAuthor } from '@/lib/types';
import { DatabaseError } from '../errors';
import { Database } from './database';
import type { ChunkEmbedding } from './embedding';

// =============================================================================
// Types
// =============================================================================

/**
 * Result of a semantic search operation
 */
export interface SemanticSearchResult {
  readonly contentType: 'transcript_chunk' | 'decision';
  readonly contentId: string;
  readonly videoId: string;
  readonly similarity: number;
  readonly textPreview: string;
  readonly timestampStart?: number;
  readonly timestampEnd?: number;
}

/**
 * Result of a semantic search with full video info
 */
export interface SemanticSearchResultWithVideo extends SemanticSearchResult {
  readonly video?: VideoWithAuthor;
}

/**
 * Similar video result
 */
export interface SimilarVideoResult {
  readonly videoId: string;
  readonly similarity: number;
  readonly matchingChunks: number;
  readonly video?: VideoWithAuthor;
}

/**
 * Parameters for semantic search
 */
export interface SemanticSearchParams {
  readonly queryEmbedding: readonly number[];
  readonly organizationId: string;
  readonly limit?: number;
  readonly threshold?: number;
  readonly contentTypes?: readonly ('transcript_chunk' | 'decision')[];
  readonly videoIds?: readonly string[];
}

/**
 * Parameters for finding similar videos
 */
export interface SimilarVideosParams {
  readonly videoId: string;
  readonly organizationId: string;
  readonly limit?: number;
  readonly threshold?: number;
}

export interface SemanticSearchRepositoryService {
  /**
   * Store transcript chunks with embeddings for a video
   */
  readonly saveTranscriptChunks: (
    videoId: string,
    organizationId: string,
    chunks: readonly ChunkEmbedding[],
  ) => Effect.Effect<readonly TranscriptChunk[], DatabaseError>;

  /**
   * Delete all transcript chunks for a video
   */
  readonly deleteTranscriptChunks: (videoId: string) => Effect.Effect<void, DatabaseError>;

  /**
   * Check if a video has embeddings
   */
  readonly hasEmbeddings: (videoId: string) => Effect.Effect<boolean, DatabaseError>;

  /**
   * Perform semantic search across transcript chunks and decisions
   */
  readonly semanticSearch: (
    params: SemanticSearchParams,
  ) => Effect.Effect<readonly SemanticSearchResult[], DatabaseError>;

  /**
   * Perform semantic search with full video information
   */
  readonly semanticSearchWithVideos: (
    params: SemanticSearchParams,
  ) => Effect.Effect<readonly SemanticSearchResultWithVideo[], DatabaseError>;

  /**
   * Find videos similar to a given video
   */
  readonly findSimilarVideos: (
    params: SimilarVideosParams,
  ) => Effect.Effect<readonly SimilarVideoResult[], DatabaseError>;

  /**
   * Get transcript chunks for a specific video
   */
  readonly getTranscriptChunks: (videoId: string) => Effect.Effect<readonly TranscriptChunk[], DatabaseError>;

  /**
   * Get videos that need embeddings (have transcript but no chunks)
   */
  readonly getVideosNeedingEmbeddings: (
    organizationId: string,
    limit?: number,
  ) => Effect.Effect<readonly { id: string; transcript: string }[], DatabaseError>;
}

// =============================================================================
// Semantic Search Repository Tag
// =============================================================================

export class SemanticSearchRepository extends Context.Tag('SemanticSearchRepository')<
  SemanticSearchRepository,
  SemanticSearchRepositoryService
>() {}

// =============================================================================
// Semantic Search Repository Implementation
// =============================================================================

const makeSemanticSearchRepositoryService = Effect.gen(function* () {
  const { db } = yield* Database;

  const saveTranscriptChunks = (
    videoId: string,
    organizationId: string,
    chunks: readonly ChunkEmbedding[],
  ): Effect.Effect<readonly TranscriptChunk[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        if (chunks.length === 0) {
          return [];
        }

        // First delete existing chunks for this video
        await db.delete(transcriptChunks).where(eq(transcriptChunks.videoId, videoId));

        // Insert new chunks
        const values: NewTranscriptChunk[] = chunks.map((c) => ({
          videoId,
          organizationId,
          chunkIndex: c.chunk.chunkIndex,
          text: c.chunk.text,
          tokenCount: c.chunk.tokenCount,
          timestampStart: c.chunk.timestampStart,
          timestampEnd: c.chunk.timestampEnd,
          speakers: c.chunk.speakers ? [...c.chunk.speakers] : undefined,
          embedding: [...c.embedding],
        }));

        const result = await db.insert(transcriptChunks).values(values).returning();
        return result;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to save transcript chunks',
          operation: 'saveTranscriptChunks',
          cause: error,
        }),
    });

  const deleteTranscriptChunks = (videoId: string): Effect.Effect<void, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        await db.delete(transcriptChunks).where(eq(transcriptChunks.videoId, videoId));
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to delete transcript chunks',
          operation: 'deleteTranscriptChunks',
          cause: error,
        }),
    });

  const hasEmbeddings = (videoId: string): Effect.Effect<boolean, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const result = await db
          .select({ count: sql<number>`count(*)` })
          .from(transcriptChunks)
          .where(eq(transcriptChunks.videoId, videoId));
        return Number(result[0]?.count ?? 0) > 0;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to check embeddings',
          operation: 'hasEmbeddings',
          cause: error,
        }),
    });

  const semanticSearch = (
    params: SemanticSearchParams,
  ): Effect.Effect<readonly SemanticSearchResult[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const { queryEmbedding, organizationId, limit = 20, threshold = 0.7, contentTypes, videoIds } = params;

        // Convert embedding array to PostgreSQL vector format
        const embeddingStr = `[${queryEmbedding.join(',')}]`;

        // Build content type filter
        const includeChunks = !contentTypes || contentTypes.includes('transcript_chunk');
        const includeDecisions = !contentTypes || contentTypes.includes('decision');

        const results: SemanticSearchResult[] = [];

        // Search transcript chunks
        if (includeChunks) {
          const chunkResults = await db.execute<{
            id: string;
            video_id: string;
            text: string;
            timestamp_start: number | null;
            timestamp_end: number | null;
            similarity: number;
          }>(sql`
            SELECT
              tc.id,
              tc.video_id,
              LEFT(tc.text, 500) as text,
              tc.timestamp_start,
              tc.timestamp_end,
              1 - (tc.embedding::vector <=> ${embeddingStr}::vector) as similarity
            FROM transcript_chunks tc
            WHERE tc.organization_id = ${organizationId}
              AND tc.embedding IS NOT NULL
              ${videoIds && videoIds.length > 0 ? sql`AND tc.video_id = ANY(${videoIds})` : sql``}
              AND 1 - (tc.embedding::vector <=> ${embeddingStr}::vector) >= ${threshold}
            ORDER BY similarity DESC
            LIMIT ${limit}
          `);

          for (const row of chunkResults) {
            results.push({
              contentType: 'transcript_chunk',
              contentId: row.id,
              videoId: row.video_id,
              similarity: row.similarity,
              textPreview: row.text,
              timestampStart: row.timestamp_start ?? undefined,
              timestampEnd: row.timestamp_end ?? undefined,
            });
          }
        }

        // Search decisions
        if (includeDecisions) {
          const decisionResults = await db.execute<{
            id: string;
            video_id: string;
            summary: string;
            timestamp_start: number | null;
            timestamp_end: number | null;
            similarity: number;
          }>(sql`
            SELECT
              d.id,
              d.video_id,
              LEFT(d.summary, 500) as summary,
              d.timestamp_start,
              d.timestamp_end,
              1 - (d.embedding_vector <=> ${embeddingStr}::vector) as similarity
            FROM decisions d
            WHERE d.organization_id = ${organizationId}
              AND d.embedding_vector IS NOT NULL
              ${videoIds && videoIds.length > 0 ? sql`AND d.video_id = ANY(${videoIds})` : sql``}
              AND 1 - (d.embedding_vector <=> ${embeddingStr}::vector) >= ${threshold}
            ORDER BY similarity DESC
            LIMIT ${limit}
          `);

          for (const row of decisionResults) {
            results.push({
              contentType: 'decision',
              contentId: row.id,
              videoId: row.video_id,
              similarity: row.similarity,
              textPreview: row.summary,
              timestampStart: row.timestamp_start ?? undefined,
              timestampEnd: row.timestamp_end ?? undefined,
            });
          }
        }

        // Sort by similarity and limit
        return results.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to perform semantic search',
          operation: 'semanticSearch',
          cause: error,
        }),
    });

  const semanticSearchWithVideos = (
    params: SemanticSearchParams,
  ): Effect.Effect<readonly SemanticSearchResultWithVideo[], DatabaseError> =>
    Effect.gen(function* () {
      const searchResults = yield* semanticSearch(params);

      if (searchResults.length === 0) {
        return [];
      }

      // Get unique video IDs
      const videoIds = [...new Set(searchResults.map((r) => r.videoId))];

      // Fetch video information
      const videosData = yield* Effect.tryPromise({
        try: async () => {
          return await db
            .select({
              id: videos.id,
              title: videos.title,
              description: videos.description,
              duration: videos.duration,
              thumbnailUrl: videos.thumbnailUrl,
              videoUrl: videos.videoUrl,
              authorId: videos.authorId,
              organizationId: videos.organizationId,
              transcript: videos.transcript,
              transcriptSegments: videos.transcriptSegments,
              processingStatus: videos.processingStatus,
              processingError: videos.processingError,
              aiSummary: videos.aiSummary,
              aiTags: videos.aiTags,
              aiActionItems: videos.aiActionItems,
              searchVector: videos.searchVector,
              createdAt: videos.createdAt,
              updatedAt: videos.updatedAt,
              author: {
                id: users.id,
                email: users.email,
                name: users.name,
                image: users.image,
                createdAt: users.createdAt,
                updatedAt: users.updatedAt,
                emailVerified: users.emailVerified,
                role: users.role,
                banned: users.banned,
                banReason: users.banReason,
                banExpires: users.banExpires,
              },
            })
            .from(videos)
            .innerJoin(users, eq(videos.authorId, users.id))
            .where(inArray(videos.id, videoIds));
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to fetch videos for semantic search',
            operation: 'semanticSearchWithVideos',
            cause: error,
          }),
      });

      // Create video lookup map - cast to unknown first to handle partial user fields
      const videoMap = new Map(videosData.map((v) => [v.id, v as unknown as VideoWithAuthor]));

      // Combine results with video info
      return searchResults.map((result) => ({
        ...result,
        video: videoMap.get(result.videoId),
      }));
    });

  const findSimilarVideos = (
    params: SimilarVideosParams,
  ): Effect.Effect<readonly SimilarVideoResult[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const { videoId, organizationId, limit = 5, threshold = 0.7 } = params;

        // Use the find_similar_videos function from the migration
        // or implement inline for more control
        const results = await db.execute<{
          video_id: string;
          avg_similarity: number;
          matching_chunks: number;
        }>(sql`
          WITH source_embeddings AS (
            SELECT id, embedding
            FROM transcript_chunks
            WHERE video_id = ${videoId}
              AND embedding IS NOT NULL
          ),
          chunk_similarities AS (
            SELECT
              tc.video_id,
              tc.id as chunk_id,
              MAX(1 - (tc.embedding::vector <=> se.embedding::vector)) as max_similarity
            FROM transcript_chunks tc
            CROSS JOIN source_embeddings se
            WHERE tc.organization_id = ${organizationId}
              AND tc.video_id != ${videoId}
              AND tc.embedding IS NOT NULL
            GROUP BY tc.video_id, tc.id
          )
          SELECT
            cs.video_id,
            AVG(cs.max_similarity) as avg_similarity,
            COUNT(*)::integer as matching_chunks
          FROM chunk_similarities cs
          GROUP BY cs.video_id
          HAVING AVG(cs.max_similarity) >= ${threshold}
          ORDER BY avg_similarity DESC
          LIMIT ${limit}
        `);

        // Fetch video details
        const videoIds = results.map((r) => r.video_id);
        if (videoIds.length === 0) {
          return [];
        }

        const videosData = await db
          .select({
            id: videos.id,
            title: videos.title,
            description: videos.description,
            duration: videos.duration,
            thumbnailUrl: videos.thumbnailUrl,
            videoUrl: videos.videoUrl,
            authorId: videos.authorId,
            organizationId: videos.organizationId,
            transcript: videos.transcript,
            transcriptSegments: videos.transcriptSegments,
            processingStatus: videos.processingStatus,
            processingError: videos.processingError,
            aiSummary: videos.aiSummary,
            aiTags: videos.aiTags,
            aiActionItems: videos.aiActionItems,
            searchVector: videos.searchVector,
            createdAt: videos.createdAt,
            updatedAt: videos.updatedAt,
            author: {
              id: users.id,
              email: users.email,
              name: users.name,
              image: users.image,
              createdAt: users.createdAt,
              updatedAt: users.updatedAt,
              emailVerified: users.emailVerified,
              role: users.role,
              banned: users.banned,
              banReason: users.banReason,
              banExpires: users.banExpires,
            },
          })
          .from(videos)
          .innerJoin(users, eq(videos.authorId, users.id))
          .where(inArray(videos.id, videoIds));

        const videoMap = new Map(videosData.map((v) => [v.id, v as unknown as VideoWithAuthor]));

        return results.map((r) => ({
          videoId: r.video_id,
          similarity: r.avg_similarity,
          matchingChunks: r.matching_chunks,
          video: videoMap.get(r.video_id),
        }));
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to find similar videos',
          operation: 'findSimilarVideos',
          cause: error,
        }),
    });

  const getTranscriptChunks = (videoId: string): Effect.Effect<readonly TranscriptChunk[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        return await db
          .select()
          .from(transcriptChunks)
          .where(eq(transcriptChunks.videoId, videoId))
          .orderBy(transcriptChunks.chunkIndex);
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to get transcript chunks',
          operation: 'getTranscriptChunks',
          cause: error,
        }),
    });

  const getVideosNeedingEmbeddings = (
    organizationId: string,
    limit = 100,
  ): Effect.Effect<readonly { id: string; transcript: string }[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        // Find videos with transcripts but no chunks
        const results = await db.execute<{ id: string; transcript: string }>(sql`
          SELECT v.id, v.transcript
          FROM videos v
          WHERE v.organization_id = ${organizationId}
            AND v.transcript IS NOT NULL
            AND v.processing_status = 'completed'
            AND NOT EXISTS (
              SELECT 1 FROM transcript_chunks tc WHERE tc.video_id = v.id
            )
          ORDER BY v.created_at DESC
          LIMIT ${limit}
        `);
        return results;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to get videos needing embeddings',
          operation: 'getVideosNeedingEmbeddings',
          cause: error,
        }),
    });

  return {
    saveTranscriptChunks,
    deleteTranscriptChunks,
    hasEmbeddings,
    semanticSearch,
    semanticSearchWithVideos,
    findSimilarVideos,
    getTranscriptChunks,
    getVideosNeedingEmbeddings,
  } satisfies SemanticSearchRepositoryService;
});

// =============================================================================
// Semantic Search Repository Layer
// =============================================================================

export const SemanticSearchRepositoryLive = Layer.effect(SemanticSearchRepository, makeSemanticSearchRepositoryService);

// =============================================================================
// Helper Functions
// =============================================================================

export const saveTranscriptChunks = (
  videoId: string,
  organizationId: string,
  chunks: readonly ChunkEmbedding[],
): Effect.Effect<readonly TranscriptChunk[], DatabaseError, SemanticSearchRepository> =>
  Effect.gen(function* () {
    const repo = yield* SemanticSearchRepository;
    return yield* repo.saveTranscriptChunks(videoId, organizationId, chunks);
  });

export const semanticSearch = (
  params: SemanticSearchParams,
): Effect.Effect<readonly SemanticSearchResult[], DatabaseError, SemanticSearchRepository> =>
  Effect.gen(function* () {
    const repo = yield* SemanticSearchRepository;
    return yield* repo.semanticSearch(params);
  });

export const semanticSearchWithVideos = (
  params: SemanticSearchParams,
): Effect.Effect<readonly SemanticSearchResultWithVideo[], DatabaseError, SemanticSearchRepository> =>
  Effect.gen(function* () {
    const repo = yield* SemanticSearchRepository;
    return yield* repo.semanticSearchWithVideos(params);
  });

export const findSimilarVideos = (
  params: SimilarVideosParams,
): Effect.Effect<readonly SimilarVideoResult[], DatabaseError, SemanticSearchRepository> =>
  Effect.gen(function* () {
    const repo = yield* SemanticSearchRepository;
    return yield* repo.findSimilarVideos(params);
  });
