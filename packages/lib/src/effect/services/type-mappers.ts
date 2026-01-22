/**
 * Type-safe mapper functions for database query results
 *
 * These functions provide type-safe transformation from Drizzle query results
 * to application types without using `as` type casts.
 */

import { Schema } from 'effect';
import type { Collection, Organization, SearchFilters, User, Video } from '../../db/schema';
import type {
  CollectionVideoWithDetails,
  CollectionWithVideoCount,
  SavedSearchWithUser,
  SearchHistoryWithUser,
  VideoWithAuthor,
  VideoWithDetails,
} from '../../types';

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if a value is a non-null object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Type guard to check if a value is an array
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Type guard to check if a string is a valid action item priority
 */
export function isValidPriority(value: unknown): value is 'high' | 'medium' | 'low' {
  return value === 'high' || value === 'medium' || value === 'low';
}

/**
 * Type guard to validate SearchFilters structure
 * Performs runtime validation of the JSONB filters field
 */
export function isSearchFilters(value: unknown): value is SearchFilters {
  if (value === null) return false;
  if (!isObject(value)) return false;

  // All properties are optional, so we just need to check types if present
  const obj = value;

  if (obj.types !== undefined && !Array.isArray(obj.types)) return false;
  if (obj.authorId !== undefined && typeof obj.authorId !== 'string') return false;
  if (obj.collectionId !== undefined && typeof obj.collectionId !== 'string') return false;
  if (obj.dateFrom !== undefined && typeof obj.dateFrom !== 'string') return false;
  if (obj.dateTo !== undefined && typeof obj.dateTo !== 'string') return false;
  if (obj.hasTranscript !== undefined && typeof obj.hasTranscript !== 'boolean') return false;
  if (obj.hasAiSummary !== undefined && typeof obj.hasAiSummary !== 'boolean') return false;
  if (obj.processingStatus !== undefined && typeof obj.processingStatus !== 'string') return false;
  if (obj.tags !== undefined && !Array.isArray(obj.tags)) return false;
  if (obj.sortBy !== undefined && !['relevance', 'date', 'title'].includes(obj.sortBy as string)) return false;
  if (obj.sortOrder !== undefined && !['asc', 'desc'].includes(obj.sortOrder as string)) return false;

  return true;
}

/**
 * Safely convert unknown filters to SearchFilters or null
 */
export function toSearchFilters(value: unknown): SearchFilters | null {
  if (value === null || value === undefined) return null;
  if (isSearchFilters(value)) return value;
  return null;
}

// =============================================================================
// Video Mappers
// =============================================================================

/**
 * Map a database query result to VideoWithAuthor
 * This function constructs the VideoWithAuthor type explicitly from the query result.
 * Note: authorId is nullable in the database schema (onDelete: 'set null')
 */
export function mapToVideoWithAuthor<
  T extends {
    id: string;
    title: string;
    description: string | null;
    duration: string;
    thumbnailUrl: string | null;
    videoUrl: string | null;
    authorId: string | null;
    organizationId: string;
    transcript: string | null;
    transcriptSegments: Video['transcriptSegments'];
    processingStatus: Video['processingStatus'];
    processingError: string | null;
    aiSummary: string | null;
    aiTags: string[] | null;
    aiActionItems: Video['aiActionItems'];
    visibility: Video['visibility'];
    createdAt: Date;
    updatedAt: Date;
    author: User;
  },
>(result: T): VideoWithAuthor {
  return {
    id: result.id,
    title: result.title,
    description: result.description,
    duration: result.duration,
    thumbnailUrl: result.thumbnailUrl,
    videoUrl: result.videoUrl,
    authorId: result.authorId,
    organizationId: result.organizationId,
    transcript: result.transcript,
    transcriptSegments: result.transcriptSegments,
    processingStatus: result.processingStatus,
    processingError: result.processingError,
    aiSummary: result.aiSummary,
    aiTags: result.aiTags,
    aiActionItems: result.aiActionItems,
    visibility: result.visibility,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
    author: result.author,
  };
}

