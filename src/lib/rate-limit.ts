/**
 * Rate Limiting Middleware
 *
 * Provides in-memory rate limiting for API routes with:
 * - Different limits for auth endpoints vs general API
 * - Proper 429 responses with Retry-After header
 * - Sliding window rate limiting algorithm
 */

import { NextResponse } from "next/server";

// =============================================================================
// Types
// =============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

// =============================================================================
// In-Memory Store
// =============================================================================

class RateLimitStore {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
  }

  get(key: string): RateLimitEntry | undefined {
    const entry = this.store.get(key);
    if (entry && entry.resetAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  set(key: string, entry: RateLimitEntry): void {
    this.store.set(key, entry);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.resetAt < now) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }
}

// Global store instance
const store = new RateLimitStore();

// =============================================================================
// Rate Limit Configurations
// =============================================================================

/** Rate limit for authentication endpoints (stricter) */
export const AUTH_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 10, // 10 requests
  windowMs: 15 * 60 * 1000, // per 15 minutes
};

/** Rate limit for general API endpoints */
export const API_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 100, // 100 requests
  windowMs: 60 * 1000, // per minute
};

/** Rate limit for sensitive operations (password reset, etc.) */
export const SENSITIVE_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 5, // 5 requests
  windowMs: 60 * 60 * 1000, // per hour
};

/** Rate limit for file uploads */
export const UPLOAD_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 20, // 20 uploads
  windowMs: 60 * 60 * 1000, // per hour
};

// =============================================================================
// Rate Limit Functions
// =============================================================================

/**
 * Check rate limit for a given identifier
 */
function checkRateLimit(identifier: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const key = identifier;
  const entry = store.get(key);

  if (!entry) {
    // First request in this window
    store.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      resetAt: now + config.windowMs,
    };
  }

  if (entry.count >= config.maxRequests) {
    // Rate limit exceeded
    return {
      success: false,
      limit: config.maxRequests,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  // Increment counter
  entry.count++;
  store.set(key, entry);

  return {
    success: true,
    limit: config.maxRequests,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Get client identifier from request (IP address or API key)
 */
export function getClientIdentifier(request: Request): string {
  // Check for API key first
  const apiKey = request.headers.get("x-api-key");
  if (apiKey) {
    // Use a hash of the API key prefix for identification
    return `api:${apiKey.slice(0, 10)}`;
  }

  // Fall back to IP address
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfConnectingIp = request.headers.get("cf-connecting-ip");

  const ip = cfConnectingIp || realIp || forwardedFor?.split(",")[0].trim() || "unknown";

  return `ip:${ip}`;
}

/**
 * Create rate limit headers for response
 */
function createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };

  if (!result.success) {
    headers["Retry-After"] = String(Math.ceil((result.resetAt - Date.now()) / 1000));
  }

  return headers;
}

/**
 * Create a 429 Too Many Requests response
 */
function createRateLimitResponse(result: RateLimitResult): NextResponse {
  const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);

  return NextResponse.json(
    {
      error: "Too Many Requests",
      message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
      retryAfter,
    },
    {
      status: 429,
      headers: createRateLimitHeaders(result),
    },
  );
}

// =============================================================================
// Middleware Functions
// =============================================================================

/**
 * Rate limiting middleware for API routes
 *
 * @param request - The incoming request
 * @param config - Rate limit configuration (defaults to API_RATE_LIMIT)
 * @returns null if allowed, NextResponse if rate limited
 *
 * @example
 * export async function GET(request: NextRequest) {
 *   const rateLimitResult = rateLimit(request);
 *   if (rateLimitResult) return rateLimitResult;
 *   // ... handle request
 * }
 */
export function rateLimit(request: Request, config: RateLimitConfig = API_RATE_LIMIT): NextResponse | null {
  const identifier = getClientIdentifier(request);
  const result = checkRateLimit(identifier, config);

  if (!result.success) {
    return createRateLimitResponse(result);
  }

  return null;
}

/**
 * Rate limiting for authentication endpoints (stricter limits)
 */
export function rateLimitAuth(request: Request): NextResponse | null {
  const identifier = getClientIdentifier(request);
  const result = checkRateLimit(`auth:${identifier}`, AUTH_RATE_LIMIT);

  if (!result.success) {
    return createRateLimitResponse(result);
  }

  return null;
}

/**
 * Rate limiting for sensitive operations (password reset, etc.)
 */
export function rateLimitSensitive(request: Request): NextResponse | null {
  const identifier = getClientIdentifier(request);
  const result = checkRateLimit(`sensitive:${identifier}`, SENSITIVE_RATE_LIMIT);

  if (!result.success) {
    return createRateLimitResponse(result);
  }

  return null;
}

/**
 * Rate limiting for file uploads
 */
export function rateLimitUpload(request: Request): NextResponse | null {
  const identifier = getClientIdentifier(request);
  const result = checkRateLimit(`upload:${identifier}`, UPLOAD_RATE_LIMIT);

  if (!result.success) {
    return createRateLimitResponse(result);
  }

  return null;
}

/**
 * Add rate limit headers to an existing response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  request: Request,
  config: RateLimitConfig = API_RATE_LIMIT,
): NextResponse {
  const identifier = getClientIdentifier(request);
  const result = checkRateLimit(identifier, config);

  const headers = createRateLimitHeaders(result);
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }

  return response;
}

/**
 * Wrapper function to apply rate limiting to an API handler
 *
 * @example
 * export const GET = withRateLimit(async (request: NextRequest) => {
 *   // ... handle request
 * });
 */
export function withRateLimit(
  handler: (request: Request) => Promise<Response>,
  config: RateLimitConfig = API_RATE_LIMIT,
) {
  return async (request: Request): Promise<Response> => {
    const rateLimitResult = rateLimit(request, config);
    if (rateLimitResult) return rateLimitResult;

    return handler(request);
  };
}

/**
 * Wrapper function for auth endpoints with stricter rate limiting
 */
export function withAuthRateLimit(handler: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    const rateLimitResult = rateLimitAuth(request);
    if (rateLimitResult) return rateLimitResult;

    return handler(request);
  };
}
