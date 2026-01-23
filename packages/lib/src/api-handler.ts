/**
 * API Route Handler Utilities
 *
 * Provides standardized patterns for API route handling including:
 * - Consistent error response formatting
 * - Authentication layer setup
 * - Effect-TS integration
 * - Reduced boilerplate in route handlers
 */

import { Cause, type Context, Effect, Exit, Layer } from 'effect';
import { NextResponse } from 'next/server';
import { mapErrorToApiResponse } from './api-errors';
import { auth } from './auth';
import { AppLive, Storage } from './effect';
import { Auth, makeAuthLayer } from './effect/services/auth';

// =============================================================================
// Types
// =============================================================================

export interface ApiHandlerOptions {
  /** Enable caching headers */
  cache?: {
    maxAge?: number;
    staleWhileRevalidate?: number;
  };
}

// =============================================================================
// Layer Creation Helpers
// =============================================================================

/**
 * Create the full application layer with authentication
 *
 * @example
 * const FullLayer = createFullLayer();
 * const runnable = Effect.provide(effect, FullLayer);
 */
export function createFullLayer() {
  const AuthLayer = makeAuthLayer(auth);
  return Layer.merge(AppLive, AuthLayer);
}

/**
 * Create application layer without authentication
 */
export function createPublicLayer() {
  return AppLive;
}

// =============================================================================
// Route Parameter Helpers
// =============================================================================

/**
 * Resolve Next.js dynamic route params from a Promise.
 * Eliminates boilerplate of `yield* Effect.promise(() => params)`.
 *
 * @example
 * const { id } = yield* resolveParams(params);
 */
export const resolveParams = <T extends Record<string, string>>(params: Promise<T>): Effect.Effect<T, never, never> =>
  Effect.promise(() => params);

// =============================================================================
// Effect Runners
// =============================================================================

/**
 * Run an effect with the full application layer (with authentication).
 * Eliminates boilerplate of Effect.provide + Effect.runPromiseExit.
 *
 * @example
 * const exit = await runApiEffect(effect);
 * return handleEffectExit(exit);
 */
export async function runApiEffect<T, E>(effect: Effect.Effect<T, E, unknown>): Promise<Exit.Exit<T, E | Error>> {
  const runnable = Effect.provide(effect, createFullLayer()) as Effect.Effect<T, E | Error, never>;
  return Effect.runPromiseExit(runnable);
}

/**
 * Run an effect with the public layer (no authentication).
 *
 * @example
 * const exit = await runPublicApiEffect(effect);
 * return handleEffectExit(exit);
 */
export async function runPublicApiEffect<T, E>(effect: Effect.Effect<T, E, unknown>): Promise<Exit.Exit<T, E | Error>> {
  const runnable = Effect.provide(effect, createPublicLayer()) as Effect.Effect<T, E | Error, never>;
  return Effect.runPromiseExit(runnable);
}

// =============================================================================
// Effect Exit Handler
// =============================================================================

/**
 * Handle Effect exit consistently across all API routes
 *
 * @example
 * const exit = await Effect.runPromiseExit(runnable);
 * return handleEffectExit(exit);
 */
export function handleEffectExit<T>(exit: Exit.Exit<T, unknown>, options?: ApiHandlerOptions): NextResponse {
  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === 'Some') {
        return mapErrorToApiResponse(error.value);
      }
      return mapErrorToApiResponse(new Error('Internal server error'));
    },
    onSuccess: (data) => {
      const headers: Record<string, string> = {};

      if (options?.cache) {
        const parts: string[] = [];
        if (options.cache.maxAge !== undefined) {
          parts.push(`max-age=${options.cache.maxAge}`);
        }
        if (options.cache.staleWhileRevalidate !== undefined) {
          parts.push(`stale-while-revalidate=${options.cache.staleWhileRevalidate}`);
        }
        if (parts.length > 0) {
          headers['Cache-Control'] = parts.join(', ');
        }
      }

      return NextResponse.json(data, {
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      });
    },
  });
}

/**
 * Handle Effect exit with custom status code for success (e.g., 201 for POST)
 */
export function handleEffectExitWithStatus<T>(exit: Exit.Exit<T, unknown>, successStatus: number): NextResponse {
  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === 'Some') {
        return mapErrorToApiResponse(error.value);
      }
      return mapErrorToApiResponse(new Error('Internal server error'));
    },
    onSuccess: (data) => NextResponse.json(data, { status: successStatus }),
  });
}

/**
 * Handle Effect exit with full custom response options
 *
 * Use this when you need custom headers, status codes, or other response options.
 *
 * @example
 * return handleEffectExitWithOptions(exit, {
 *   successStatus: 200,
 *   successHeaders: { "Cache-Control": "public, max-age=60" },
 *   errorHeaders: { "Cache-Control": "no-store" },
 * });
 */
export function handleEffectExitWithOptions<T>(
  exit: Exit.Exit<T, unknown>,
  options: {
    successStatus?: number;
    successHeaders?: Record<string, string>;
    errorStatus?: number;
    errorHeaders?: Record<string, string>;
  } = {},
): NextResponse {
  const { successStatus = 200, successHeaders, errorHeaders } = options;

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      const response =
        error._tag === 'Some'
          ? mapErrorToApiResponse(error.value)
          : mapErrorToApiResponse(new Error('Internal server error'));

      // Add custom error headers if provided
      if (errorHeaders) {
        for (const [key, value] of Object.entries(errorHeaders)) {
          response.headers.set(key, value);
        }
      }
      return response;
    },
    onSuccess: (data) =>
      NextResponse.json(data, {
        status: successStatus,
        headers: successHeaders,
      }),
  });
}

// =============================================================================
// Presigned URL Utilities
// =============================================================================

/**
 * Generate presigned thumbnail URL from stored key.
 *
 * This helper converts stored R2 keys to presigned download URLs.
 *
 * @param storage - The storage service instance
 * @param thumbnailKey - The stored thumbnail key
 * @param expiresIn - Optional expiration time in seconds (default: 3600 = 1 hour)
 * @returns Effect that resolves to presigned URL or null if key is missing
 *
 * @example
 * const storage = yield* Storage;
 * const presignedUrl = yield* generatePresignedThumbnailUrl(storage, video.thumbnailUrl);
 */
export function generatePresignedThumbnailUrl(
  storage: Context.Tag.Service<typeof Storage>,
  thumbnailKey: string | null,
  expiresIn = 3600,
): Effect.Effect<string | null, never, never> {
  if (!thumbnailKey) return Effect.succeed(null);

  return storage
    .generatePresignedDownloadUrl(thumbnailKey, expiresIn)
    .pipe(Effect.catchAll(() => Effect.succeed(null)));
}

/**
 * Generate presigned video URL from stored key.
 *
 * This helper converts stored R2 keys to presigned download URLs.
 *
 * @param storage - The storage service instance
 * @param videoKey - The stored video key
 * @param expiresIn - Optional expiration time in seconds (default: 3600 = 1 hour)
 * @returns Effect that resolves to presigned URL or null if key is missing
 */
export function generatePresignedVideoUrl(
  storage: Context.Tag.Service<typeof Storage>,
  videoKey: string | null,
  expiresIn = 3600,
): Effect.Effect<string | null, never, never> {
  if (!videoKey) return Effect.succeed(null);

  return storage.generatePresignedDownloadUrl(videoKey, expiresIn).pipe(Effect.catchAll(() => Effect.succeed(null)));
}

// =============================================================================
// Re-export commonly used utilities
// =============================================================================

export { Auth, mapErrorToApiResponse, Storage };