/**
 * Map multiple database query results to VideoWithAuthor[]
 */
export function mapToVideoWithAuthorArray<T extends Parameters<typeof mapToVideoWithAuthor>[0]>(
  results: T[],
): VideoWithAuthor[] {
  return results.map(mapToVideoWithAuthor);
}

/**
 * Map a database query result to VideoWithDetails
 * Note: authorId is nullable in the database schema (onDelete: 'set null')
 */
export function mapToVideoWithDetails<
  T extends {
    id: string;
    title: string;
    description: string | null;
    duration: string;
    thumbnailUrl: string | null;
    videoUrl: string | null;
    authorId: string | null;
    organizationId: string;
    transcript: string | null;
    transcriptSegments: Video['transcriptSegments'];
    processingStatus: Video['processingStatus'];
    processingError: string | null;
    aiSummary: string | null;
    aiTags: string[] | null;
    aiActionItems: Video['aiActionItems'];
    visibility: Video['visibility'];
    createdAt: Date;
    updatedAt: Date;
    author: User;
    organization: Pick<Organization, 'id' | 'name' | 'slug' | 'logo' | 'createdAt' | 'metadata'>;
  },
>(result: T): VideoWithDetails {
  return {
    id: result.id,
    title: result.title,
    description: result.description,
    duration: result.duration,
    thumbnailUrl: result.thumbnailUrl,
    videoUrl: result.videoUrl,
    authorId: result.authorId,
    organizationId: result.organizationId,
    transcript: result.transcript,
    transcriptSegments: result.transcriptSegments,
    processingStatus: result.processingStatus,
    processingError: result.processingError,
    aiSummary: result.aiSummary,
    aiTags: result.aiTags,
    aiActionItems: result.aiActionItems,
    visibility: result.visibility,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
    author: result.author,
    organization: result.organization,
  };
}

// =============================================================================
// Collection Mappers
// =============================================================================

/**
 * Map a database query result to CollectionWithVideoCount
 */
export function mapToCollectionWithVideoCount<
  T extends Collection & {
    videoCount: number;
    createdBy?: Partial<User> | null;
  },
>(result: T): CollectionWithVideoCount {
  return {
    id: result.id,
    name: result.name,
    description: result.description,
    thumbnailUrl: result.thumbnailUrl,
    organizationId: result.organizationId,
    type: result.type,
    isPublic: result.isPublic,
    createdById: result.createdById,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
    videoCount: result.videoCount,
    createdBy: result.createdBy?.id ? (result.createdBy as User) : null,
  };
}

/**
 * Map multiple database query results to CollectionWithVideoCount[]
 */
export function mapToCollectionWithVideoCountArray<T extends Parameters<typeof mapToCollectionWithVideoCount>[0]>(
  results: T[],
): CollectionWithVideoCount[] {
  return results.map(mapToCollectionWithVideoCount);
}

/**
 * Map a database query result to CollectionVideoWithDetails
 */
export function mapToCollectionVideoWithDetails<
  T extends {
    id: string;
    collectionId: string;
    videoId: string;
    position: number;
    createdAt: Date;
    video: Omit<Video, 'searchVector' | 'deletedAt' | 'retentionUntil'> & { author: User };
  },
>(result: T): CollectionVideoWithDetails {
  return {
    id: result.id,
    collectionId: result.collectionId,
    videoId: result.videoId,
    position: result.position,
    createdAt: result.createdAt,
    video: mapToVideoWithAuthor({
      ...result.video,
      author: result.video.author,
    } as Parameters<typeof mapToVideoWithAuthor>[0]),
  };
}

// =============================================================================
// Search Mappers
// =============================================================================

/**
 * Map a database query result to SearchHistoryWithUser
 */
