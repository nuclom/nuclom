/**
 * API Utilities for Response Optimization
 *
 * Provides utilities for:
 * - Cache-Control headers with stale-while-revalidate
 * - Cursor-based pagination helpers
 * - Response compression configuration
 */

import { NextResponse } from "next/server";

// =============================================================================
// Cache-Control Header Utilities
// =============================================================================

/**
 * Cache configuration options
 */
export interface CacheOptions {
  /** Max age in seconds for fresh cache */
  maxAge?: number;
  /** Stale-while-revalidate time in seconds */
  staleWhileRevalidate?: number;
  /** Whether the response is private (user-specific) */
  isPrivate?: boolean;
  /** Additional cache directives */
  additionalDirectives?: string[];
}

/**
 * Generate Cache-Control header value
 */
export function getCacheControlHeader(options: CacheOptions = {}): string {
  const { maxAge = 0, staleWhileRevalidate = 0, isPrivate = true, additionalDirectives = [] } = options;

  const directives: string[] = [];

  // Visibility
  directives.push(isPrivate ? "private" : "public");

  // Max age
  if (maxAge > 0) {
    directives.push(`max-age=${maxAge}`);
  } else {
    directives.push("no-cache");
  }

  // Stale-while-revalidate
  if (staleWhileRevalidate > 0) {
    directives.push(`stale-while-revalidate=${staleWhileRevalidate}`);
  }

  // Additional directives
  directives.push(...additionalDirectives);

  return directives.join(", ");
}

/**
 * Pre-configured cache presets
 */
export const CachePresets = {
  /** No caching - for real-time data */
  noCache: (): CacheOptions => ({
    maxAge: 0,
    isPrivate: true,
  }),

  /** Short cache with SWR - for frequently changing data (e.g., video lists) */
  shortWithSwr: (): CacheOptions => ({
    maxAge: 60, // 1 minute fresh
    staleWhileRevalidate: 300, // 5 minutes stale-while-revalidate
    isPrivate: true,
  }),

  /** Medium cache with SWR - for moderately changing data (e.g., organization data) */
  mediumWithSwr: (): CacheOptions => ({
    maxAge: 300, // 5 minutes fresh
    staleWhileRevalidate: 3600, // 1 hour stale-while-revalidate
    isPrivate: true,
  }),

  /** Long cache with SWR - for rarely changing data (e.g., AI analysis results) */
  longWithSwr: (): CacheOptions => ({
    maxAge: 3600, // 1 hour fresh
    staleWhileRevalidate: 86400, // 24 hours stale-while-revalidate
    isPrivate: true,
  }),

  /** Static content - for immutable data */
  immutable: (): CacheOptions => ({
    maxAge: 31536000, // 1 year
    isPrivate: false,
    additionalDirectives: ["immutable"],
  }),

  /** User progress data - very short cache */
  progress: (): CacheOptions => ({
    maxAge: 10, // 10 seconds fresh
    staleWhileRevalidate: 30, // 30 seconds stale-while-revalidate
    isPrivate: true,
  }),

  /** AI analysis results - long cache since they don't change */
  aiAnalysis: (): CacheOptions => ({
    maxAge: 86400, // 24 hours fresh
    staleWhileRevalidate: 604800, // 7 days stale-while-revalidate
    isPrivate: true,
  }),
} as const;

// =============================================================================
// Cursor-based Pagination Utilities
// =============================================================================

/**
 * Encode a cursor from a date and ID for stable pagination
 */
export function encodeCursor(createdAt: Date, id: string): string {
  const timestamp = createdAt.getTime();
  return Buffer.from(`${timestamp}:${id}`).toString("base64url");
}

/**
 * Decode a cursor to extract date and ID
 */
export function decodeCursor(cursor: string): { timestamp: number; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf-8");
    const [timestampStr, id] = decoded.split(":");
    const timestamp = parseInt(timestampStr, 10);

    if (isNaN(timestamp) || !id) {
      return null;
    }

    return { timestamp, id };
  } catch {
    return null;
  }
}

/**
 * Create cursor pagination info from results
 */
export function createCursorPagination<T extends { createdAt: Date; id: string }>(
  data: T[],
  limit: number,
  cursor?: string,
): {
  nextCursor: string | null;
  prevCursor: string | null;
  hasMore: boolean;
} {
  const hasMore = data.length > limit;
  const items = hasMore ? data.slice(0, limit) : data;

  let nextCursor: string | null = null;
  let prevCursor: string | null = null;

  if (hasMore && items.length > 0) {
    const lastItem = items[items.length - 1];
    nextCursor = encodeCursor(lastItem.createdAt, lastItem.id);
  }

  if (cursor && items.length > 0) {
    const firstItem = items[0];
    prevCursor = encodeCursor(firstItem.createdAt, firstItem.id);
  }

  return { nextCursor, prevCursor, hasMore };
}

// =============================================================================
// Response Helpers
// =============================================================================

/**
 * Create a JSON response with cache headers
 */
export function jsonResponse<T>(
  data: T,
  options: {
    status?: number;
    cache?: CacheOptions;
    headers?: Record<string, string>;
  } = {},
): NextResponse {
  const { status = 200, cache, headers = {} } = options;

  const responseHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (cache) {
    responseHeaders["Cache-Control"] = getCacheControlHeader(cache);
  }

  return NextResponse.json(data, {
    status,
    headers: responseHeaders,
  });
}

/**
 * Create a success response with proper caching
 */
export function successResponse<T>(data: T, cachePreset?: keyof typeof CachePresets): NextResponse {
  const cache = cachePreset ? CachePresets[cachePreset]() : undefined;
  return jsonResponse(data, { cache });
}

/**
 * Create an error response
 */
export function errorResponse(error: string | { message: string }, status = 500): NextResponse {
  const message = typeof error === "string" ? error : error.message;
  return jsonResponse({ error: message }, { status, cache: CachePresets.noCache() });
}

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
  const cursor = searchParams.get("cursor") ?? undefined;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100); // Max 100 items

  return {
    page: isNaN(page) || page < 1 ? 1 : page,
    limit: isNaN(limit) || limit < 1 ? 20 : limit,
    cursor,
    useCursor: !!cursor,
  };
}
