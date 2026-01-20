/**
 * Content Source Types
 *
 * Type definitions for the unified content source abstraction layer.
 */

import type { Effect } from 'effect';
import type {
  ContentItem,
  ContentItemMetadata,
  ContentItemType,
  ContentKeyPoint,
  ContentParticipant,
  ContentParticipantRole,
  ContentProcessingStatus,
  ContentRelationship,
  ContentRelationshipType,
  ContentSource,
  ContentSourceConfig,
  ContentSourceSyncStatus,
  ContentSourceType,
} from '../../../db/schema';
import type {
  ContentAdapterNotFoundError,
  ContentItemNotFoundError,
  ContentProcessingError,
  ContentSourceAuthError,
  ContentSourceNotFoundError,
  ContentSourceSyncError,
  DatabaseError,
  EncryptionError,
} from '../../errors';

// =============================================================================
// Re-exports from schema for convenience
// =============================================================================

export type {
  ContentItem,
  ContentItemMetadata,
  ContentItemType,
  ContentKeyPoint,
  ContentParticipant,
  ContentParticipantRole,
  ContentProcessingStatus,
  ContentRelationship,
  ContentRelationshipType,
  ContentSource,
  ContentSourceConfig,
  ContentSourceSyncStatus,
  ContentSourceType,
};

// =============================================================================
// Input Types for Creating/Updating Content
// =============================================================================

/**
 * Input for creating a content source connection
 */
export interface CreateContentSourceInput {
  readonly organizationId: string;
  readonly type: ContentSourceType;
  readonly name: string;
  readonly config?: ContentSourceConfig;
  readonly credentials?: {
    readonly accessToken?: string;
    readonly refreshToken?: string;
    readonly expiresAt?: string;
    readonly apiKey?: string;
    readonly scope?: string;
  };
}

/**
 * Input for updating a content source
 */
export interface UpdateContentSourceInput {
  readonly name?: string;
  readonly config?: ContentSourceConfig;
  readonly credentials?: {
    readonly accessToken?: string;
    readonly refreshToken?: string;
    readonly expiresAt?: string;
    readonly apiKey?: string;
    readonly scope?: string;
  };
  readonly syncStatus?: ContentSourceSyncStatus;
  readonly errorMessage?: string | null;
}

/**
 * Input for creating a content item
 */
export interface CreateContentItemInput {
  readonly organizationId: string;
  readonly sourceId: string;
  readonly type: ContentItemType;
  readonly externalId: string;
  readonly title?: string;
  readonly content?: string;
  readonly contentHtml?: string;
  readonly authorId?: string;
  readonly authorExternal?: string;
  readonly authorName?: string;
  readonly createdAtSource?: Date;
  readonly updatedAtSource?: Date;
  readonly metadata?: ContentItemMetadata;
  readonly tags?: string[];
}

/**
 * Input for updating a content item
 */
export interface UpdateContentItemInput {
  readonly title?: string;
  readonly content?: string;
  readonly contentHtml?: string;
  readonly metadata?: ContentItemMetadata;
  readonly tags?: string[];
  readonly processingStatus?: ContentProcessingStatus;
  readonly processingError?: string | null;
  readonly processedAt?: Date;
  readonly summary?: string;
  readonly keyPoints?: ContentKeyPoint[];
  readonly sentiment?: string;
  readonly searchText?: string;
}

/**
 * Input for creating a content relationship
 */
