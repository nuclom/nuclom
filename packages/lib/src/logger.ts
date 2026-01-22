/**
 * Structured Logging Utility (tslog-based)
 *
 * Provides a centralized logging system with:
 * - Log levels (debug, info, warn, error)
 * - Structured JSON format for production log ingestion
 * - Pretty-printed output for development
 * - Request context for tracing
 * - Timestamps and correlation IDs
 * - Child loggers for component-specific logging
 */

import { Logger } from 'tslog';
import { env } from './env/server';

// =============================================================================
// Types
// =============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  /** Unique request ID for tracing */
  requestId?: string;
  /** Correlation ID for distributed tracing */
  correlationId?: string;
  /** User ID if authenticated */
  userId?: string;
  /** Organization ID if available */
  organizationId?: string;
  /** Request path */
  path?: string;
  /** HTTP method */
  method?: string;
  /** Additional metadata */
  [key: string]: unknown;
}

export interface LogEntry {
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Log level */
  level: LogLevel;
  /** Log message */
  message: string;
  /** Service name */
  service: string;
  /** Environment */
  environment: string;
  /** Request context */
  context?: LogContext;
  /** Error details if applicable */
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
    digest?: string;
  };
  /** Additional structured data */
  data?: Record<string, unknown>;
  /** Duration in milliseconds for timed operations */
  durationMs?: number;
}

// =============================================================================
// Configuration
// =============================================================================

const SERVICE_NAME = 'nuclom';
const ENVIRONMENT = env.NODE_ENV;
const LOG_LEVEL_MAP = { debug: 0, info: 2, warn: 3, error: 4 } as const;
const LOG_LEVEL = env.LOG_LEVEL || (ENVIRONMENT === 'production' ? 'info' : 'debug');

// =============================================================================
// tslog Logger Instance
// =============================================================================

/**
 * Create the base tslog logger instance
 * - In production: JSON output for log aggregation
 * - In development/test: Pretty-printed colorized output
 */
const baseLogger = new Logger({
  name: SERVICE_NAME,
  minLevel: LOG_LEVEL_MAP[LOG_LEVEL],
  type: ENVIRONMENT === 'production' ? 'json' : 'pretty',
  stylePrettyLogs: ENVIRONMENT !== 'production',
  prettyLogTimeZone: 'local',
  hideLogPositionForProduction: true,
});

// =============================================================================
// Request Context Storage
// =============================================================================

// Use a simple context holder instead of AsyncLocalStorage for Edge compatibility
let currentContext: LogContext | undefined;

/**
 * Run a function with request context available to all logger calls within it
 */
export function withRequestContext<T>(context: LogContext, fn: () => T): T {
  const previousContext = currentContext;
  currentContext = context;
  try {
    return fn();
  } finally {
    currentContext = previousContext;
  }
}

/**
 * Get the current request context
 */
export function getRequestContext(): LogContext | undefined {
  return currentContext;
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  // Use crypto.randomUUID if available, otherwise fallback to a simple ID
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

// =============================================================================
// Logger Implementation
// =============================================================================

function mergeContext(context?: LogContext): Record<string, unknown> {
  const requestContext = getRequestContext();
  const merged = {
    ...requestContext,
    ...context,
  };

  // Remove undefined values
  return Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined));
}

function formatError(error?: Error & { digest?: string; code?: string }): Record<string, unknown> | undefined {
  if (!error) return undefined;
  return {
    err: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
      digest: error.digest,
    },
  };
}

// =============================================================================
// Public Logger API
// =============================================================================

