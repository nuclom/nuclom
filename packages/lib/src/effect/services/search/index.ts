/**
 * Search Services
 *
 * This module exports unified search capabilities across all content types.
 */

export {
  type ContentItemType,
  type ContentItemWithSource,
  type ContentSourceType,
  getSearchFacets,
  type SearchFacets,
  type SearchSuggestion,
  searchContentItems,
  // Service
  UnifiedSearch,
  UnifiedSearchLive,
  type UnifiedSearchParams,
  type UnifiedSearchResult,
  type UnifiedSearchResultItem,
  // Types
  type UnifiedSearchService,
  // Convenience functions
  unifiedSearch,
} from './unified-search';
