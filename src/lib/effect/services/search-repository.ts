/**
 * Search Repository Service using Effect-TS
 *
 * Provides type-safe database operations for full-text search.
 */

import { and, asc, desc, eq, gte, ilike, isNotNull, lte, or, sql } from 'drizzle-orm';
import { Context, Effect, Layer } from 'effect';
import {
  type ProcessingStatus,
  type SearchFilters,
  savedSearches,
  searchHistory,
  users,
  videos,
} from '@/lib/db/schema';
import type {
  SavedSearchWithUser,
  SearchHistoryWithUser,
  SearchResponse,
  SearchResult,
  SearchSuggestion,
  VideoWithAuthor,
} from '@/lib/types';
import { DatabaseError, NotFoundError } from '../errors';
import { Database } from './database';

// =============================================================================
// Types
// =============================================================================

export interface SearchParams {
  readonly query: string;
  readonly organizationId: string;
  readonly filters?: SearchFilters;
  readonly page?: number;
  readonly limit?: number;
}

export interface CreateSearchHistoryInput {
  readonly userId: string;
  readonly organizationId: string;
  readonly query: string;
  readonly filters?: SearchFilters;
  readonly resultsCount: number;
}

export interface CreateSavedSearchInput {
  readonly userId: string;
  readonly organizationId: string;
  readonly name: string;
  readonly query: string;
  readonly filters?: SearchFilters;
}

export interface UpdateSavedSearchInput {
  readonly name?: string;
  readonly query?: string;
  readonly filters?: SearchFilters;
}

export interface SearchRepositoryService {
  /**
   * Perform full-text search on videos
   */
  readonly search: (params: SearchParams) => Effect.Effect<SearchResponse, DatabaseError>;

  /**
   * Get autocomplete suggestions
   */
  readonly getSuggestions: (
    query: string,
    organizationId: string,
    userId: string,
    limit?: number,
  ) => Effect.Effect<SearchSuggestion[], DatabaseError>;

  /**
   * Get recent searches for a user
   */
  readonly getRecentSearches: (
    userId: string,
    organizationId: string,
    limit?: number,
  ) => Effect.Effect<SearchHistoryWithUser[], DatabaseError>;

  /**
   * Save a search to history
   */
  readonly saveSearchHistory: (
    input: CreateSearchHistoryInput,
  ) => Effect.Effect<typeof searchHistory.$inferSelect, DatabaseError>;

  /**
   * Clear search history for a user
   */
  readonly clearSearchHistory: (userId: string, organizationId: string) => Effect.Effect<void, DatabaseError>;

  /**
   * Get saved searches for a user
   */
  readonly getSavedSearches: (
    userId: string,
    organizationId: string,
  ) => Effect.Effect<SavedSearchWithUser[], DatabaseError>;

  /**
   * Create a saved search
   */
  readonly createSavedSearch: (
    input: CreateSavedSearchInput,
  ) => Effect.Effect<typeof savedSearches.$inferSelect, DatabaseError>;

  /**
   * Update a saved search
   */
  readonly updateSavedSearch: (
    id: string,
    userId: string,
    input: UpdateSavedSearchInput,
  ) => Effect.Effect<typeof savedSearches.$inferSelect, DatabaseError | NotFoundError>;

  /**
   * Delete a saved search
   */
  readonly deleteSavedSearch: (id: string, userId: string) => Effect.Effect<void, DatabaseError | NotFoundError>;

  /**
   * Quick search for command bar (optimized for speed)
   */
  readonly quickSearch: (
    query: string,
    organizationId: string,
    limit?: number,
  ) => Effect.Effect<VideoWithAuthor[], DatabaseError>;
}

// =============================================================================
// Search Repository Tag
// =============================================================================

export class SearchRepository extends Context.Tag('SearchRepository')<SearchRepository, SearchRepositoryService>() {}

// =============================================================================
// Search Repository Implementation
// =============================================================================

