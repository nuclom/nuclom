/**
 * Structured Logging Utility
 *
 * Provides a centralized logging system with:
 * - Log levels (debug, info, warn, error)
 * - Structured JSON format for Vercel log ingestion
 * - Request context for tracing
 * - Timestamps and correlation IDs
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import process from "node:process";

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

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const SERVICE_NAME = "nuclom";
const ENVIRONMENT = (process.env.NODE_ENV ?? "development") as "development" | "test" | "production";
const MIN_LOG_LEVEL: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) || (ENVIRONMENT === "production" ? "info" : "debug");

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

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[MIN_LOG_LEVEL];
}

function formatLogEntry(entry: LogEntry): string {
  // In production, output JSON for Vercel log ingestion
  if (ENVIRONMENT === "production") {
    return JSON.stringify(entry);
  }

  // In development, output human-readable format
  const levelColors: Record<LogLevel, string> = {
    debug: "\x1b[36m", // cyan
    info: "\x1b[32m", // green
    warn: "\x1b[33m", // yellow
    error: "\x1b[31m", // red
  };
  const reset = "\x1b[0m";
  const color = levelColors[entry.level];

  let output = `${color}[${entry.level.toUpperCase()}]${reset} ${entry.timestamp} ${entry.message}`;

  if (entry.context?.requestId) {
    output += ` ${"\x1b[90m"}(${entry.context.requestId})${reset}`;
  }

  if (entry.durationMs !== undefined) {
    output += ` ${"\x1b[90m"}[${entry.durationMs}ms]${reset}`;
  }

  if (entry.error) {
    output += `\n  Error: ${entry.error.name}: ${entry.error.message}`;
    // Already in non-production branch, so show stack trace
    if (entry.error.stack) {
      output += `\n${entry.error.stack}`;
    }
  }

  if (entry.data && Object.keys(entry.data).length > 0) {
    output += `\n  Data: ${JSON.stringify(entry.data)}`;
  }

  return output;
}

function createLogEntry(
  level: LogLevel,
  message: string,
  options?: {
    context?: LogContext;
    error?: Error & { digest?: string; code?: string };
    data?: Record<string, unknown>;
    durationMs?: number;
  },
): LogEntry {
  const requestContext = getRequestContext();

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: SERVICE_NAME,
    environment: ENVIRONMENT,
    context: {
      ...requestContext,
      ...options?.context,
    },
  };

  if (options?.error) {
    entry.error = {
      name: options.error.name,
      message: options.error.message,
      stack: options.error.stack,
      code: options.error.code,
      digest: options.error.digest,
    };
  }

  if (options?.data) {
    entry.data = options.data;
  }

  if (options?.durationMs !== undefined) {
    entry.durationMs = options.durationMs;
  }

  // Remove empty context
  if (entry.context && Object.keys(entry.context).length === 0) {
    // biome-ignore lint/performance/noDelete: Cleanup empty context
    delete entry.context;
  }

  return entry;
}

function log(
  level: LogLevel,
  message: string,
  options?: {
    context?: LogContext;
    error?: Error & { digest?: string; code?: string };
    data?: Record<string, unknown>;
    durationMs?: number;
  },
): void {
  if (!shouldLog(level)) {
    return;
  }

  const entry = createLogEntry(level, message, options);
  const formatted = formatLogEntry(entry);

  switch (level) {
    case "debug":
    case "info":
      console.log(formatted);
      break;
    case "warn":
      console.warn(formatted);
      break;
    case "error":
      console.error(formatted);
      break;
  }
}

// =============================================================================
// Public Logger API
// =============================================================================

export const logger = {
  /**
   * Log a debug message (development only by default)
   */
  debug(message: string, data?: Record<string, unknown>, context?: LogContext): void {
    log("debug", message, { data, context });
  },

  /**
   * Log an informational message
   */
  info(message: string, data?: Record<string, unknown>, context?: LogContext): void {
    log("info", message, { data, context });
  },

  /**
   * Log a warning message
   */
  warn(message: string, data?: Record<string, unknown>, context?: LogContext): void {
    log("warn", message, { data, context });
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
    log("error", message, { error, data, context });
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
            log(level, message, { durationMs, data: options?.data, context: options?.context });
            return value;
          })
          .catch((error) => {
            const durationMs = Math.round(performance.now() - start);
            log("error", `${message} (failed)`, {
              durationMs,
              error,
              data: options?.data,
              context: options?.context,
            });
            throw error;
          }) as T;
      }

      const durationMs = Math.round(performance.now() - start);
      log(level, message, { durationMs, data: options?.data, context: options?.context });
      return result;
    } catch (error) {
      const durationMs = Math.round(performance.now() - start);
      log("error", `${message} (failed)`, {
        durationMs,
        error: error instanceof Error ? error : new Error(String(error)),
        data: options?.data,
        context: options?.context,
      });
      throw error;
    }
  },

  /**
   * Create a child logger with preset context
   */
  child(context: LogContext) {
    return {
      debug: (message: string, data?: Record<string, unknown>) => logger.debug(message, data, context),
      info: (message: string, data?: Record<string, unknown>) => logger.info(message, data, context),
      warn: (message: string, data?: Record<string, unknown>) => logger.warn(message, data, context),
      error: (message: string, error?: Error & { digest?: string; code?: string }, data?: Record<string, unknown>) =>
        logger.error(message, error, data, context),
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

  log(level, `${data.method} ${data.path} ${data.status}`, {
    durationMs: data.durationMs,
    context: {
      userId: data.userId,
      organizationId: data.organizationId,
      method: data.method,
      path: data.path,
    },
    data: {
      status: data.status,
      userAgent: data.userAgent,
      ip: data.ip,
    },
  });
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
