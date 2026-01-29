/**
 * Structured Logging Utility (tslog-based)
 *
 * Provides a centralized logging system with:
 * - Log levels (debug, info, warn, error)
 * - Structured JSON format for production log ingestion
 * - Pretty-printed output for development
 */

import { Logger } from 'tslog';
import { env } from './env/server';

// =============================================================================
// Types
// =============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  requestId?: string;
  correlationId?: string;
  userId?: string;
  organizationId?: string;
  path?: string;
  method?: string;
  [key: string]: unknown;
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

const baseLogger = new Logger({
  name: SERVICE_NAME,
  minLevel: LOG_LEVEL_MAP[LOG_LEVEL],
  type: ENVIRONMENT === 'production' ? 'json' : 'pretty',
  stylePrettyLogs: ENVIRONMENT !== 'production',
  prettyLogTimeZone: 'local',
  hideLogPositionForProduction: true,
});

// =============================================================================
// Helper Functions
// =============================================================================

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
  debug(message: string, data?: Record<string, unknown>): void {
    baseLogger.debug(message, data ?? {});
  },

  info(message: string, data?: Record<string, unknown>): void {
    baseLogger.info(message, data ?? {});
  },

  warn(message: string, data?: Record<string, unknown>): void {
    baseLogger.warn(message, data ?? {});
  },

  error(message: string, error?: Error & { digest?: string; code?: string }, data?: Record<string, unknown>): void {
    const errorData = formatError(error);
    baseLogger.error(message, { ...data, ...errorData });
  },

  timed<T>(message: string, fn: () => T, options?: { data?: Record<string, unknown>; level?: LogLevel }): T {
    const start = performance.now();
    const level = options?.level || 'info';

    try {
      const result = fn();

      if (result instanceof Promise) {
        return result
          .then((value) => {
            const durationMs = Math.round(performance.now() - start);
            baseLogger[level](message, { ...options?.data, durationMs });
            return value;
          })
          .catch((error) => {
            const durationMs = Math.round(performance.now() - start);
            const errorData = formatError(error instanceof Error ? error : new Error(String(error)));
            baseLogger.error(`${message} (failed)`, { ...options?.data, ...errorData, durationMs });
            throw error;
          }) as T;
      }

      const durationMs = Math.round(performance.now() - start);
      baseLogger[level](message, { ...options?.data, durationMs });
      return result;
    } catch (error) {
      const durationMs = Math.round(performance.now() - start);
      const errorData = formatError(error instanceof Error ? error : new Error(String(error)));
      baseLogger.error(`${message} (failed)`, { ...options?.data, ...errorData, durationMs });
      throw error;
    }
  },
};

// =============================================================================
// Component Logger Factory
// =============================================================================

/**
 * Create a logger for a specific component/module
 */
export function createLogger(name: string, bindings?: Record<string, unknown>) {
  return baseLogger.getSubLogger({ name, ...bindings });
}