const makeSearchRepositoryService = Effect.gen(function* () {
  const { db } = yield* Database;

  const search = (params: SearchParams): Effect.Effect<SearchResponse, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const { query, organizationId, filters, page = 1, limit = 20 } = params;
        const offset = (page - 1) * limit;

        // Build the WHERE conditions
        const conditions: ReturnType<typeof eq>[] = [eq(videos.organizationId, organizationId)];

        // Apply filters
        if (filters?.authorId) {
          conditions.push(eq(videos.authorId, filters.authorId));
        }
        // Note: collectionId filtering would require joining with collectionVideos table
        if (filters?.processingStatus) {
          conditions.push(eq(videos.processingStatus, filters.processingStatus as ProcessingStatus));
        }
        if (filters?.hasTranscript) {
          conditions.push(isNotNull(videos.transcript));
        }
        if (filters?.hasAiSummary) {
          conditions.push(isNotNull(videos.aiSummary));
        }
        if (filters?.dateFrom) {
          conditions.push(gte(videos.createdAt, new Date(filters.dateFrom)));
        }
        if (filters?.dateTo) {
          conditions.push(lte(videos.createdAt, new Date(filters.dateTo)));
        }

        // Determine sort order
        const sortBy = filters?.sortBy || 'relevance';
        const sortOrder = filters?.sortOrder || 'desc';

        let results: SearchResult[];
        let total: number;

        if (query.trim()) {
          // Full-text search with ranking
          // Use raw SQL for full-text search with ranking
          const searchResults = await db.execute<{
            id: string;
            title: string;
            description: string | null;
            duration: string;
            thumbnail_url: string | null;
            video_url: string | null;
            author_id: string;
            organization_id: string;
            channel_id: string | null;
            collection_id: string | null;
            transcript: string | null;
            transcript_segments: unknown;
            processing_status: string;
            processing_error: string | null;
            ai_summary: string | null;
            ai_tags: string[] | null;
            ai_action_items: unknown;
            search_vector: unknown;
            created_at: Date;
            updated_at: Date;
            rank: number;
            author_id_2: string;
            author_name: string;
            author_email: string;
            author_image: string | null;
            author_created_at: Date;
            author_updated_at: Date;
            author_email_verified: boolean;
            author_role: string;
            author_banned: boolean | null;
            author_ban_reason: string | null;
            author_ban_expires: Date | null;
            author_two_factor_enabled: boolean | null;
            author_stripe_customer_id: string | null;
            author_last_login_method: string | null;
            headline_title: string | null;
            headline_description: string | null;
            headline_transcript: string | null;
          }>(sql`
            SELECT
              v.*,
              ts_rank(v.search_vector, plainto_tsquery('english', ${query})) as rank,
              u.id as author_id_2,
              u.name as author_name,
              u.email as author_email,
              u.image as author_image,
              u.created_at as author_created_at,
              u.updated_at as author_updated_at,
              u.email_verified as author_email_verified,
              u.role as author_role,
              u.banned as author_banned,
              u.ban_reason as author_ban_reason,
              u.ban_expires as author_ban_expires,
              u.two_factor_enabled as author_two_factor_enabled,
              u.stripe_customer_id as author_stripe_customer_id,
              u.last_login_method as author_last_login_method,
              ts_headline('english', COALESCE(v.title, ''), plainto_tsquery('english', ${query}),
                'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=25') as headline_title,
              ts_headline('english', COALESCE(v.description, ''), plainto_tsquery('english', ${query}),
                'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=25') as headline_description,
              ts_headline('english', COALESCE(v.transcript, ''), plainto_tsquery('english', ${query}),
                'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=25') as headline_transcript
            FROM videos v
            INNER JOIN users u ON v.author_id = u.id
            WHERE
              v.organization_id = ${organizationId}
              AND (
                v.search_vector @@ plainto_tsquery('english', ${query})
                OR v.title ILIKE ${`%${query}%`}
                OR v.description ILIKE ${`%${query}%`}
              )
              ${filters?.authorId ? sql`AND v.author_id = ${filters.authorId}` : sql``}
              ${filters?.processingStatus ? sql`AND v.processing_status = ${filters.processingStatus}` : sql``}
              ${filters?.hasTranscript ? sql`AND v.transcript IS NOT NULL` : sql``}
              ${filters?.hasAiSummary ? sql`AND v.ai_summary IS NOT NULL` : sql``}
              ${filters?.dateFrom ? sql`AND v.created_at >= ${new Date(filters.dateFrom)}` : sql``}
              ${filters?.dateTo ? sql`AND v.created_at <= ${new Date(filters.dateTo)}` : sql``}
            ORDER BY ${
              sortBy === 'relevance'
                ? sql`rank DESC`
                : sortBy === 'date'
                  ? sortOrder === 'asc'
                    ? sql`v.created_at ASC`
                    : sql`v.created_at DESC`
                  : sortOrder === 'asc'
                    ? sql`v.title ASC`
                    : sql`v.title DESC`
            }
            LIMIT ${limit}
            OFFSET ${offset}
          `);

          results = searchResults.map((row) => ({
            video: {
              id: row.id,
              title: row.title,
              description: row.description,
              duration: row.duration,
              thumbnailUrl: row.thumbnail_url,
              videoUrl: row.video_url,
              authorId: row.author_id,
              organizationId: row.organization_id,
              transcript: row.transcript,
              transcriptSegments: row.transcript_segments as VideoWithAuthor['transcriptSegments'],
              processingStatus: row.processing_status as VideoWithAuthor['processingStatus'],
              processingError: row.processing_error,
              aiSummary: row.ai_summary,
              aiTags: row.ai_tags,
              aiActionItems: row.ai_action_items as VideoWithAuthor['aiActionItems'],
              searchVector: row.search_vector as unknown as string,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
              author: {
                id: row.author_id_2,
                name: row.author_name,
                email: row.author_email,
                image: row.author_image,
                createdAt: row.author_created_at,
                updatedAt: row.author_updated_at,
                emailVerified: row.author_email_verified,
                role: row.author_role as 'user' | 'admin',
                banned: row.author_banned,
                banReason: row.author_ban_reason,
                banExpires: row.author_ban_expires,
                twoFactorEnabled: row.author_two_factor_enabled,
                stripeCustomerId: row.author_stripe_customer_id,
                lastLoginMethod: row.author_last_login_method,
              },
            } as VideoWithAuthor,
            rank: row.rank,
            highlights: {
              title: row.headline_title || undefined,
              description: row.headline_description || undefined,
              transcript: row.headline_transcript || undefined,
            },
          }));

          // Get total count
          const countResult = await db.execute<{ count: number }>(sql`
            SELECT COUNT(*) as count
            FROM videos v
            WHERE
              v.organization_id = ${organizationId}
              AND (
                v.search_vector @@ plainto_tsquery('english', ${query})
                OR v.title ILIKE ${`%${query}%`}
                OR v.description ILIKE ${`%${query}%`}
              )
              ${filters?.authorId ? sql`AND v.author_id = ${filters.authorId}` : sql``}
              ${filters?.processingStatus ? sql`AND v.processing_status = ${filters.processingStatus}` : sql``}
              ${filters?.hasTranscript ? sql`AND v.transcript IS NOT NULL` : sql``}
              ${filters?.hasAiSummary ? sql`AND v.ai_summary IS NOT NULL` : sql``}
              ${filters?.dateFrom ? sql`AND v.created_at >= ${new Date(filters.dateFrom)}` : sql``}
              ${filters?.dateTo ? sql`AND v.created_at <= ${new Date(filters.dateTo)}` : sql``}
          `);
          total = Number(countResult[0]?.count ?? 0);
        } else {
          // No query - just apply filters and return recent videos
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
                twoFactorEnabled: users.twoFactorEnabled,
                stripeCustomerId: users.stripeCustomerId,
                lastLoginMethod: users.lastLoginMethod,
              },
            })
            .from(videos)
            .innerJoin(users, eq(videos.authorId, users.id))
            .where(and(...conditions))
            .orderBy(
              sortBy === 'date'
                ? sortOrder === 'asc'
                  ? asc(videos.createdAt)
                  : desc(videos.createdAt)
                : sortBy === 'title'
                  ? sortOrder === 'asc'
                    ? asc(videos.title)
                    : desc(videos.title)
                  : desc(videos.createdAt),
            )
            .limit(limit)
            .offset(offset);

          results = videosData.map((v) => ({
            video: v as VideoWithAuthor,
            rank: 0,
          }));

          // Get total count for filters-only search
          const countData = await db
            .select({ count: sql<number>`count(*)` })
            .from(videos)
            .where(and(...conditions));
          total = Number(countData[0]?.count ?? 0);
        }

        return {
          results,
          total,
          query,
          filters,
          pagination: {
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        };
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to search videos',
          operation: 'search',
          cause: error,
        }),
    });

  const getSuggestions = (
    query: string,
    organizationId: string,
    userId: string,
    limit = 10,
  ): Effect.Effect<SearchSuggestion[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const suggestions: SearchSuggestion[] = [];

        if (!query.trim()) {
          // Return recent searches if no query
          const recentSearches = await db
            .select({ query: searchHistory.query })
            .from(searchHistory)
            .where(and(eq(searchHistory.userId, userId), eq(searchHistory.organizationId, organizationId)))
            .orderBy(desc(searchHistory.createdAt))
            .limit(limit);

          // Deduplicate recent searches
          const seen = new Set<string>();
          for (const s of recentSearches) {
            if (!seen.has(s.query.toLowerCase())) {
              seen.add(s.query.toLowerCase());
              suggestions.push({
                type: 'recent',
                text: s.query,
              });
            }
          }
          return suggestions;
        }

        // Get matching video titles
        const matchingVideos = await db
          .select({
            id: videos.id,
            title: videos.title,
          })
          .from(videos)
          .where(and(eq(videos.organizationId, organizationId), ilike(videos.title, `%${query}%`)))
          .orderBy(desc(videos.createdAt))
          .limit(5);

        for (const v of matchingVideos) {
          suggestions.push({
            type: 'video',
            text: v.title,
            videoId: v.id,
          });
        }

        // Get matching recent searches
        const matchingRecentSearches = await db
          .select({ query: searchHistory.query })
          .from(searchHistory)
          .where(
            and(
              eq(searchHistory.userId, userId),
              eq(searchHistory.organizationId, organizationId),
              ilike(searchHistory.query, `%${query}%`),
            ),
          )
          .orderBy(desc(searchHistory.createdAt))
          .limit(5);

        const seen = new Set<string>(matchingVideos.map((v) => v.title.toLowerCase()));
        for (const s of matchingRecentSearches) {
          if (!seen.has(s.query.toLowerCase())) {
            seen.add(s.query.toLowerCase());
            suggestions.push({
              type: 'recent',
              text: s.query,
            });
          }
        }

        return suggestions.slice(0, limit);
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to get search suggestions',
          operation: 'getSuggestions',
          cause: error,
        }),
    });

  const getRecentSearches = (
    userId: string,
    organizationId: string,
    limit = 10,
  ): Effect.Effect<SearchHistoryWithUser[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const results = await db
          .select({
            id: searchHistory.id,
            userId: searchHistory.userId,
            organizationId: searchHistory.organizationId,
            query: searchHistory.query,
            filters: searchHistory.filters,
            resultsCount: searchHistory.resultsCount,
            createdAt: searchHistory.createdAt,
            user: {
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
          .from(searchHistory)
          .innerJoin(users, eq(searchHistory.userId, users.id))
          .where(and(eq(searchHistory.userId, userId), eq(searchHistory.organizationId, organizationId)))
          .orderBy(desc(searchHistory.createdAt))
          .limit(limit);

        return results as SearchHistoryWithUser[];
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to get recent searches',
          operation: 'getRecentSearches',
          cause: error,
        }),
    });

  const saveSearchHistory = (
    input: CreateSearchHistoryInput,
  ): Effect.Effect<typeof searchHistory.$inferSelect, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const [result] = await db
          .insert(searchHistory)
          .values({
            userId: input.userId,
            organizationId: input.organizationId,
            query: input.query,
            filters: input.filters,
            resultsCount: input.resultsCount,
          })
          .returning();
        return result;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to save search history',
          operation: 'saveSearchHistory',
          cause: error,
        }),
    });

  const clearSearchHistory = (userId: string, organizationId: string): Effect.Effect<void, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        await db
          .delete(searchHistory)
          .where(and(eq(searchHistory.userId, userId), eq(searchHistory.organizationId, organizationId)));
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to clear search history',
          operation: 'clearSearchHistory',
          cause: error,
        }),
    });

  const getSavedSearches = (
    userId: string,
    organizationId: string,
  ): Effect.Effect<SavedSearchWithUser[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const results = await db
          .select({
            id: savedSearches.id,
            userId: savedSearches.userId,
            organizationId: savedSearches.organizationId,
            name: savedSearches.name,
            query: savedSearches.query,
            filters: savedSearches.filters,
            createdAt: savedSearches.createdAt,
            updatedAt: savedSearches.updatedAt,
            user: {
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
          .from(savedSearches)
          .innerJoin(users, eq(savedSearches.userId, users.id))
          .where(and(eq(savedSearches.userId, userId), eq(savedSearches.organizationId, organizationId)))
          .orderBy(desc(savedSearches.updatedAt));

        return results as SavedSearchWithUser[];
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to get saved searches',
          operation: 'getSavedSearches',
          cause: error,
        }),
    });

  const createSavedSearch = (
    input: CreateSavedSearchInput,
  ): Effect.Effect<typeof savedSearches.$inferSelect, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const [result] = await db
          .insert(savedSearches)
          .values({
            userId: input.userId,
            organizationId: input.organizationId,
            name: input.name,
            query: input.query,
            filters: input.filters,
          })
          .returning();
        return result;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to create saved search',
          operation: 'createSavedSearch',
          cause: error,
        }),
    });

  const updateSavedSearch = (
    id: string,
    userId: string,
    input: UpdateSavedSearchInput,
  ): Effect.Effect<typeof savedSearches.$inferSelect, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          return await db
            .update(savedSearches)
            .set({
              ...input,
              updatedAt: new Date(),
            })
            .where(and(eq(savedSearches.id, id), eq(savedSearches.userId, userId)))
            .returning();
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to update saved search',
            operation: 'updateSavedSearch',
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Saved search not found',
            entity: 'SavedSearch',
            id,
          }),
        );
      }

      return result[0];
    });

  const deleteSavedSearch = (id: string, userId: string): Effect.Effect<void, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          return await db
            .delete(savedSearches)
            .where(and(eq(savedSearches.id, id), eq(savedSearches.userId, userId)))
            .returning();
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to delete saved search',
            operation: 'deleteSavedSearch',
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Saved search not found',
            entity: 'SavedSearch',
            id,
          }),
        );
      }
    });

  const quickSearch = (
    query: string,
    organizationId: string,
    limit = 5,
  ): Effect.Effect<VideoWithAuthor[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        if (!query.trim()) {
          return [];
        }

        // Use ILIKE for quick partial matching (optimized for speed)
        const results = await db
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
              twoFactorEnabled: users.twoFactorEnabled,
              stripeCustomerId: users.stripeCustomerId,
              lastLoginMethod: users.lastLoginMethod,
            },
          })
          .from(videos)
          .innerJoin(users, eq(videos.authorId, users.id))
          .where(
            and(
              eq(videos.organizationId, organizationId),
              or(ilike(videos.title, `%${query}%`), ilike(videos.description, `%${query}%`)),
            ),
          )
          .orderBy(desc(videos.createdAt))
          .limit(limit);

        return results as VideoWithAuthor[];
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to perform quick search',
          operation: 'quickSearch',
          cause: error,
        }),
    });

  return {
    search,
    getSuggestions,
    getRecentSearches,
    saveSearchHistory,
    clearSearchHistory,
    getSavedSearches,
    createSavedSearch,
    updateSavedSearch,
    deleteSavedSearch,
    quickSearch,
  } satisfies SearchRepositoryService;
});