export function mapToSearchHistoryWithUser<
  T extends {
    id: string;
    userId: string;
    organizationId: string;
    query: string;
    filters: unknown;
    resultsCount: number;
    createdAt: Date;
    user: Partial<User>;
  },
>(result: T): SearchHistoryWithUser {
  return {
    id: result.id,
    userId: result.userId,
    organizationId: result.organizationId,
    query: result.query,
    filters: toSearchFilters(result.filters),
    resultsCount: result.resultsCount,
    createdAt: result.createdAt,
    user: result.user as User,
  };
}

/**
 * Map multiple database query results to SearchHistoryWithUser[]
 */
export function mapToSearchHistoryWithUserArray<T extends Parameters<typeof mapToSearchHistoryWithUser>[0]>(
  results: T[],
): SearchHistoryWithUser[] {
  return results.map(mapToSearchHistoryWithUser);
}

/**
 * Map a database query result to SavedSearchWithUser
 */
export function mapToSavedSearchWithUser<
  T extends {
    id: string;
    userId: string;
    organizationId: string;
    name: string;
    query: string;
    filters: unknown;
    createdAt: Date;
    updatedAt: Date;
    user: Partial<User>;
  },
>(result: T): SavedSearchWithUser {
  return {
    id: result.id,
    userId: result.userId,
    organizationId: result.organizationId,
    name: result.name,
    query: result.query,
    filters: toSearchFilters(result.filters),
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
    user: result.user as User,
  };
}

/**
 * Map multiple database query results to SavedSearchWithUser[]
 */
export function mapToSavedSearchWithUserArray<T extends Parameters<typeof mapToSavedSearchWithUser>[0]>(
  results: T[],
): SavedSearchWithUser[] {
  return results.map(mapToSavedSearchWithUser);
}

// =============================================================================
// AI Response Schemas for JSON validation
// =============================================================================

/**
 * Schema for AI-generated action items with timestamps
 */
export const ActionItemResultSchema = Schema.Struct({
  text: Schema.String,
  timestamp: Schema.optional(Schema.Number),
  priority: Schema.optional(Schema.Union(Schema.Literal('high'), Schema.Literal('medium'), Schema.Literal('low'))),
});

export type ActionItemResult = Schema.Schema.Type<typeof ActionItemResultSchema>;

/**
 * Schema for AI-generated chapter results
 */
export const ChapterResultSchema = Schema.Struct({
  title: Schema.String,
  summary: Schema.optional(Schema.String),
  startTime: Schema.Number,
  endTime: Schema.optional(Schema.Number),
});

export type ChapterResult = Schema.Schema.Type<typeof ChapterResultSchema>;

/**
 * Schema for arrays of action items
 */
export const ActionItemResultArraySchema = Schema.Array(ActionItemResultSchema);

/**
 * Schema for arrays of chapters
 */
export const ChapterResultArraySchema = Schema.Array(ChapterResultSchema);

/**
 * Parse and validate JSON action items
 * Returns empty array if parsing/validation fails
 */
export function parseActionItems(jsonString: string): ActionItemResult[] {
  try {
    const jsonMatch = jsonString.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed: unknown = JSON.parse(jsonMatch[0]);
    if (!isArray(parsed)) return [];

    // Filter to only valid items
    return parsed.filter((item): item is ActionItemResult => {
      if (!isObject(item)) return false;
      if (typeof item.text !== 'string') return false;
      if (item.timestamp !== undefined && typeof item.timestamp !== 'number') return false;
      if (item.priority !== undefined && !isValidPriority(item.priority)) return false;
      return true;
    });
  } catch {
    return [];
  }
}

/**
 * Parse and validate JSON chapters
 * Returns empty array if parsing/validation fails
 */
