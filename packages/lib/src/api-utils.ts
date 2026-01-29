/**
 * API Utilities for Response Optimization
 *
 * Provides utilities for:
 * - Cache-Control headers with stale-while-revalidate
 * - Pagination query parsing
 */

// =============================================================================
// Cache-Control Header Utilities
// =============================================================================

/**
 * Cache configuration options
 */
export interface CacheOptions {
  maxAge?: number;
  staleWhileRevalidate?: number;
  isPrivate?: boolean;
  additionalDirectives?: string[];
}

/**
 * Generate Cache-Control header value
 */
export function getCacheControlHeader(options: CacheOptions = {}): string {
  const { maxAge = 0, staleWhileRevalidate = 0, isPrivate = true, additionalDirectives = [] } = options;

  const directives: string[] = [];
  directives.push(isPrivate ? 'private' : 'public');

  if (maxAge > 0) {
    directives.push(`max-age=${maxAge}`);
  } else {
    directives.push('no-cache');
  }

  if (staleWhileRevalidate > 0) {
    directives.push(`stale-while-revalidate=${staleWhileRevalidate}`);
  }

  directives.push(...additionalDirectives);
  return directives.join(', ');
}

/**
 * Pre-configured cache presets
 */
export const CachePresets = {
  noCache: { maxAge: 0, isPrivate: true } as CacheOptions,
  shortWithSwr: { maxAge: 60, staleWhileRevalidate: 300, isPrivate: true } as CacheOptions,
  mediumWithSwr: { maxAge: 300, staleWhileRevalidate: 3600, isPrivate: true } as CacheOptions,
  longWithSwr: { maxAge: 3600, staleWhileRevalidate: 86400, isPrivate: true } as CacheOptions,
  immutable: { maxAge: 31536000, isPrivate: false, additionalDirectives: ['immutable'] } as CacheOptions,
  progress: { maxAge: 10, staleWhileRevalidate: 30, isPrivate: true } as CacheOptions,
  aiAnalysis: { maxAge: 86400, staleWhileRevalidate: 604800, isPrivate: true } as CacheOptions,
} as const;

// =============================================================================
// Pagination Query Helpers
// =============================================================================

/**
 * Parse pagination parameters from URL search params
 */
export function parsePaginationParams(searchParams: URLSearchParams): {
  page: number;
  limit: number;
  cursor?: string;
  useCursor: boolean;
} {
  const cursor = searchParams.get('cursor') ?? undefined;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);

  return {
    page: Number.isNaN(page) || page < 1 ? 1 : page,
    limit: Number.isNaN(limit) || limit < 1 ? 20 : limit,
    cursor,
    useCursor: !!cursor,
  };
}
