/**
 * Next.js Middleware - Authentication, rate limiting, and request tracing
 */

import { auth } from '@nuclom/lib/auth';
import { env } from '@nuclom/lib/env/server';
import { createLogger } from '@nuclom/lib/logger';
import {
  API_RATE_LIMIT,
  AUTH_RATE_LIMIT,
  getClientIdentifier,
  SENSITIVE_RATE_LIMIT,
  UPLOAD_RATE_LIMIT,
} from '@nuclom/lib/rate-limit';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { getSessionCookie } from 'better-auth/cookies';
import { type NextRequest, NextResponse } from 'next/server';

const logger = createLogger('http');

// Route patterns
const PUBLIC_API = ['/api/health', '/api/share/', '/api/beta-access'];
const PUBLIC_PAGES = [
  '/',
  '/auth',
  '/auth-error',
  '/sign-up',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/verification-pending',
  '/accept-invitation',
  '/share',
  '/embed',
  '/pricing',
  '/about',
  '/terms',
  '/privacy',
  '/cookies',
  '/content-policy',
  '/features',
  '/brand',
  '/status',
  '/blog',
  '/contact',
  '/help',
  '/docs',
  '/support',
  '/home',
  '/opengraph-image',
  '/twitter-image',
];
const SENSITIVE_ROUTES = [
  '/api/auth/reset-password',
  '/api/auth/forgot-password',
  '/api/auth/change-password',
  '/api/user/delete',
];
const AUTH_ROUTES = [
  '/api/auth/sign-in',
  '/api/auth/sign-up',
  '/api/auth/sign-out',
  '/api/auth/reset-password',
  '/api/auth/verify-email',
  '/api/auth/forgot-password',
  '/api/auth/two-factor',
  '/api/auth/passkey',
];
const UPLOAD_ROUTES = ['/api/videos/upload', '/api/upload'];

const matchesAny = (path: string, patterns: string[]) =>
  patterns.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(p));

// Rate limiting setup (lazy-initialized)
type RateLimitType = 'api' | 'auth' | 'sensitive' | 'upload';
const rateLimiters: Record<RateLimitType, Ratelimit | null> = { api: null, auth: null, sensitive: null, upload: null };
let rateLimitersReady = false;

function initRateLimiters() {
  if (rateLimitersReady) return;
  rateLimitersReady = true;

  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) return;

  const redis = new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN });
  const configs = {
    api: { limit: API_RATE_LIMIT.maxRequests, window: '1 m' as const },
    auth: { limit: AUTH_RATE_LIMIT.maxRequests, window: '15 m' as const },
    sensitive: { limit: SENSITIVE_RATE_LIMIT.maxRequests, window: '1 h' as const },
    upload: { limit: UPLOAD_RATE_LIMIT.maxRequests, window: '1 h' as const },
  };

  for (const [type, cfg] of Object.entries(configs)) {
    rateLimiters[type as RateLimitType] = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(cfg.limit, cfg.window),
      prefix: `ratelimit:${type}`,
    });
  }
}

// Helpers
function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    const desc = Object.getOwnPropertyDescriptor(error, 'message');
    if (desc && !desc.writable && !desc.set) {
      const e = new Error(error.message);
      e.name = error.name;
      e.stack = error.stack;
      return e;
    }
    return error;
  }
  return new Error(String(error));
}

function jsonResponse(body: object, status: number, headers: Record<string, string> = {}) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function isPublicRoute(pathname: string): boolean {
  if (pathname.startsWith('/api/')) {
    return (
      matchesAny(pathname, PUBLIC_API) ||
      pathname.startsWith('/api/auth/') ||
      pathname.startsWith('/api/webhooks/') ||
      pathname === '/api/cron'
    );
  }
  return matchesAny(pathname, PUBLIC_PAGES);
}

function getRateLimitType(pathname: string): RateLimitType {
  if (matchesAny(pathname, SENSITIVE_ROUTES)) return 'sensitive';
  if (matchesAny(pathname, AUTH_ROUTES)) return 'auth';
  if (matchesAny(pathname, UPLOAD_ROUTES)) return 'upload';
  return 'api';
}

// Main middleware
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID();

  try {
    // Auth check for protected routes
    if (!isPublicRoute(pathname)) {
      const sessionCookie = getSessionCookie(request, { cookiePrefix: 'nuclom' });
      const session = sessionCookie ? await auth.api.getSession({ headers: request.headers }) : null;

      if (!session) {
        if (pathname.startsWith('/api/')) {
          logger.warn({ requestId, method, path: pathname, status: 401 }, `${method} ${pathname} 401`);
          return jsonResponse({ error: 'Unauthorized', message: 'Authentication required' }, 401, {
            'x-request-id': requestId,
          });
        }
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(loginUrl);
      }
    }

    // Non-API routes: skip rate limiting
    if (!pathname.startsWith('/api/')) {
      const res = NextResponse.next();
      res.headers.set('x-request-id', requestId);
      return res;
    }

    // Rate limiting for API routes
    initRateLimiters();
    const type = getRateLimitType(pathname);
    const limiter = rateLimiters[type];
    const limits = {
      api: API_RATE_LIMIT,
      auth: AUTH_RATE_LIMIT,
      sensitive: SENSITIVE_RATE_LIMIT,
      upload: UPLOAD_RATE_LIMIT,
    }[type];

    if (limiter) {
      const result = await limiter.limit(`${type}:${getClientIdentifier(request)}`);

      if (!result.success) {
        const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
        logger.warn({ requestId, method, path: pathname, status: 429 }, `${method} ${pathname} 429`);
        return jsonResponse(
          { error: 'Too Many Requests', message: `Rate limit exceeded. Retry in ${retryAfter}s.`, retryAfter },
          429,
          {
            'x-request-id': requestId,
            'X-RateLimit-Limit': String(limits.maxRequests),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(result.reset / 1000)),
            'Retry-After': String(retryAfter),
          },
        );
      }

      const res = NextResponse.next();
      res.headers.set('x-request-id', requestId);
      res.headers.set('X-RateLimit-Limit', String(limits.maxRequests));
      res.headers.set('X-RateLimit-Remaining', String(result.remaining));
      res.headers.set('X-RateLimit-Reset', String(Math.ceil(result.reset / 1000)));
      return res;
    }

    const res = NextResponse.next();
    res.headers.set('x-request-id', requestId);
    return res;
  } catch (error) {
    const e = normalizeError(error);
    logger.error({ requestId, method, path: pathname, error: e.message }, `Middleware error: ${e.message}`);
    throw e;
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|public|favicon\\.ico|\\.well-known/|sitemap\\.xml|robots\\.txt|manifest\\.webmanifest|openapi\\.json|openapi\\.yaml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot|webmanifest)).*)',
  ],
};
