/**
 * Error Logging Utility
 *
 * Provides centralized error logging for both client and server-side errors
 * with structured JSON format compatible with Vercel's log ingestion.
 *
 * Features:
 * - Structured JSON logging for Vercel observability
 * - Error context (userId, organizationId, requestId, path, method)
 * - React error boundary compatible
 * - Global error handlers for unhandled exceptions
 */

// =============================================================================
// Types
// =============================================================================

import process from "node:process";
export interface ErrorContext {
  /** Unique request ID for tracing */
  requestId?: string;
  /** User ID if authenticated */
  userId?: string;
  /** Organization ID if available */
  organizationId?: string;
  /** Request path */
  path?: string;
  /** HTTP method */
  method?: string;
  /** Error digest from Next.js */
  digest?: string;
  /** Component stack from React */
  componentStack?: string;
}

export interface ClientErrorLog {
  error: Error;
  componentStack?: string;
  context?: string;
  metadata?: Record<string, unknown>;
}

export interface ApiErrorLog {
  url: string;
  method: string;
  status: number;
  errorCode?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface ServerErrorLog {
  error: Error & { digest?: string; code?: string };
  context: ErrorContext;
  metadata?: Record<string, unknown>;
}

interface StructuredErrorLog {
  timestamp: string;
  level: "error";
  service: string;
  environment: string;
  type: "CLIENT_ERROR" | "API_ERROR" | "SERVER_ERROR" | "UNHANDLED_REJECTION" | "GLOBAL_ERROR";
  error: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
    digest?: string;
  };
  context?: ErrorContext;
  metadata?: Record<string, unknown>;
  client?: {
    url?: string;
    userAgent?: string;
    referrer?: string;
  };
}

// =============================================================================
// Configuration
// =============================================================================

const SERVICE_NAME = "nuclom";

// Detect environment
const IS_SERVER = typeof window === "undefined";
const IS_PROD = IS_SERVER ? process.env.NODE_ENV === "production" : !window.location.hostname.includes("localhost");
const ENVIRONMENT = IS_PROD ? "production" : "development";

// =============================================================================
// Structured Error Formatting
// =============================================================================

function createStructuredError(
  type: StructuredErrorLog["type"],
  error: Error & { digest?: string; code?: string },
  options?: {
    context?: ErrorContext;
    metadata?: Record<string, unknown>;
    componentStack?: string;
  },
): StructuredErrorLog {
  const log: StructuredErrorLog = {
    timestamp: new Date().toISOString(),
    level: "error",
    service: SERVICE_NAME,
    environment: ENVIRONMENT,
    type,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
      digest: error.digest,
    },
  };

  if (options?.context) {
    log.context = options.context;
    if (options.componentStack) {
      log.context.componentStack = options.componentStack;
    }
  }

  if (options?.metadata) {
    log.metadata = options.metadata;
  }

  // Add client info if in browser
  if (!IS_SERVER && typeof window !== "undefined") {
    log.client = {
      url: window.location.href,
      userAgent: navigator.userAgent,
      referrer: document.referrer || undefined,
    };
  }

  return log;
}

function outputError(log: StructuredErrorLog): void {
  if (IS_PROD) {
    // In production, output structured JSON for Vercel log ingestion
    console.error(JSON.stringify(log));
  } else {
    // In development, output human-readable format
    console.group(`[${log.type}] ${log.error.name}: ${log.error.message}`);
    console.error("Error:", log.error);
    if (log.context) {
      console.error("Context:", log.context);
    }
    if (log.metadata) {
      console.error("Metadata:", log.metadata);
    }
    if (log.client) {
      console.error("Client:", log.client);
    }
    console.groupEnd();
  }
}

// =============================================================================
// Client-Side Error Logging
// =============================================================================

/**
 * Log a client-side React error (e.g., from Error Boundary)
 */
export function logClientError(log: ClientErrorLog): void {
  const structuredLog = createStructuredError("CLIENT_ERROR", log.error, {
    context: {
      path: typeof window !== "undefined" ? window.location.pathname : undefined,
    },
    metadata: {
      ...log.metadata,
      errorContext: log.context,
    },
    componentStack: log.componentStack,
  });

  outputError(structuredLog);
}

/**
 * Log an API error (e.g., failed fetch request)
 */
export function logApiError(log: ApiErrorLog): void {
  const error = new Error(log.message);
  error.name = "ApiError";

  const structuredLog = createStructuredError("API_ERROR", error, {
    context: {
      path: log.url,
      method: log.method,
    },
    metadata: {
      status: log.status,
      errorCode: log.errorCode,
      ...log.metadata,
    },
  });

  outputError(structuredLog);
}

