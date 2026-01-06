/**
 * Rate Limiting Middleware
 *
 * Provides rate limiting for API routes with:
 * - Redis-based rate limiting (Upstash) for distributed environments
 * - Rate limiting is disabled when Redis is not configured
 * - Different limits for auth endpoints vs general API
 * - Proper 429 responses with Retry-After header
 * - Sliding window rate limiting algorithm
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';
import { env } from '@/lib/env/server';

// =============================================================================
// Types
// =============================================================================

export interface RateLimitConfig {
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
// Redis Configuration
// =============================================================================

/**
 * Check if Redis is configured for rate limiting
 */
function isRedisConfigured(): boolean {
  return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}

/**
 * Create Redis client for rate limiting
 */
function createRedisClient(): Redis | null {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  return new Redis({
    url,
    token,
  });
}

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

/** Rate limit for billing operations (checkout, portal, subscription changes) */
export const BILLING_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 10, // 10 requests
  windowMs: 15 * 60 * 1000, // per 15 minutes
};

// =============================================================================
// Upstash Ratelimit Instances
// =============================================================================

// Cache rate limiter instances
let apiRateLimiter: Ratelimit | null = null;
let authRateLimiter: Ratelimit | null = null;
let sensitiveRateLimiter: Ratelimit | null = null;
let uploadRateLimiter: Ratelimit | null = null;
let billingRateLimiter: Ratelimit | null = null;

/**
 * Convert config to Upstash sliding window duration
 */
function configToUpstashDuration(config: RateLimitConfig): `${number} s` | `${number} m` | `${number} h` {
  const ms = config.windowMs;
  if (ms >= 60 * 60 * 1000) {
    return `${Math.floor(ms / (60 * 60 * 1000))} h`;
  }
  if (ms >= 60 * 1000) {
    return `${Math.floor(ms / (60 * 1000))} m`;
  }
  return `${Math.floor(ms / 1000)} s`;
}

/**
 * Get or create a rate limiter for the given config
 */
function getRateLimiter(config: RateLimitConfig, prefix: string): Ratelimit | null {
  const redis = createRedisClient();
  if (!redis) {
    return null;
  }

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.maxRequests, configToUpstashDuration(config)),
    prefix: `ratelimit:${prefix}`,
    analytics: true,
  });
}

/**
 * Get the API rate limiter (lazily initialized)
 */
function getApiRateLimiter(): Ratelimit | null {
  if (apiRateLimiter === null) {
    apiRateLimiter = getRateLimiter(API_RATE_LIMIT, 'api');
  }
  return apiRateLimiter;
}

/**
 * Get the auth rate limiter (lazily initialized)
 */
function getAuthRateLimiter(): Ratelimit | null {
  if (authRateLimiter === null) {
    authRateLimiter = getRateLimiter(AUTH_RATE_LIMIT, 'auth');
  }
  return authRateLimiter;
}

/**
 * Get the sensitive rate limiter (lazily initialized)
 */
function getSensitiveRateLimiter(): Ratelimit | null {
  if (sensitiveRateLimiter === null) {
    sensitiveRateLimiter = getRateLimiter(SENSITIVE_RATE_LIMIT, 'sensitive');
  }
  return sensitiveRateLimiter;
}

/**
 * Get the upload rate limiter (lazily initialized)
 */
function getUploadRateLimiter(): Ratelimit | null {
  if (uploadRateLimiter === null) {
    uploadRateLimiter = getRateLimiter(UPLOAD_RATE_LIMIT, 'upload');
  }
  return uploadRateLimiter;
}

/**
 * Get the billing rate limiter (lazily initialized)
 */
function getBillingRateLimiter(): Ratelimit | null {
  if (billingRateLimiter === null) {
    billingRateLimiter = getRateLimiter(BILLING_RATE_LIMIT, 'billing');
  }
  return billingRateLimiter;
}

// =============================================================================
// Rate Limit Functions
// =============================================================================

/**
 * Check rate limit using Redis (Upstash)
 */
async function checkRateLimitRedis(identifier: string, rateLimiter: Ratelimit): Promise<RateLimitResult> {
  const result = await rateLimiter.limit(identifier);

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    resetAt: result.reset,
  };
}

/**
 * Get client identifier from request (IP address or API key)
 */
export function getClientIdentifier(request: Request): string {
  // Check for API key first
  const apiKey = request.headers.get('x-api-key');
  if (apiKey) {
    // Use a hash of the API key prefix for identification
    return `api:${apiKey.slice(0, 10)}`;
  }

  // Fall back to IP address
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');

  const ip = cfConnectingIp || realIp || forwardedFor?.split(',')[0].trim() || 'unknown';

  return `ip:${ip}`;
}

/**
 * Create rate limit headers for response
 */
function createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };

  if (!result.success) {
    headers['Retry-After'] = String(Math.ceil((result.resetAt - Date.now()) / 1000));
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
      error: 'Too Many Requests',
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
// Async Rate Limit Functions (for API routes)
// =============================================================================

/**
 * Rate limiting middleware for API routes (async, uses Redis)
 * Returns null if rate limiting is disabled (Redis not configured) or if allowed
 *
 * @param request - The incoming request
 * @param config - Rate limit configuration (defaults to API_RATE_LIMIT)
 * @returns null if allowed or disabled, NextResponse if rate limited
 *
 * @example
 * export async function GET(request: NextRequest) {
 *   const rateLimitResult = await rateLimitAsync(request);
 *   if (rateLimitResult) return rateLimitResult;
 *   // ... handle request
 * }
 */
export async function rateLimitAsync(
  request: Request,
  _config: RateLimitConfig = API_RATE_LIMIT,
): Promise<NextResponse | null> {
  // Note: _config is reserved for future custom rate limit support
  const rateLimiter = getApiRateLimiter();

  // Rate limiting disabled when Redis is not configured
  if (!rateLimiter) {
    return null;
  }

  const identifier = getClientIdentifier(request);
  const result = await checkRateLimitRedis(identifier, rateLimiter);

  if (!result.success) {
    return createRateLimitResponse(result);
  }

  return null;
}

/**
 * Rate limiting for authentication endpoints (async, stricter limits)
 * Returns null if rate limiting is disabled (Redis not configured)
 */
export async function rateLimitAuthAsync(request: Request): Promise<NextResponse | null> {
  const rateLimiter = getAuthRateLimiter();

  // Rate limiting disabled when Redis is not configured
  if (!rateLimiter) {
    return null;
  }

  const identifier = getClientIdentifier(request);
  const result = await checkRateLimitRedis(`auth:${identifier}`, rateLimiter);

  if (!result.success) {
    return createRateLimitResponse(result);
  }

  return null;
}

/**
 * Rate limiting for sensitive operations (async, password reset, etc.)
 * Returns null if rate limiting is disabled (Redis not configured)
 */
export async function rateLimitSensitiveAsync(request: Request): Promise<NextResponse | null> {
  const rateLimiter = getSensitiveRateLimiter();

  // Rate limiting disabled when Redis is not configured
  if (!rateLimiter) {
    return null;
  }

  const identifier = getClientIdentifier(request);
  const result = await checkRateLimitRedis(`sensitive:${identifier}`, rateLimiter);

  if (!result.success) {
    return createRateLimitResponse(result);
  }

  return null;
}

/**
 * Rate limiting for file uploads (async)
 * Returns null if rate limiting is disabled (Redis not configured)
 */
export async function rateLimitUploadAsync(request: Request): Promise<NextResponse | null> {
  const rateLimiter = getUploadRateLimiter();

  // Rate limiting disabled when Redis is not configured
  if (!rateLimiter) {
    return null;
  }

  const identifier = getClientIdentifier(request);
  const result = await checkRateLimitRedis(`upload:${identifier}`, rateLimiter);

  if (!result.success) {
    return createRateLimitResponse(result);
  }

  return null;
}

/**
 * Rate limiting for billing operations (async)
 * Applies to checkout, portal, subscription changes
 * Returns null if rate limiting is disabled (Redis not configured)
 */
export async function rateLimitBillingAsync(request: Request): Promise<NextResponse | null> {
  const rateLimiter = getBillingRateLimiter();

  // Rate limiting disabled when Redis is not configured
  if (!rateLimiter) {
    return null;
  }

  const identifier = getClientIdentifier(request);
  const result = await checkRateLimitRedis(`billing:${identifier}`, rateLimiter);

  if (!result.success) {
    return createRateLimitResponse(result);
  }

  return null;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Wrapper function to apply rate limiting to an API handler (async)
 *
 * @example
 * export const GET = withRateLimitAsync(async (request: NextRequest) => {
 *   // ... handle request
 * });
 */
export function withRateLimitAsync(
  handler: (request: Request) => Promise<Response>,
  config: RateLimitConfig = API_RATE_LIMIT,
) {
  return async (request: Request): Promise<Response> => {
    const rateLimitResult = await rateLimitAsync(request, config);
    if (rateLimitResult) return rateLimitResult;

    return handler(request);
  };
}

/**
 * Wrapper function for auth endpoints with stricter rate limiting (async)
 */
export function withAuthRateLimitAsync(handler: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    const rateLimitResult = await rateLimitAuthAsync(request);
    if (rateLimitResult) return rateLimitResult;

    return handler(request);
  };
}

/**
 * Check if Redis rate limiting is enabled
 */
export function isRedisRateLimitingEnabled(): boolean {
  return isRedisConfigured();
}
