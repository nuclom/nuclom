import { Effect } from "effect";
import type { NextRequest } from "next/server";
import { connection } from "next/server";
import { createFullLayer, handleEffectExit } from "@/lib/api-handler";
import type { SearchFilters } from "@/lib/db/schema";
import { MissingFieldError, SearchRepository } from "@/lib/effect";
import { Auth } from "@/lib/effect/services/auth";
import { Embedding } from "@/lib/effect/services/embedding";
import { SemanticSearchRepository } from "@/lib/effect/services/semantic-search-repository";
import type { VideoWithAuthor } from "@/lib/types";

// =============================================================================
// Types
// =============================================================================

interface HybridSearchResult {
  video: VideoWithAuthor;
  keywordScore: number;
  semanticScore: number;
  combinedScore: number;
  highlights?: {
    title?: string;
    description?: string;
    transcript?: string;
  };
  semanticMatch?: {
    contentType: "transcript_chunk" | "decision";
    textPreview: string;
    timestampStart?: number;
    timestampEnd?: number;
  };
}

// =============================================================================
// POST /api/search/hybrid - Hybrid search combining keyword and semantic
// =============================================================================

export async function POST(request: NextRequest) {
  await connection();

  // Parse request body outside of Effect
  const body = (await request.json()) as {
    query?: string;
    organizationId?: string;
    filters?: SearchFilters;
    page?: number;
    limit?: number;
    semanticWeight?: number; // 0-1, how much to weight semantic vs keyword
    semanticThreshold?: number;
  };

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const {
      query,
      organizationId,
      filters,
      page = 1,
      limit = 20,
      semanticWeight = 0.5, // Default 50/50 blend
      semanticThreshold = 0.6,
    } = body;

    if (!query || !query.trim()) {
      return yield* Effect.fail(
        new MissingFieldError({
          field: "query",
          message: "Search query is required",
        }),
      );
    }

    if (!organizationId) {
      return yield* Effect.fail(
        new MissingFieldError({
          field: "organizationId",
          message: "Organization ID is required",
        }),
      );
    }

    const keywordWeight = 1 - semanticWeight;

    // Run keyword search and semantic search in parallel
    const searchRepo = yield* SearchRepository;
    const embeddingService = yield* Embedding;
    const semanticSearchRepo = yield* SemanticSearchRepository;

    // Generate query embedding
    const queryEmbedding = yield* embeddingService.generateEmbedding(query.trim());

    // Run both searches in parallel
    const [keywordResults, semanticResults] = yield* Effect.all([
      searchRepo.search({
        query: query.trim(),
        organizationId,
        filters,
        page: 1,
        limit: limit * 2, // Get more results to merge
      }),
      semanticSearchRepo.semanticSearchWithVideos({
        queryEmbedding,
        organizationId,
        limit: limit * 2,
        threshold: semanticThreshold,
      }),
    ]);

    // Create a map to merge results by video ID
    const videoMap = new Map<string, HybridSearchResult>();

    // Process keyword results
    for (const result of keywordResults.results) {
      const normalizedKeywordScore = result.rank / (keywordResults.results[0]?.rank || 1);
      videoMap.set(result.video.id, {
        video: result.video,
        keywordScore: normalizedKeywordScore,
        semanticScore: 0,
        combinedScore: normalizedKeywordScore * keywordWeight,
        highlights: result.highlights,
      });
    }

    // Process semantic results
    for (const result of semanticResults) {
      const existing = videoMap.get(result.videoId);

      if (existing) {
        // Merge with existing keyword result
        existing.semanticScore = result.similarity;
        existing.combinedScore = existing.keywordScore * keywordWeight + result.similarity * semanticWeight;
        existing.semanticMatch = {
          contentType: result.contentType,
          textPreview: result.textPreview,
          timestampStart: result.timestampStart,
          timestampEnd: result.timestampEnd,
        };
      } else if (result.video) {
        // New video from semantic search only
        videoMap.set(result.videoId, {
          video: result.video,
          keywordScore: 0,
          semanticScore: result.similarity,
          combinedScore: result.similarity * semanticWeight,
          semanticMatch: {
            contentType: result.contentType,
            textPreview: result.textPreview,
            timestampStart: result.timestampStart,
            timestampEnd: result.timestampEnd,
          },
        });
      }
    }

    // Sort by combined score and paginate
    const allResults = Array.from(videoMap.values()).sort((a, b) => b.combinedScore - a.combinedScore);

    const offset = (page - 1) * limit;
    const paginatedResults = allResults.slice(offset, offset + limit);

    // Save search to history
    yield* searchRepo
      .saveSearchHistory({
        userId: user.id,
        organizationId,
        query: query.trim(),
        filters,
        resultsCount: allResults.length,
      })
      .pipe(Effect.catchAll(() => Effect.succeed(null)));

    return {
      results: paginatedResults,
      query: query.trim(),
      total: allResults.length,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(allResults.length / limit),
      },
      searchMode: "hybrid",
      weights: {
        keyword: keywordWeight,
        semantic: semanticWeight,
      },
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}