export interface CreateContentRelationshipInput {
  readonly sourceItemId: string;
  readonly targetItemId: string;
  readonly relationshipType: ContentRelationshipType;
  readonly confidence?: number;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Input for creating a content participant
 */
export interface CreateContentParticipantInput {
  readonly contentItemId: string;
  readonly userId?: string;
  readonly externalId?: string;
  readonly name: string;
  readonly email?: string;
  readonly role?: ContentParticipantRole;
}

// =============================================================================
// Query/Filter Types
// =============================================================================

/**
 * Filters for querying content sources
 */
export interface ContentSourceFilters {
  readonly organizationId: string;
  readonly type?: ContentSourceType;
  readonly syncStatus?: ContentSourceSyncStatus;
}

/**
 * Filters for querying content items
 */
export interface ContentItemFilters {
  readonly organizationId: string;
  readonly sourceId?: string;
  readonly type?: ContentItemType;
  readonly processingStatus?: ContentProcessingStatus;
  readonly authorId?: string;
  readonly tags?: string[];
  readonly createdAfter?: Date;
  readonly createdBefore?: Date;
  readonly searchQuery?: string;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Sort options for content items
 */
export interface ContentItemSortOptions {
  readonly field: 'createdAt' | 'createdAtSource' | 'updatedAt' | 'title';
  readonly direction: 'asc' | 'desc';
}

// =============================================================================
// Result Types
// =============================================================================

/**
 * Content source with item counts
 */
export interface ContentSourceWithStats extends ContentSource {
  readonly itemCount: number;
  readonly pendingCount: number;
  readonly failedCount: number;
}

/**
 * Content item with its relationships and participants
 */
export interface ContentItemWithRelations extends ContentItem {
  readonly source?: ContentSource;
  readonly participants?: ContentParticipant[];
  readonly outgoingRelationships?: ContentRelationship[];
  readonly incomingRelationships?: ContentRelationship[];
}

/**
 * Paginated result set
 */
export interface PaginatedResult<T> {
  readonly items: T[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
  readonly hasMore: boolean;
}

/**
 * Sync progress information
 */
export interface SyncProgress {
  readonly sourceId: string;
  readonly status: 'idle' | 'running' | 'completed' | 'failed';
  readonly itemsProcessed: number;
  readonly itemsTotal?: number;
  readonly errors: Array<{ message: string; itemId?: string }>;
  readonly startedAt?: Date;
  readonly completedAt?: Date;
}

// =============================================================================
// Adapter Types
// =============================================================================

/**
 * Raw content item fetched from an external source before normalization.
 * Adapters return this format, and the system normalizes it to ContentItem.
 */
export interface RawContentItem {
  readonly externalId: string;
  readonly type: ContentItemType;
  readonly title?: string;
  readonly content?: string;
  readonly contentHtml?: string;
  readonly authorExternal?: string;
  readonly authorName?: string;
  readonly createdAtSource?: Date;
  readonly updatedAtSource?: Date;
  readonly metadata?: ContentItemMetadata;
  readonly tags?: string[];
  readonly participants?: Array<{
    readonly externalId?: string;
    readonly name: string;
    readonly email?: string;
    readonly role?: ContentParticipantRole;
  }>;
  readonly relatedExternalIds?: Array<{
    readonly externalId: string;
    readonly relationshipType: ContentRelationshipType;
  }>;
}

/**
 * Options for fetching content from an adapter
 */
export interface AdapterFetchOptions {
  readonly since?: Date;
  readonly until?: Date;
  readonly limit?: number;
  readonly cursor?: string;
  readonly filters?: Record<string, unknown>;
}

/**
 * Result of fetching content from an adapter
 */
export interface AdapterFetchResult {
  readonly items: RawContentItem[];
  readonly nextCursor?: string;
  readonly hasMore: boolean;
}

/**
 * Interface that content source adapters must implement.
 * Each adapter handles a specific content source type (Slack, Notion, etc.)
 */
export interface ContentSourceAdapter {
  /**
   * The source type this adapter handles
   */
  readonly sourceType: ContentSourceType;

  /**
   * Validate the credentials for a source
   */
  validateCredentials(source: ContentSource): Effect.Effect<boolean, ContentSourceAuthError | ContentSourceSyncError>;

  /**
   * Fetch content items from the source
   */
  fetchContent(
    source: ContentSource,
    options?: AdapterFetchOptions,
  ): Effect.Effect<AdapterFetchResult, ContentSourceSyncError | ContentSourceAuthError>;

  /**
   * Fetch a single content item by external ID
   */
  fetchItem(
    source: ContentSource,
    externalId: string,
  ): Effect.Effect<RawContentItem | null, ContentSourceSyncError | ContentSourceAuthError>;

  /**
   * Refresh authentication tokens if needed
   */
  refreshAuth?(
    source: ContentSource,
  ): Effect.Effect<{ accessToken: string; refreshToken?: string; expiresAt?: string }, ContentSourceAuthError>;
}

// =============================================================================
// Service Interface Types
// =============================================================================

/**
 * Content repository service errors
 */
export type ContentRepositoryError =
  | DatabaseError
  | ContentSourceNotFoundError
  | ContentItemNotFoundError
  | EncryptionError;

/**
 * Content processor service errors
 */
export type ContentProcessorError =
  | ContentProcessingError
  | ContentAdapterNotFoundError
  | ContentSourceNotFoundError
  | ContentSourceSyncError
  | ContentSourceAuthError;