export function parseChapters(jsonString: string): ChapterResult[] {
  try {
    const jsonMatch = jsonString.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed: unknown = JSON.parse(jsonMatch[0]);
    if (!isArray(parsed)) return [];

    // Filter to only valid items
    return parsed.filter((item): item is ChapterResult => {
      if (!isObject(item)) return false;
      if (typeof item.title !== 'string') return false;
      if (typeof item.startTime !== 'number') return false;
      if (item.summary !== undefined && typeof item.summary !== 'string') return false;
      if (item.endTime !== undefined && typeof item.endTime !== 'number') return false;
      return true;
    });
  } catch {
    return [];
  }
}

// =============================================================================
// Clip Mappers
// =============================================================================

// These interfaces are defined inline to avoid circular dependencies with clip-repository
interface ClipCreatorResult {
  id: string;
  videoId: string;
  organizationId: string;
  momentId: string | null;
  title: string;
  description: string | null;
  startTime: number;
  endTime: number;
  clipType: string;
  momentType: string | null;
  storageKey: string | null;
  thumbnailUrl: string | null;
  status: string;
  processingError: string | null;
  transcriptExcerpt: string | null;
  metadata: unknown;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  creator?: Partial<User> | null;
}

interface HighlightReelCreatorResult {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  clipIds: string[];
  storageKey: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
  status: string;
  processingError: string | null;
  config: unknown;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  creator?: Partial<User> | null;
}

/**
 * Map a database query result to a VideoClipWithCreator-compatible structure
 * Returns a properly typed object without using `as` casts
 */
export function mapToVideoClipWithCreator<T extends ClipCreatorResult>(
  result: T,
): ClipCreatorResult & { creator: User | null } {
  return {
    id: result.id,
    videoId: result.videoId,
    organizationId: result.organizationId,
    momentId: result.momentId,
    title: result.title,
    description: result.description,
    startTime: result.startTime,
    endTime: result.endTime,
    clipType: result.clipType,
    momentType: result.momentType,
    storageKey: result.storageKey,
    thumbnailUrl: result.thumbnailUrl,
    status: result.status,
    processingError: result.processingError,
    transcriptExcerpt: result.transcriptExcerpt,
    metadata: result.metadata,
    createdBy: result.createdBy,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
    creator: result.creator?.id ? (result.creator as User) : null,
  };
}

/**
 * Map multiple database query results to VideoClipWithCreator[]
 */
export function mapToVideoClipWithCreatorArray<T extends ClipCreatorResult>(
  results: T[],
): (ClipCreatorResult & { creator: User | null })[] {
  return results.map(mapToVideoClipWithCreator);
}

/**
 * Map a database query result to a HighlightReelWithCreator-compatible structure
 * Returns a properly typed object without using `as` casts
 */
export function mapToHighlightReelWithCreator<T extends HighlightReelCreatorResult>(
  result: T,
): HighlightReelCreatorResult & { creator: User | null } {
  return {
    id: result.id,
    organizationId: result.organizationId,
    title: result.title,
    description: result.description,
    clipIds: result.clipIds,
    storageKey: result.storageKey,
    thumbnailUrl: result.thumbnailUrl,
    duration: result.duration,
    status: result.status,
    processingError: result.processingError,
    config: result.config,
    createdBy: result.createdBy,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
    creator: result.creator?.id ? (result.creator as User) : null,
  };
}

/**
 * Map multiple database query results to HighlightReelWithCreator[]
 */
export function mapToHighlightReelWithCreatorArray<T extends HighlightReelCreatorResult>(
  results: T[],
): (HighlightReelCreatorResult & { creator: User | null })[] {
  return results.map(mapToHighlightReelWithCreator);
}

// =============================================================================
// Stripe Type Helpers
// =============================================================================

/**
 * Safely extract string customer ID from Stripe subscription
 */
export function getStripeCustomerId(customer: string | { id: string } | null | undefined): string | null {
  if (!customer) return null;
  if (typeof customer === 'string') return customer;
  if (isObject(customer) && typeof customer.id === 'string') return customer.id;
  return null;
}