// =============================================================================
// GET /api/search/hybrid - Hybrid search via query params
// =============================================================================

export async function GET(request: NextRequest) {
  await connection();

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Parse query params
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const organizationId = searchParams.get("organizationId");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
    const semanticWeight = parseFloat(searchParams.get("semanticWeight") || "0.5");
    const semanticThreshold = parseFloat(searchParams.get("threshold") || "0.6");

    // Parse filters
    const authorId = searchParams.get("authorId");
    const channelId = searchParams.get("channelId");
    const collectionId = searchParams.get("collectionId");
    const processingStatus = searchParams.get("processingStatus");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const filters: SearchFilters = {
      ...(authorId && { authorId }),
      ...(channelId && { channelId }),
      ...(collectionId && { collectionId }),
      ...(processingStatus && { processingStatus }),
      ...(dateFrom && { dateFrom }),
      ...(dateTo && { dateTo }),
    };

    if (!query.trim()) {
      return yield* Effect.fail(
        new MissingFieldError({
          field: "q",
          message: "Search query is required",
        }),
      );
    }

    if (!organizationId) {
      return yield* Effect.fail(
        new MissingFieldError({
          field: "organizationId",
          message: "Organization ID is required",
        }),
      );
    }

    const keywordWeight = 1 - semanticWeight;

    // Run both searches
    const searchRepo = yield* SearchRepository;
    const embeddingService = yield* Embedding;
    const semanticSearchRepo = yield* SemanticSearchRepository;

    const queryEmbedding = yield* embeddingService.generateEmbedding(query.trim());

    const [keywordResults, semanticResults] = yield* Effect.all([
      searchRepo.search({
        query: query.trim(),
        organizationId,
        filters: Object.keys(filters).length > 0 ? filters : undefined,
        page: 1,
        limit: limit * 2,
      }),
      semanticSearchRepo.semanticSearchWithVideos({
        queryEmbedding,
        organizationId,
        limit: limit * 2,
        threshold: semanticThreshold,
      }),
    ]);

    // Merge results
    const videoMap = new Map<string, HybridSearchResult>();

    for (const result of keywordResults.results) {
      const normalizedKeywordScore = result.rank / (keywordResults.results[0]?.rank || 1);
      videoMap.set(result.video.id, {
        video: result.video,
        keywordScore: normalizedKeywordScore,
        semanticScore: 0,
        combinedScore: normalizedKeywordScore * keywordWeight,
        highlights: result.highlights,
      });
    }

    for (const result of semanticResults) {
      const existing = videoMap.get(result.videoId);

      if (existing) {
        existing.semanticScore = result.similarity;
        existing.combinedScore = existing.keywordScore * keywordWeight + result.similarity * semanticWeight;
        existing.semanticMatch = {
          contentType: result.contentType,
          textPreview: result.textPreview,
          timestampStart: result.timestampStart,
          timestampEnd: result.timestampEnd,
        };
      } else if (result.video) {
        videoMap.set(result.videoId, {
          video: result.video,
          keywordScore: 0,
          semanticScore: result.similarity,
          combinedScore: result.similarity * semanticWeight,
          semanticMatch: {
            contentType: result.contentType,
            textPreview: result.textPreview,
            timestampStart: result.timestampStart,
            timestampEnd: result.timestampEnd,
          },
        });
      }
    }

    const allResults = Array.from(videoMap.values()).sort((a, b) => b.combinedScore - a.combinedScore);
    const offset = (page - 1) * limit;
    const paginatedResults = allResults.slice(offset, offset + limit);

    // Save search to history
    yield* searchRepo
      .saveSearchHistory({
        userId: user.id,
        organizationId,
        query: query.trim(),
        filters: Object.keys(filters).length > 0 ? filters : undefined,
        resultsCount: allResults.length,
      })
      .pipe(Effect.catchAll(() => Effect.succeed(null)));

    return {
      results: paginatedResults,
      query: query.trim(),
      total: allResults.length,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(allResults.length / limit),
      },
      searchMode: "hybrid",
      weights: {
        keyword: keywordWeight,
        semantic: semanticWeight,
      },
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}
