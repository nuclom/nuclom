/**
 * Next.js Middleware
 *
 * Handles:
 * - Rate limiting for API routes
 * - Request logging
 */

import { type NextRequest, NextResponse } from "next/server";
import {
  API_RATE_LIMIT,
  AUTH_RATE_LIMIT,
  getClientIdentifier,
  SENSITIVE_RATE_LIMIT,
  UPLOAD_RATE_LIMIT,
} from "@/lib/rate-limit";

// =============================================================================
// In-Memory Rate Limit Store (Edge Runtime Compatible)
// =============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// Simple in-memory store for Edge runtime
// Note: This is per-instance, so in a distributed environment you'd want Redis
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically (simple approach for Edge)
function cleanup() {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}

function checkRateLimit(
  identifier: string,
  config: { maxRequests: number; windowMs: number },
): { success: boolean; remaining: number; resetAt: number } {
  // Clean up occasionally
  if (Math.random() < 0.01) cleanup();

  const now = Date.now();
  const key = identifier;
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    // First request in this window
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    return {
      success: true,
      remaining: config.maxRequests - 1,
      resetAt: now + config.windowMs,
    };
  }

  if (entry.count >= config.maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  entry.count++;
  rateLimitStore.set(key, entry);

  return {
    success: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

// =============================================================================
// Route Classification
// =============================================================================

function isAuthRoute(pathname: string): boolean {
  const authPatterns = [
    "/api/auth/sign-in",
    "/api/auth/sign-up",
    "/api/auth/sign-out",
    "/api/auth/reset-password",
    "/api/auth/verify-email",
    "/api/auth/forgot-password",
    "/api/auth/two-factor",
    "/api/auth/passkey",
  ];
  return authPatterns.some((pattern) => pathname.startsWith(pattern));
}

function isSensitiveRoute(pathname: string): boolean {
  const sensitivePatterns = [
    "/api/auth/reset-password",
    "/api/auth/forgot-password",
    "/api/auth/change-password",
    "/api/user/delete",
  ];
  return sensitivePatterns.some((pattern) => pathname.startsWith(pattern));
}

function isUploadRoute(pathname: string): boolean {
  const uploadPatterns = ["/api/videos/upload", "/api/upload"];
  return uploadPatterns.some((pattern) => pathname.startsWith(pattern));
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

function isPublicApiRoute(pathname: string): boolean {
  const publicPatterns = ["/api/health", "/api/share/"];
  return publicPatterns.some((pattern) => pathname.startsWith(pattern));
}

// =============================================================================
// Middleware
// =============================================================================

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip non-API routes
  if (!isApiRoute(pathname)) {
    return NextResponse.next();
  }

  // Skip public endpoints (no rate limiting needed)
  if (isPublicApiRoute(pathname)) {
    return NextResponse.next();
  }

  // Get client identifier
  const identifier = getClientIdentifier(request);

  // Determine rate limit config based on route type
  let config: { maxRequests: number; windowMs: number };
  let prefix: string;

  if (isSensitiveRoute(pathname)) {
    config = SENSITIVE_RATE_LIMIT;
    prefix = "sensitive";
  } else if (isAuthRoute(pathname)) {
    config = AUTH_RATE_LIMIT;
    prefix = "auth";
  } else if (isUploadRoute(pathname)) {
    config = UPLOAD_RATE_LIMIT;
    prefix = "upload";
  } else {
    config = API_RATE_LIMIT;
    prefix = "api";
  }

  // Check rate limit
  const result = checkRateLimit(`${prefix}:${identifier}`, config);

  // If rate limited, return 429
  if (!result.success) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);

    return new NextResponse(
      JSON.stringify({
        error: "Too Many Requests",
        message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
        retryAfter,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Limit": String(config.maxRequests),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
          "Retry-After": String(retryAfter),
        },
      },
    );
  }

  // Continue with rate limit headers
  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Limit", String(config.maxRequests));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));

  return response;
}

// Configure which routes the middleware applies to
export const config = {
  matcher: [
    // Match all API routes except static files
    "/api/:path*",
  ],
};
