"use client";

/**
 * Client-side Logger Utility
 *
 * A simple logger for client-side React components that:
 * - Only logs in development mode
 * - Provides a consistent interface for error/warning logging
 * - Can be easily disabled in production without code changes
 */

// biome-ignore lint/correctness/noProcessGlobal: Required for client-side development detection
const isDev = typeof process !== "undefined" && process.env?.NODE_ENV === "development";

/**
 * Client-side logger - only outputs in development
 *
 * Usage:
 * ```ts
 * import { clientLogger } from "@/lib/client-logger";
 *
 * // In catch blocks:
 * clientLogger.error("Failed to load data", error);
 *
 * // With context:
 * clientLogger.error("Upload failed", error, { fileId, userId });
 * ```
 */
export const clientLogger = {
  /**
   * Log debug messages (development only)
   */
  debug(message: string, data?: unknown): void {
    if (isDev) {
      console.debug(`[DEBUG] ${message}`, data !== undefined ? data : "");
    }
  },

  /**
   * Log informational messages (development only)
   */
  info(message: string, data?: unknown): void {
    if (isDev) {
      console.info(`[INFO] ${message}`, data !== undefined ? data : "");
    }
  },

  /**
   * Log warning messages (development only)
   */
  warn(message: string, data?: unknown): void {
    if (isDev) {
      console.warn(`[WARN] ${message}`, data !== undefined ? data : "");
    }
  },

  /**
   * Log error messages (development only)
   */
  error(message: string, error?: unknown, context?: Record<string, unknown>): void {
    if (isDev) {
      const errorMessage = error instanceof Error ? error.message : String(error ?? "");
      if (context) {
        console.error(`[ERROR] ${message}`, errorMessage, context);
      } else if (errorMessage) {
        console.error(`[ERROR] ${message}`, errorMessage);
      } else {
        console.error(`[ERROR] ${message}`);
      }
    }
  },
};