// =============================================================================
// Search Repository Layer
// =============================================================================

export const SearchRepositoryLive = Layer.effect(SearchRepository, makeSearchRepositoryService);

// =============================================================================
// Search Repository Helper Functions
// =============================================================================

export const search = (params: SearchParams): Effect.Effect<SearchResponse, DatabaseError, SearchRepository> =>
  Effect.gen(function* () {
    const repo = yield* SearchRepository;
    return yield* repo.search(params);
  });

export const getSuggestions = (
  query: string,
  organizationId: string,
  userId: string,
  limit?: number,
): Effect.Effect<SearchSuggestion[], DatabaseError, SearchRepository> =>
  Effect.gen(function* () {
    const repo = yield* SearchRepository;
    return yield* repo.getSuggestions(query, organizationId, userId, limit);
  });

export const getRecentSearches = (
  userId: string,
  organizationId: string,
  limit?: number,
): Effect.Effect<SearchHistoryWithUser[], DatabaseError, SearchRepository> =>
  Effect.gen(function* () {
    const repo = yield* SearchRepository;
    return yield* repo.getRecentSearches(userId, organizationId, limit);
  });

export const saveSearchHistory = (
  input: CreateSearchHistoryInput,
): Effect.Effect<typeof searchHistory.$inferSelect, DatabaseError, SearchRepository> =>
  Effect.gen(function* () {
    const repo = yield* SearchRepository;
    return yield* repo.saveSearchHistory(input);
  });

