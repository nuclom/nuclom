/**
 * Retry Utilities using Effect-TS
 *
 * Provides configurable retry strategies with:
 * - Exponential backoff
 * - Jitter to prevent thundering herd
 * - Configurable max attempts and delays
 * - Error filtering (only retry on specific errors)
 */

import { Effect, Schedule, Duration } from "effect";

// =============================================================================
// Types
// =============================================================================

export interface RetryConfig {
  /** Maximum number of retry attempts */
  readonly maxAttempts?: number;
  /** Initial delay between retries */
  readonly initialDelay?: Duration.DurationInput;
  /** Maximum delay between retries */
  readonly maxDelay?: Duration.DurationInput;
  /** Backoff factor (default 2 for exponential) */
  readonly factor?: number;
  /** Whether to add jitter to delays */
  readonly jitter?: boolean;
  /** Total maximum time to spend retrying */
  readonly maxDuration?: Duration.DurationInput;
}

export interface RetryWithFallbackConfig<A, E, R> extends RetryConfig {
  /** Fallback value or effect to use when all retries fail */
  readonly fallback: A | Effect.Effect<A, E, R>;
}

// =============================================================================
// Default Configurations
// =============================================================================

/**
 * Default retry config for API requests
 */
export const apiRetryConfig: RetryConfig = {
  maxAttempts: 3,
  initialDelay: "500 millis",
  maxDelay: "10 seconds",
  factor: 2,
  jitter: true,
};

/**
 * Aggressive retry config for critical operations
 */
export const criticalRetryConfig: RetryConfig = {
  maxAttempts: 5,
  initialDelay: "1 second",
  maxDelay: "30 seconds",
  factor: 2,
  jitter: true,
  maxDuration: "2 minutes",
};

/**
 * Light retry config for fast operations
 */
export const lightRetryConfig: RetryConfig = {
  maxAttempts: 2,
  initialDelay: "200 millis",
  maxDelay: "2 seconds",
  factor: 2,
  jitter: true,
};

/**
 * Network retry config with longer delays
 */
export const networkRetryConfig: RetryConfig = {
  maxAttempts: 4,
  initialDelay: "1 second",
  maxDelay: "60 seconds",
  factor: 2,
  jitter: true,
  maxDuration: "5 minutes",
};

// =============================================================================
// Schedule Builders
// =============================================================================

/**
 * Create a retry schedule from config
 */
export function createRetrySchedule(config: RetryConfig = {}): Schedule.Schedule<number, unknown, never> {
  const {
    maxAttempts = 3,
    initialDelay = "500 millis",
    maxDelay = "30 seconds",
    factor = 2,
    jitter = true,
    maxDuration,
  } = config;

  // Start with exponential backoff
  let schedule = Schedule.exponential(initialDelay, factor).pipe(
    // Cap the delay
    Schedule.either(Schedule.spaced(maxDelay)),
    // Limit attempts
    Schedule.compose(Schedule.recurs(maxAttempts - 1)),
  );

  // Add jitter if enabled
  if (jitter) {
    schedule = schedule.pipe(Schedule.jittered);
  }

  // Add max duration if specified
  if (maxDuration) {
    schedule = schedule.pipe(Schedule.upTo(maxDuration));
  }

  return schedule;
}

/**
 * Create a schedule that only retries on specific errors
 */
export function createFilteredRetrySchedule<E>(
  config: RetryConfig = {},
  shouldRetry: (error: E) => boolean,
): Schedule.Schedule<number, E, never> {
  const baseSchedule = createRetrySchedule(config);
  return baseSchedule.pipe(
    Schedule.whileInput((error: E) => shouldRetry(error)),
  );
}

// =============================================================================
// Retry Effect Functions
// =============================================================================

/**
 * Retry an effect with exponential backoff
 */
export function withRetry<A, E, R>(
  effect: Effect.Effect<A, E, R>,
  config: RetryConfig = apiRetryConfig,
): Effect.Effect<A, E, R> {
  const schedule = createRetrySchedule(config);
  return Effect.retry(effect, schedule);
}

