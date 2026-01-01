/**
 * Next.js Middleware
 *
 * Handles:
 * - Authentication checks for protected routes
 * - Rate limiting for API routes
 * - Request logging with structured output
 * - Request ID generation and propagation
 *
 * Uses Node.js runtime for better-auth session validation which requires
 * database access.
 */

// Use Node.js runtime for database access in auth validation
export const runtime = "nodejs";

import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
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

function isBetterAuthRoute(pathname: string): boolean {
  // Better-auth handles its own routes - don't interfere with auth flow
  return pathname.startsWith("/api/auth/");
}

function isProtectedApiRoute(pathname: string): boolean {
  // API routes that require authentication
  // Exclude: public routes, auth routes (handled by better-auth), webhooks
  if (!isApiRoute(pathname)) return false;
  if (isPublicApiRoute(pathname)) return false;
  if (isBetterAuthRoute(pathname)) return false;
  if (pathname.startsWith("/api/webhooks/")) return false;

  return true;
}

function isPublicPageRoute(pathname: string): boolean {
  // Routes that should be accessible without authentication
  const publicPatterns = [
    "/",
    "/auth",
    "/sign-in",
    "/sign-up",
    "/reset-password",
    "/verify-email",
    "/accept-invitation",
    "/share",
    "/pricing",
    "/about",
    "/terms",
    "/privacy",
    "/cookies",
    "/features",
    "/changelog",
    "/blog",
    "/contact",
    "/help",
    "/docs",
  ];
  return publicPatterns.some((pattern) => pathname === pattern || pathname.startsWith(`${pattern}/`));
}

function isProtectedPageRoute(pathname: string): boolean {
  // All non-API routes are protected unless explicitly public
  if (isApiRoute(pathname)) return false;
  return !isPublicPageRoute(pathname);
}

// =============================================================================
// Request Logging
// =============================================================================

const requestLogger = createLogger("http");

function generateRequestId(): string {
  return crypto.randomUUID();
}

function getClientIp(request: NextRequest): string | undefined {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || undefined;
}

// =============================================================================
// Middleware
// =============================================================================

export async function middleware(request: NextRequest) {
  const startTime = Date.now();
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Generate or use existing request ID
  const requestId = request.headers.get("x-request-id") || generateRequestId();

  // =============================================================================
  // Authentication Check for Protected Routes
  // =============================================================================

  // Check if route requires authentication
  const needsAuth = isProtectedApiRoute(pathname) || isProtectedPageRoute(pathname);

  if (needsAuth) {
    // Validate session using better-auth
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      // For API routes, return 401 Unauthorized
      if (isApiRoute(pathname)) {
        requestLogger.warn(
          {
            requestId,
            method,
            path: pathname,
            status: 401,
          },
          `← ${method} ${pathname} 401 Unauthorized`,
        );

        return new NextResponse(
          JSON.stringify({
            error: "Unauthorized",
            message: "Authentication required",
          }),
          {
            status: 401,
            headers: {
              "Content-Type": "application/json",
              "x-request-id": requestId,
            },
          },
        );
      }

      // For page routes, redirect to sign-in
      const signInUrl = new URL("/auth/sign-in", request.url);
      signInUrl.searchParams.set("callbackUrl", pathname);

      requestLogger.info(
        {
          requestId,
          path: pathname,
          redirectTo: signInUrl.pathname,
        },
        `Redirecting unauthenticated user to sign-in`,
      );

      return NextResponse.redirect(signInUrl);
    }
  }

  // =============================================================================
  // Non-API Routes - Skip rate limiting and detailed logging
  // =============================================================================

  if (!isApiRoute(pathname)) {
    const response = NextResponse.next();
    response.headers.set("x-request-id", requestId);
    return response;
  }

  // Log incoming request
  const clientIp = getClientIp(request);
  const userAgent = request.headers.get("user-agent") || undefined;

  requestLogger.info(
    {
      requestId,
      method,
      path: pathname,
      ip: clientIp,
      userAgent,
    },
    `→ ${method} ${pathname}`,
  );

  // Skip public endpoints (no rate limiting needed, but still log)
  if (isPublicApiRoute(pathname)) {
    const response = NextResponse.next();
    response.headers.set("x-request-id", requestId);

    // Log completion for public routes
    const durationMs = Date.now() - startTime;
    requestLogger.info(
      {
        requestId,
        method,
        path: pathname,
        durationMs,
      },
      `← ${method} ${pathname} (${durationMs}ms)`,
    );

    return response;
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
    const durationMs = Date.now() - startTime;

    requestLogger.warn(
      {
        requestId,
        method,
        path: pathname,
        status: 429,
        durationMs,
        rateLimit: {
          type: prefix,
          limit: config.maxRequests,
          remaining: 0,
          retryAfter,
        },
      },
      `← ${method} ${pathname} 429 Rate Limited (${durationMs}ms)`,
    );

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
          "x-request-id": requestId,
          "X-RateLimit-Limit": String(config.maxRequests),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
          "Retry-After": String(retryAfter),
        },
      },
    );
  }

  // Continue with rate limit headers and request ID
  const response = NextResponse.next();
  response.headers.set("x-request-id", requestId);
  response.headers.set("X-RateLimit-Limit", String(config.maxRequests));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));

  return response;
}

// Configure which routes the middleware applies to
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - Public assets (images, fonts, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)).*)",
  ],
};
