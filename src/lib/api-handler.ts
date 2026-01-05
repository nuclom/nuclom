/**
 * API Route Handler Utilities
 *
 * Provides standardized patterns for API route handling including:
 * - Consistent error response formatting
 * - Authentication layer setup
 * - Effect-TS integration
 * - Reduced boilerplate in route handlers
 */

import { Cause, Exit, Layer } from "effect";
import { NextResponse } from "next/server";
import { mapErrorToApiResponse } from "@/lib/api-errors";
import { auth } from "@/lib/auth";
import { AppLive } from "@/lib/effect";
import { Auth, makeAuthLayer } from "@/lib/effect/services/auth";

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
      if (error._tag === "Some") {
        return mapErrorToApiResponse(error.value);
      }
      return mapErrorToApiResponse(new Error("Internal server error"));
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
          headers["Cache-Control"] = parts.join(", ");
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
      if (error._tag === "Some") {
        return mapErrorToApiResponse(error.value);
      }
      return mapErrorToApiResponse(new Error("Internal server error"));
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
        error._tag === "Some"
          ? mapErrorToApiResponse(error.value)
          : mapErrorToApiResponse(new Error("Internal server error"));

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
// Re-export commonly used utilities
// =============================================================================

export { Auth, mapErrorToApiResponse };
