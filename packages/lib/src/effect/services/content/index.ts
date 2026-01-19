/**
 * Content Services - Unified Content Source Abstraction
 *
 * This module provides the infrastructure for ingesting and processing content
 * from multiple sources (videos, Slack, Notion, GitHub, etc.) into a unified
 * knowledge base.
 *
 * Key components:
 * - ContentRepository: CRUD operations for content sources, items, relationships
 * - ContentProcessor: Syncing and processing orchestration
 * - ContentSourceAdapter: Interface for source-specific adapters
 *
 * Usage:
 * ```typescript
 * import {
 *   ContentRepository,
 *   ContentProcessor,
 *   createContentSource,
 *   syncContentSource,
 * } from '@/lib/effect/services/content';
 *
 * // Create a content source
 * const source = yield* createContentSource({
 *   organizationId: 'org-123',
 *   type: 'slack',
 *   name: 'Engineering Slack',
 *   credentials: { accessToken: '...' },
 * });
 *
 * // Sync content from the source
 * const progress = yield* syncContentSource(source.id);
 * ```
 */

// Content Processor
export type { ContentProcessorService } from './content-processor';
export {
  ContentProcessor,
  ContentProcessorLive,
  getContentSyncProgress,
  processContentItem,
  processContentItemsBatch,
  registerContentAdapter,
  syncContentSource,
} from './content-processor';
// Content Repository
export type { ContentRepositoryService } from './content-repository';
export {
  ContentRepository,
  ContentRepositoryLive,
  createContentItem,
  createContentSource,
  deleteContentItem,
  deleteContentSource,
  getContentItem,
  getContentItemByExternalId,
  getContentItems,
  getContentItemWithRelations,
  getContentSource,
  getContentSources,
  getContentSourcesWithStats,
  updateContentItem,
  updateContentSource,
  upsertContentItem,
} from './content-repository';
// Migration Utilities
export type { MigrationResult } from './migrate-videos';
export {
  cleanupDuplicates,
  getMigrationStatus,
  migrateAllVideos,
  migrateOrganizationVideos,
} from './migrate-videos';
// Types
export type {
  AdapterFetchOptions,
  AdapterFetchResult,
  ContentItem,
  ContentItemFilters,
  ContentItemMetadata,
  ContentItemSortOptions,
  ContentItemType,
  ContentItemWithRelations,
  ContentKeyPoint,
  ContentParticipant,
  ContentParticipantRole,
  ContentProcessingStatus,
  ContentProcessorError,
  ContentRelationship,
  ContentRelationshipType,
  ContentRepositoryError,
  ContentSource,
  ContentSourceAdapter,
  ContentSourceConfig,
  ContentSourceFilters,
  ContentSourceSyncStatus,
  ContentSourceType,
  ContentSourceWithStats,
  CreateContentItemInput,
  CreateContentParticipantInput,
  CreateContentRelationshipInput,
  CreateContentSourceInput,
  PaginatedResult,
  PaginationOptions,
  RawContentItem,
  SyncProgress,
  UpdateContentItemInput,
  UpdateContentSourceInput,
} from './types';
// Video Content Adapter
export {
  createVideoContentAdapter,
  ensureVideoContentSource,
  registerVideoAdapter,
  syncVideoToContent,
} from './video-content-adapter';
