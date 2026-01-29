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
import { AppLive } from './effect/runtime';
import { Auth, makeAuthLayer } from './effect/services/auth';
import { Storage } from './effect/services/storage';

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

export interface EffectExitOptions {
  /** HTTP status code for success (default: 200) */
  status?: number;
  /** Headers to add on success */
  headers?: Record<string, string>;
  /** Headers to add on error */
  errorHeaders?: Record<string, string>;
}

/**
 * Handle Effect exit consistently across all API routes.
 *
 * @example
 * // Basic usage
 * return handleEffectExit(exit);
 *
 * // With custom status (e.g., 201 for POST)
 * return handleEffectExit(exit, { status: 201 });
 *
 * // With cache headers
 * return handleEffectExit(exit, { headers: { "Cache-Control": "max-age=60" } });
 */
export function handleEffectExit<T>(exit: Exit.Exit<T, unknown>, options: EffectExitOptions = {}): NextResponse {
  const { status = 200, headers, errorHeaders } = options;

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      const response =
        error._tag === 'Some'
          ? mapErrorToApiResponse(error.value)
          : mapErrorToApiResponse(new Error('Internal server error'));

      if (errorHeaders) {
        for (const [key, value] of Object.entries(errorHeaders)) {
          response.headers.set(key, value);
        }
      }
      return response;
    },
    onSuccess: (data) => NextResponse.json(data, { status, headers }),
  });
}

/** @deprecated Use handleEffectExit with options instead */
export function handleEffectExitWithStatus<T>(exit: Exit.Exit<T, unknown>, successStatus: number): NextResponse {
  return handleEffectExit(exit, { status: successStatus });
}

/** @deprecated Use handleEffectExit with options instead */
export function handleEffectExitWithOptions<T>(
  exit: Exit.Exit<T, unknown>,
  options: {
    successStatus?: number;
    successHeaders?: Record<string, string>;
    errorStatus?: number;
    errorHeaders?: Record<string, string>;
  } = {},
): NextResponse {
  return handleEffectExit(exit, {
    status: options.successStatus,
    headers: options.successHeaders,
    errorHeaders: options.errorHeaders,
  });
}

// =============================================================================
// Presigned URL Utilities
// =============================================================================

/**
 * Generate presigned URL from a stored R2 key.
 *
 * @param storage - The storage service instance
 * @param key - The stored key (thumbnail, video, etc.)
 * @param expiresIn - Optional expiration time in seconds (default: 3600 = 1 hour)
 * @returns Effect that resolves to presigned URL or null if key is missing
 *
 * @example
 * const storage = yield* Storage;
 * const presignedUrl = yield* generatePresignedUrl(storage, video.thumbnailUrl);
 */
export function generatePresignedUrl(
  storage: Context.Tag.Service<typeof Storage>,
  key: string | null,
  expiresIn = 3600,
): Effect.Effect<string | null, never, never> {
  if (!key) return Effect.succeed(null);
  return storage.generatePresignedDownloadUrl(key, expiresIn).pipe(Effect.catchAll(() => Effect.succeed(null)));
}

/** @deprecated Use generatePresignedUrl instead */
export const generatePresignedThumbnailUrl = generatePresignedUrl;

/** @deprecated Use generatePresignedUrl instead */
export const generatePresignedVideoUrl = generatePresignedUrl;

// =============================================================================
// Re-export commonly used utilities
// =============================================================================

export { Auth, mapErrorToApiResponse, Storage };