/**
 * Retry an effect with a fallback value on failure
 */
export function withRetryOrDefault<A, E, R>(
  effect: Effect.Effect<A, E, R>,
  defaultValue: A,
  config: RetryConfig = apiRetryConfig,
): Effect.Effect<A, never, R> {
  const schedule = createRetrySchedule(config);
  return Effect.retry(effect, schedule).pipe(Effect.catchAll(() => Effect.succeed(defaultValue)));
}

/**
 * Retry an effect with a fallback effect
 */
export function withRetryOrFallback<A, E, R>(
  effect: Effect.Effect<A, E, R>,
  fallback: Effect.Effect<A, E, R>,
  config: RetryConfig = apiRetryConfig,
): Effect.Effect<A, E, R> {
  const schedule = createRetrySchedule(config);
  return Effect.retry(effect, schedule).pipe(Effect.catchAll(() => fallback));
}

/**
 * Retry only on specific errors
 */
export function withFilteredRetry<A, E, R>(
  effect: Effect.Effect<A, E, R>,
  shouldRetry: (error: E) => boolean,
  config: RetryConfig = apiRetryConfig,
): Effect.Effect<A, E, R> {
  const schedule = createFilteredRetrySchedule<E>(config, shouldRetry);
  return Effect.retry(effect, schedule);
}

/**
 * Retry with timeout
 */
export function withRetryAndTimeout<A, E, R>(
  effect: Effect.Effect<A, E, R>,
  timeout: Duration.DurationInput,
  config: RetryConfig = apiRetryConfig,
): Effect.Effect<A, E | TimeoutError, R> {
  const schedule = createRetrySchedule(config);
  return Effect.retry(effect, schedule).pipe(
    Effect.timeoutFail({
      duration: timeout,
      onTimeout: () => new TimeoutError({ message: "Operation timed out" }),
    }),
  );
}

// =============================================================================
// Error Types
// =============================================================================

import { Data } from "effect";

/**
 * Timeout error when operation exceeds time limit
 */
export class TimeoutError extends Data.TaggedError("TimeoutError")<{
  readonly message: string;
}> {}

/**
 * Retry exhausted error when all attempts fail
 */
export class RetryExhaustedError extends Data.TaggedError("RetryExhaustedError")<{
  readonly message: string;
  readonly attempts: number;
  readonly lastError?: unknown;
}> {}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if an error is retryable (network errors, rate limits, etc.)
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("network") ||
      message.includes("timeout") ||
      message.includes("econnrefused") ||
      message.includes("econnreset") ||
      message.includes("rate limit") ||
      message.includes("429") ||
      message.includes("503") ||
      message.includes("502") ||
      message.includes("504")
    );
  }
  return false;
}

/**
 * Check if an HTTP status is retryable
 */
export function isRetryableStatus(status: number): boolean {
  return (
    status === 408 || // Request Timeout
    status === 429 || // Too Many Requests
    status === 500 || // Internal Server Error
    status === 502 || // Bad Gateway
    status === 503 || // Service Unavailable
    status === 504 // Gateway Timeout
  );
}

// =============================================================================
// Preconfigured Retry Wrappers
// =============================================================================

/**
 * Retry specifically for API requests
 */
export function retryApiRequest<A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> {
  return withRetry(effect, apiRetryConfig);
}

/**
 * Retry specifically for database operations
 */
export function retryDbOperation<A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> {
  return withRetry(effect, {
    maxAttempts: 3,
    initialDelay: "100 millis",
    maxDelay: "5 seconds",
    factor: 2,
    jitter: true,
  });
}

/**
 * Retry specifically for external service calls
 */
export function retryExternalService<A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> {
  return withRetry(effect, networkRetryConfig);
}

/**
 * Retry specifically for file uploads
 */
export function retryUpload<A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> {
  return withRetry(effect, {
    maxAttempts: 3,
    initialDelay: "2 seconds",
    maxDelay: "30 seconds",
    factor: 2,
    jitter: true,
    maxDuration: "5 minutes",
  });
}
