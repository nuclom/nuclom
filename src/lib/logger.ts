/**
 * Structured Logging Utility (Pino-based)
 *
 * Provides a centralized logging system with:
 * - Log levels (debug, info, warn, error)
 * - Structured JSON format for production log ingestion
 * - Pretty-printed output for development
 * - Request context for tracing
 * - Timestamps and correlation IDs
 * - Child loggers for component-specific logging
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import process from "node:process";
import pino from "pino";

// =============================================================================
// Types
// =============================================================================

export type LogLevel = "debug" | "info" | "warn" | "error";

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

const SERVICE_NAME = "nuclom";
const ENVIRONMENT = (process.env.NODE_ENV ?? "development") as "development" | "test" | "production";
const LOG_LEVEL = (process.env.LOG_LEVEL as LogLevel) || (ENVIRONMENT === "production" ? "info" : "debug");

// =============================================================================
// Pino Logger Instance
// =============================================================================

/**
 * Create the base pino logger instance
 * - In production: JSON output for log aggregation
 * - In development/test: Pretty-printed colorized output
 */
const baseLogger = pino({
  level: LOG_LEVEL,
  base: {
    service: SERVICE_NAME,
    environment: ENVIRONMENT,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
  ...(ENVIRONMENT !== "production" && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname,service,environment",
        messageFormat: "{msg}",
        singleLine: false,
      },
    },
  }),
});

// =============================================================================
// Request Context Storage (AsyncLocalStorage for request-scoped context)
// =============================================================================

const requestContextStorage = new AsyncLocalStorage<LogContext>();

/**
 * Run a function with request context available to all logger calls within it
 */
export function withRequestContext<T>(context: LogContext, fn: () => T): T {
  return requestContextStorage.run(context, fn);
}

/**
 * Get the current request context
 */
export function getRequestContext(): LogContext | undefined {
  return requestContextStorage.getStore();
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return randomUUID();
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
   * Access the underlying pino logger for advanced use cases
   */
  pino: baseLogger,

  /**
   * Log a debug message (development only by default)
   */
  debug(message: string, data?: Record<string, unknown>, context?: LogContext): void {
    const ctx = mergeContext(context);
    baseLogger.debug({ ...ctx, ...data }, message);
  },

  /**
   * Log an informational message
   */
  info(message: string, data?: Record<string, unknown>, context?: LogContext): void {
    const ctx = mergeContext(context);
    baseLogger.info({ ...ctx, ...data }, message);
  },

  /**
   * Log a warning message
   */
  warn(message: string, data?: Record<string, unknown>, context?: LogContext): void {
    const ctx = mergeContext(context);
    baseLogger.warn({ ...ctx, ...data }, message);
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
    baseLogger.error({ ...ctx, ...data, ...errorData }, message);
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
    const level = options?.level || "info";

    try {
      const result = fn();

      // Handle promises
      if (result instanceof Promise) {
        return result
          .then((value) => {
            const durationMs = Math.round(performance.now() - start);
            const ctx = mergeContext(options?.context);
            baseLogger[level]({ ...ctx, ...options?.data, durationMs }, message);
            return value;
          })
          .catch((error) => {
            const durationMs = Math.round(performance.now() - start);
            const ctx = mergeContext(options?.context);
            const errorData = formatError(error instanceof Error ? error : new Error(String(error)));
            baseLogger.error({ ...ctx, ...options?.data, ...errorData, durationMs }, `${message} (failed)`);
            throw error;
          }) as T;
      }

      const durationMs = Math.round(performance.now() - start);
      const ctx = mergeContext(options?.context);
      baseLogger[level]({ ...ctx, ...options?.data, durationMs }, message);
      return result;
    } catch (error) {
      const durationMs = Math.round(performance.now() - start);
      const ctx = mergeContext(options?.context);
      const errorData = formatError(error instanceof Error ? error : new Error(String(error)));
      baseLogger.error({ ...ctx, ...options?.data, ...errorData, durationMs }, `${message} (failed)`);
      throw error;
    }
  },

  /**
   * Create a child logger with preset context
   */
  child(context: LogContext) {
    const childPino = baseLogger.child(context);
    return {
      debug: (message: string, data?: Record<string, unknown>) => childPino.debug(data || {}, message),
      info: (message: string, data?: Record<string, unknown>) => childPino.info(data || {}, message),
      warn: (message: string, data?: Record<string, unknown>) => childPino.warn(data || {}, message),
      error: (message: string, error?: Error & { digest?: string; code?: string }, data?: Record<string, unknown>) => {
        const errorData = formatError(error);
        childPino.error({ ...data, ...errorData }, message);
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
  const level: LogLevel = data.status >= 500 ? "error" : data.status >= 400 ? "warn" : "info";

  baseLogger[level](
    {
      method: data.method,
      path: data.path,
      status: data.status,
      durationMs: data.durationMs,
      userAgent: data.userAgent,
      ip: data.ip,
      userId: data.userId,
      organizationId: data.organizationId,
    },
    `${data.method} ${data.path} ${data.status}`,
  );
}

/**
 * Create request context from Next.js request headers
 */
export function createRequestContext(headers: Headers, requestId?: string): LogContext {
  return {
    requestId: requestId || headers.get("x-request-id") || generateRequestId(),
    correlationId: headers.get("x-correlation-id") || undefined,
    path: headers.get("x-invoke-path") || undefined,
    method: headers.get("x-invoke-method") || undefined,
  };
}

// =============================================================================
// Convenience Exports for Direct Pino Access
// =============================================================================

/**
 * Get a pino child logger for a specific component/module
 * Useful for creating loggers scoped to specific parts of the application
 */
export function createLogger(name: string, bindings?: Record<string, unknown>) {
  return baseLogger.child({ component: name, ...bindings });
}

/**
 * Export the base pino logger for advanced use cases
 */
export { baseLogger as pinoLogger };