export const logger = {
  /**
   * Access the underlying tslog logger for advanced use cases
   */
  tslog: baseLogger,

  /**
   * Log a debug message (development only by default)
   */
  debug(message: string, data?: Record<string, unknown>, context?: LogContext): void {
    const ctx = mergeContext(context);
    baseLogger.debug(message, { ...ctx, ...data });
  },

  /**
   * Log an informational message
   */
  info(message: string, data?: Record<string, unknown>, context?: LogContext): void {
    const ctx = mergeContext(context);
    baseLogger.info(message, { ...ctx, ...data });
  },

  /**
   * Log a warning message
   */
  warn(message: string, data?: Record<string, unknown>, context?: LogContext): void {
    const ctx = mergeContext(context);
    baseLogger.warn(message, { ...ctx, ...data });
  },

  /**
   * Log an error message
   */
  error(
    message: string,
    error?: Error & { digest?: string; code?: string },
    data?: Record<string, unknown>,
    context?: LogContext,
  ): void {
    const ctx = mergeContext(context);
    const errorData = formatError(error);
    baseLogger.error(message, { ...ctx, ...data, ...errorData });
  },

  /**
   * Log a timed operation
   */
  timed<T>(
    message: string,
    fn: () => T,
    options?: {
      data?: Record<string, unknown>;
      context?: LogContext;
      level?: LogLevel;
    },
  ): T {
    const start = performance.now();
    const level = options?.level || 'info';

    try {
      const result = fn();

      // Handle promises
      if (result instanceof Promise) {
        return result
          .then((value) => {
            const durationMs = Math.round(performance.now() - start);
            const ctx = mergeContext(options?.context);
            baseLogger[level](message, { ...ctx, ...options?.data, durationMs });
            return value;
          })
          .catch((error) => {
            const durationMs = Math.round(performance.now() - start);
            const ctx = mergeContext(options?.context);
            const errorData = formatError(error instanceof Error ? error : new Error(String(error)));
            baseLogger.error(`${message} (failed)`, { ...ctx, ...options?.data, ...errorData, durationMs });
            throw error;
          }) as T;
      }

      const durationMs = Math.round(performance.now() - start);
      const ctx = mergeContext(options?.context);
      baseLogger[level](message, { ...ctx, ...options?.data, durationMs });
      return result;
    } catch (error) {
      const durationMs = Math.round(performance.now() - start);
      const ctx = mergeContext(options?.context);
      const errorData = formatError(error instanceof Error ? error : new Error(String(error)));
      baseLogger.error(`${message} (failed)`, { ...ctx, ...options?.data, ...errorData, durationMs });
      throw error;
    }
  },

  /**
   * Create a child logger with preset context
   */
  child(context: LogContext) {
    const childLogger = baseLogger.getSubLogger({ name: context.requestId || 'child' });
    return {
      debug: (message: string, data?: Record<string, unknown>) => {
        childLogger.debug(message, { ...context, ...data });
      },
      info: (message: string, data?: Record<string, unknown>) => {
        childLogger.info(message, { ...context, ...data });
      },
      warn: (message: string, data?: Record<string, unknown>) => {
        childLogger.warn(message, { ...context, ...data });
      },
      error: (message: string, error?: Error & { digest?: string; code?: string }, data?: Record<string, unknown>) => {
        const errorData = formatError(error);
        childLogger.error(message, { ...context, ...data, ...errorData });
      },
      timed: <T>(message: string, fn: () => T, options?: { data?: Record<string, unknown>; level?: LogLevel }) =>
        logger.timed(message, fn, { ...options, context }),
    };
  },
};

// =============================================================================
// Request Logging Middleware Helper
// =============================================================================

export interface RequestLogData {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  userAgent?: string;
  ip?: string;
  userId?: string;
  organizationId?: string;
}

/**
 * Log an HTTP request completion
 */
export function logRequest(data: RequestLogData): void {
  const level: LogLevel = data.status >= 500 ? 'error' : data.status >= 400 ? 'warn' : 'info';

  baseLogger[level](`${data.method} ${data.path} ${data.status}`, {
    method: data.method,
    path: data.path,
    status: data.status,
    durationMs: data.durationMs,
    userAgent: data.userAgent,
    ip: data.ip,
    userId: data.userId,
    organizationId: data.organizationId,
  });
}

/**
 * Create request context from Next.js request headers
 */
export function createRequestContext(headers: Headers, requestId?: string): LogContext {
  return {
    requestId: requestId || headers.get('x-request-id') || generateRequestId(),
    correlationId: headers.get('x-correlation-id') || undefined,
    path: headers.get('x-invoke-path') || undefined,
    method: headers.get('x-invoke-method') || undefined,
  };
}

// =============================================================================
// Convenience Exports for Direct tslog Access
// =============================================================================

/**
 * Get a tslog child logger for a specific component/module
 * Useful for creating loggers scoped to specific parts of the application
 */
export function createLogger(name: string, bindings?: Record<string, unknown>) {
  return baseLogger.getSubLogger({ name, ...bindings });
}

/**
 * Export the base tslog logger for advanced use cases
 */
export { baseLogger as tslogLogger };
