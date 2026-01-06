/**
 * Request Context Service
 *
 * Provides request-scoped context for distributed tracing, logging, and error enrichment.
 * This service is created per-request and provides correlation IDs for tracking requests
 * across service boundaries.
 */

import { Context, Effect, Layer } from "effect";

// =============================================================================
// Types
// =============================================================================

/**
 * Request context that travels with each request through the system.
 * Useful for distributed tracing, logging, and error context.
 */
export interface RequestContext {
  /** Unique identifier for this request, used for distributed tracing */
  readonly correlationId: string;
  /** User ID if authenticated */
  readonly userId: string | undefined;
  /** Organization ID if available */
  readonly organizationId: string | undefined;
  /** Timestamp when the request was received */
  readonly requestedAt: Date;
  /** Request path (for logging) */
  readonly path: string | undefined;
  /** Request method (for logging) */
  readonly method: string | undefined;
  /** User agent (for analytics) */
  readonly userAgent: string | undefined;
}

export interface RequestContextService {
  /** Get the current request context */
  readonly getContext: Effect.Effect<RequestContext>;
  /** Get the correlation ID for this request */
  readonly getCorrelationId: Effect.Effect<string>;
  /** Get the user ID if authenticated */
  readonly getUserId: Effect.Effect<string | undefined>;
  /** Get the organization ID if available */
  readonly getOrganizationId: Effect.Effect<string | undefined>;
  /** Enrich the context with user information (call after authentication) */
  readonly enrichWithUser: (userId: string, organizationId?: string) => Effect.Effect<void>;
}

// =============================================================================
// Service Definition
// =============================================================================

export class RequestContextTag extends Context.Tag("RequestContext")<RequestContextTag, RequestContextService>() {}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Input for creating a request context
 */
export interface CreateRequestContextInput {
  correlationId?: string;
  userId?: string;
  organizationId?: string;
  path?: string;
  method?: string;
  userAgent?: string;
}

/**
 * Create a request context service for a specific request.
 * The context is mutable to allow enrichment after authentication.
 */
export function makeRequestContextService(input: CreateRequestContextInput = {}): RequestContextService {
  // Mutable context that can be enriched after authentication
  let context: RequestContext = {
    correlationId: input.correlationId ?? crypto.randomUUID(),
    userId: input.userId,
    organizationId: input.organizationId,
    requestedAt: new Date(),
    path: input.path,
    method: input.method,
    userAgent: input.userAgent,
  };

  return {
    getContext: Effect.succeed(context),
    getCorrelationId: Effect.succeed(context.correlationId),
    getUserId: Effect.succeed(context.userId),
    getOrganizationId: Effect.succeed(context.organizationId),
    enrichWithUser: (userId: string, organizationId?: string) =>
      Effect.sync(() => {
        context = {
          ...context,
          userId,
          organizationId: organizationId ?? context.organizationId,
        };
      }),
  };
}

/**
 * Extract request context from NextRequest headers
 */
export function extractRequestContext(request: Request): CreateRequestContextInput {
  const headers = request.headers;
  const url = new URL(request.url);

  return {
    // Use existing correlation ID from upstream services if present
    correlationId: headers.get("x-correlation-id") ?? headers.get("x-request-id") ?? undefined,
    path: url.pathname,
    method: request.method,
    userAgent: headers.get("user-agent") ?? undefined,
  };
}

/**
 * Create a layer for the request context service.
 * Use this in API routes to create request-scoped context.
 *
 * @example
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const requestContext = extractRequestContext(request);
 *   const layer = Layer.mergeAll(
 *     createFullLayer(),
 *     makeRequestContextLayer(requestContext)
 *   );
 *   // ...
 * }
 * ```
 */
export function makeRequestContextLayer(input: CreateRequestContextInput = {}): Layer.Layer<RequestContextTag> {
  return Layer.succeed(RequestContextTag, makeRequestContextService(input));
}

// =============================================================================
// Effect Helpers
// =============================================================================

/**
 * Get the current request context.
 */
export const getRequestContext = Effect.gen(function* () {
  const service = yield* RequestContextTag;
  return yield* service.getContext;
});

/**
 * Get the correlation ID for the current request.
 */
export const getCorrelationId = Effect.gen(function* () {
  const service = yield* RequestContextTag;
  return yield* service.getCorrelationId;
});

/**
 * Enrich the request context with user information.
 * Call this after successful authentication.
 */
export const enrichContextWithUser = (userId: string, organizationId?: string) =>
  Effect.gen(function* () {
    const service = yield* RequestContextTag;
    yield* service.enrichWithUser(userId, organizationId);
  });

/**
 * Add correlation ID to response headers for tracing.
 */
export function addCorrelationHeader(headers: Headers, correlationId: string): Headers {
  headers.set("x-correlation-id", correlationId);
  return headers;
}

/**
 * Create log context from request context.
 * Useful for structured logging.
 */
export function toLogContext(context: RequestContext): Record<string, unknown> {
  return {
    correlationId: context.correlationId,
    userId: context.userId,
    organizationId: context.organizationId,
    path: context.path,
    method: context.method,
    requestedAt: context.requestedAt.toISOString(),
  };
}
