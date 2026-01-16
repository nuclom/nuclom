/**
 * Next.js Middleware for SaaS App
 *
 * Handles:
 * - Authentication checks for protected routes
 * - Rate limiting for API routes (Redis-based, disabled if Redis not configured)
 * - Request logging with structured output
 * - Request ID generation and propagation
 *
 * Note: Marketing routes (/, /pricing, /features, etc.) are handled by the
 * separate marketing app via Vercel microfrontends.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { getSessionCookie } from 'better-auth/cookies';
import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env/server';
import { createLogger } from '@/lib/logger';
import {
  API_RATE_LIMIT,
  AUTH_RATE_LIMIT,
  getClientIdentifier,
  SENSITIVE_RATE_LIMIT,
  UPLOAD_RATE_LIMIT,
} from '@/lib/rate-limit';

// =============================================================================
// Redis Rate Limiting (disabled if not configured)
// =============================================================================

function createRedisClient(): Redis | null {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  return new Redis({ url, token });
}

let apiRateLimiter: Ratelimit | null = null;
let authRateLimiter: Ratelimit | null = null;
let sensitiveRateLimiter: Ratelimit | null = null;
let uploadRateLimiter: Ratelimit | null = null;
let rateLimitersInitialized = false;

function initializeRateLimiters() {
  if (rateLimitersInitialized) return;

  const redis = createRedisClient();
  if (!redis) {
    rateLimitersInitialized = true;
    return;
  }

  apiRateLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(API_RATE_LIMIT.maxRequests, '1 m'),
    prefix: 'ratelimit:api',
  });

  authRateLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(AUTH_RATE_LIMIT.maxRequests, '15 m'),
    prefix: 'ratelimit:auth',
  });

  sensitiveRateLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(SENSITIVE_RATE_LIMIT.maxRequests, '1 h'),
    prefix: 'ratelimit:sensitive',
  });

  uploadRateLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(UPLOAD_RATE_LIMIT.maxRequests, '1 h'),
    prefix: 'ratelimit:upload',
  });

  rateLimitersInitialized = true;
}

async function checkRateLimit(
  identifier: string,
  type: 'api' | 'auth' | 'sensitive' | 'upload',
): Promise<{ success: boolean; remaining: number; resetAt: number; limit: number } | null> {
  initializeRateLimiters();

  let rateLimiter: Ratelimit | null = null;
  let config = API_RATE_LIMIT;

  switch (type) {
    case 'auth':
      rateLimiter = authRateLimiter;
      config = AUTH_RATE_LIMIT;
      break;
    case 'sensitive':
      rateLimiter = sensitiveRateLimiter;
      config = SENSITIVE_RATE_LIMIT;
      break;
    case 'upload':
      rateLimiter = uploadRateLimiter;
      config = UPLOAD_RATE_LIMIT;
      break;
    default:
      rateLimiter = apiRateLimiter;
      config = API_RATE_LIMIT;
  }

  if (!rateLimiter) {
    return null;
  }

  const result = await rateLimiter.limit(`${type}:${identifier}`);

  return {
    success: result.success,
    remaining: result.remaining,
    resetAt: result.reset,
    limit: config.maxRequests,
  };
}

// =============================================================================
// Route Classification
// =============================================================================

function isAuthRoute(pathname: string): boolean {
  const authPatterns = [
    '/api/auth/sign-in',
    '/api/auth/sign-up',
    '/api/auth/sign-out',
    '/api/auth/reset-password',
    '/api/auth/verify-email',
    '/api/auth/forgot-password',
    '/api/auth/two-factor',
    '/api/auth/passkey',
  ];
  return authPatterns.some((pattern) => pathname.startsWith(pattern));
}

function isSensitiveRoute(pathname: string): boolean {
  const sensitivePatterns = [
    '/api/auth/reset-password',
    '/api/auth/forgot-password',
    '/api/auth/change-password',
    '/api/user/delete',
  ];
  return sensitivePatterns.some((pattern) => pathname.startsWith(pattern));
}

function isUploadRoute(pathname: string): boolean {
  return pathname.startsWith('/api/videos/upload') || pathname.startsWith('/api/upload');
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

function isPublicApiRoute(pathname: string): boolean {
  const publicPatterns = ['/api/health', '/api/share/', '/api/beta-access', '/api/embed/'];
  return publicPatterns.some((pattern) => pathname.startsWith(pattern));
}

function isCronRoute(pathname: string): boolean {
  return pathname === '/api/cron';
}

function isBetterAuthRoute(pathname: string): boolean {
  return pathname.startsWith('/api/auth/');
}

function isProtectedApiRoute(pathname: string): boolean {
  if (!isApiRoute(pathname)) return false;
  if (isPublicApiRoute(pathname)) return false;
  if (isCronRoute(pathname)) return false;
  if (isBetterAuthRoute(pathname)) return false;
  if (pathname.startsWith('/api/webhooks/')) return false;
  return true;
}

function isPublicPageRoute(pathname: string): boolean {
  // Public routes in the SaaS app (auth flows, shared content)
  // Marketing routes (/, /pricing, /features) are handled by the marketing app
  const publicPatterns = [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/verify-email',
    '/verification-pending',
    '/accept-invitation',
    '/auth-error',
    '/share',
    '/embed',
    '/onboarding',
    '/opengraph-image',
    '/twitter-image',
  ];
  return publicPatterns.some((pattern) => pathname === pattern || pathname.startsWith(`${pattern}/`));
}

function isProtectedPageRoute(pathname: string): boolean {
  if (isApiRoute(pathname)) return false;
  return !isPublicPageRoute(pathname);
}

// =============================================================================
// Request Logging
// =============================================================================

const requestLogger = createLogger('http');

function generateRequestId(): string {
  return crypto.randomUUID();
}

// =============================================================================
// Middleware
// =============================================================================

export async function middleware(request: NextRequest) {
  const startTime = Date.now();
  const { pathname } = request.nextUrl;
  const method = request.method;

  const requestId = request.headers.get('x-request-id') || generateRequestId();

  // =============================================================================
  // Authentication Check for Protected Routes
  // =============================================================================

  const needsAuth = isProtectedApiRoute(pathname) || isProtectedPageRoute(pathname);

  if (needsAuth) {
    const sessionCookie = getSessionCookie(request, { cookiePrefix: 'nuclom' });
    if (!sessionCookie) {
      if (isApiRoute(pathname)) {
        requestLogger.warn(
          { requestId, method, path: pathname, status: 401 },
          `← ${method} ${pathname} 401 Unauthorized (no session cookie)`,
        );

        return new NextResponse(
          JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json', 'x-request-id': requestId },
          },
        );
      }

      const signInUrl = new URL('/login', request.url);
      signInUrl.searchParams.set('callbackUrl', pathname);

      requestLogger.info(
        { requestId, path: pathname, redirectTo: signInUrl.pathname },
        `Redirecting unauthenticated user to sign-in`,
      );

      return NextResponse.redirect(signInUrl);
    }

    const session = await auth.api.getSession({ headers: request.headers });

    if (!session) {
      if (isApiRoute(pathname)) {
        requestLogger.warn(
          { requestId, method, path: pathname, status: 401 },
          `← ${method} ${pathname} 401 Unauthorized`,
        );

        return new NextResponse(
          JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json', 'x-request-id': requestId },
          },
        );
      }

      const signInUrl = new URL('/login', request.url);
      signInUrl.searchParams.set('callbackUrl', pathname);

      requestLogger.info(
        { requestId, path: pathname, redirectTo: signInUrl.pathname },
        `Redirecting unauthenticated user to sign-in`,
      );

      return NextResponse.redirect(signInUrl);
    }
  }

  // =============================================================================
  // Non-API Routes - Skip rate limiting
  // =============================================================================

  if (!isApiRoute(pathname)) {
    const response = NextResponse.next();
    response.headers.set('x-request-id', requestId);
    return response;
  }

  if (isPublicApiRoute(pathname)) {
    const response = NextResponse.next();
    response.headers.set('x-request-id', requestId);

    const durationMs = Date.now() - startTime;
    requestLogger.info(
      { requestId, method, path: pathname, durationMs },
      `← ${method} ${pathname} (${durationMs}ms)`,
    );

    return response;
  }

  // =============================================================================
  // Rate Limiting for API Routes
  // =============================================================================

  const identifier = getClientIdentifier(request);

  let rateLimitType: 'api' | 'auth' | 'sensitive' | 'upload' = 'api';

  if (isSensitiveRoute(pathname)) {
    rateLimitType = 'sensitive';
  } else if (isAuthRoute(pathname)) {
    rateLimitType = 'auth';
  } else if (isUploadRoute(pathname)) {
    rateLimitType = 'upload';
  }

  const result = await checkRateLimit(identifier, rateLimitType);

  if (!result) {
    const response = NextResponse.next();
    response.headers.set('x-request-id', requestId);
    return response;
  }

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
        rateLimit: { type: rateLimitType, limit: result.limit, remaining: 0, retryAfter },
      },
      `← ${method} ${pathname} 429 Rate Limited (${durationMs}ms)`,
    );

    return new NextResponse(
      JSON.stringify({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
        retryAfter,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': requestId,
          'X-RateLimit-Limit': String(result.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
          'Retry-After': String(retryAfter),
        },
      },
    );
  }

  const response = NextResponse.next();
  response.headers.set('x-request-id', requestId);
  response.headers.set('X-RateLimit-Limit', String(result.limit));
  response.headers.set('X-RateLimit-Remaining', String(result.remaining));
  response.headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|public|favicon.ico|.well-known/workflow/|sitemap.xml|robots.txt|manifest.webmanifest|openapi.json|openapi.yaml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot|webmanifest)).*)',
  ],
};