/**
 * Log an unhandled promise rejection
 */
export function logUnhandledRejection(event: PromiseRejectionEvent): void {
  const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));

  const structuredLog = createStructuredError("UNHANDLED_REJECTION", error, {
    context: {
      path: typeof window !== "undefined" ? window.location.pathname : undefined,
    },
  });

  outputError(structuredLog);
}

/**
 * Log a global error event
 */
export function logGlobalError(event: ErrorEvent): void {
  const error = event.error instanceof Error ? event.error : new Error(event.message);

  const structuredLog = createStructuredError("GLOBAL_ERROR", error, {
    context: {
      path: typeof window !== "undefined" ? window.location.pathname : undefined,
    },
    metadata: {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    },
  });

  outputError(structuredLog);
}

// =============================================================================
// Server-Side Error Logging
// =============================================================================

/**
 * Log a server-side error with full context
 */
export function logServerError(log: ServerErrorLog): void {
  const structuredLog = createStructuredError("SERVER_ERROR", log.error, {
    context: log.context,
    metadata: log.metadata,
  });

  outputError(structuredLog);
}

/**
 * Create error context from Next.js request
 */
export function createErrorContext(
  request: Request,
  options?: {
    userId?: string;
    organizationId?: string;
    requestId?: string;
  },
): ErrorContext {
  const url = new URL(request.url);

  return {
    requestId: options?.requestId || request.headers.get("x-request-id") || crypto.randomUUID(),
    userId: options?.userId,
    organizationId: options?.organizationId,
    path: url.pathname,
    method: request.method,
  };
}

/**
 * Log an API route error with request context
 */
export function logApiRouteError(
  error: Error & { digest?: string; code?: string },
  request: Request,
  options?: {
    userId?: string;
    organizationId?: string;
    metadata?: Record<string, unknown>;
  },
): void {
  const context = createErrorContext(request, options);

  logServerError({
    error,
    context,
    metadata: options?.metadata,
  });
}

// =============================================================================
// React Error Boundary Helper
// =============================================================================

/**
 * Log error from React Error Boundary (Vercel-compatible)
 *
 * Usage in error.tsx:
 * ```tsx
 * useEffect(() => {
 *   logErrorBoundary(error, { digest: error.digest });
 * }, [error]);
 * ```
 */
export function logErrorBoundary(
  error: Error & { digest?: string },
  options?: {
    digest?: string;
    componentStack?: string;
    userId?: string;
    organizationId?: string;
  },
): void {
  const structuredLog = createStructuredError("CLIENT_ERROR", error, {
    context: {
      digest: options?.digest || error.digest,
      userId: options?.userId,
      organizationId: options?.organizationId,
      path: typeof window !== "undefined" ? window.location.pathname : undefined,
    },
    componentStack: options?.componentStack,
  });

  outputError(structuredLog);
}

// =============================================================================
// Global Error Handlers
// =============================================================================

let handlersInitialized = false;

/**
 * Initialize global error handlers
 * Call this once in your app's entry point
 */
export function initializeErrorHandlers(): void {
  if (typeof window === "undefined") return;
  if (handlersInitialized) return;

  // Handle unhandled promise rejections
  window.addEventListener("unhandledrejection", logUnhandledRejection);

  // Handle global errors
  window.addEventListener("error", logGlobalError);

  handlersInitialized = true;
}

/**
 * Clean up global error handlers
 */
export function cleanupErrorHandlers(): void {
  if (typeof window === "undefined") return;
  if (!handlersInitialized) return;

  window.removeEventListener("unhandledrejection", logUnhandledRejection);
  window.removeEventListener("error", logGlobalError);

  handlersInitialized = false;
}

// =============================================================================
// Error Reporting Wrapper for API Routes
// =============================================================================

/**
 * Wrap an API route handler to automatically log errors
 *
 * Usage:
 * ```ts
 * export const GET = withErrorLogging(async (request) => {
 *   // Your handler logic
 * });
 * ```
 */
export function withErrorLogging<T>(
  handler: (request: Request, context?: { params?: Record<string, string> }) => Promise<T>,
) {
  return async (request: Request, context?: { params?: Record<string, string> }): Promise<T> => {
    try {
      return await handler(request, context);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logApiRouteError(err, request);
      throw error;
    }
  };
}