export const clearSearchHistory = (
  userId: string,
  organizationId: string,
): Effect.Effect<void, DatabaseError, SearchRepository> =>
  Effect.gen(function* () {
    const repo = yield* SearchRepository;
    return yield* repo.clearSearchHistory(userId, organizationId);
  });

export const getSavedSearches = (
  userId: string,
  organizationId: string,
): Effect.Effect<SavedSearchWithUser[], DatabaseError, SearchRepository> =>
  Effect.gen(function* () {
    const repo = yield* SearchRepository;
    return yield* repo.getSavedSearches(userId, organizationId);
  });

export const createSavedSearch = (
  input: CreateSavedSearchInput,
): Effect.Effect<typeof savedSearches.$inferSelect, DatabaseError, SearchRepository> =>
  Effect.gen(function* () {
    const repo = yield* SearchRepository;
    return yield* repo.createSavedSearch(input);
  });

export const updateSavedSearch = (
  id: string,
  userId: string,
  input: UpdateSavedSearchInput,
): Effect.Effect<typeof savedSearches.$inferSelect, DatabaseError | NotFoundError, SearchRepository> =>
  Effect.gen(function* () {
    const repo = yield* SearchRepository;
    return yield* repo.updateSavedSearch(id, userId, input);
  });

export const deleteSavedSearch = (
  id: string,
  userId: string,
): Effect.Effect<void, DatabaseError | NotFoundError, SearchRepository> =>
  Effect.gen(function* () {
    const repo = yield* SearchRepository;
    return yield* repo.deleteSavedSearch(id, userId);
  });

export const quickSearch = (
  query: string,
  organizationId: string,
  limit?: number,
): Effect.Effect<VideoWithAuthor[], DatabaseError, SearchRepository> =>
  Effect.gen(function* () {
    const repo = yield* SearchRepository;
    return yield* repo.quickSearch(query, organizationId, limit);
  });
