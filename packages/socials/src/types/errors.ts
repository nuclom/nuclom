import { Data } from 'effect';

/**
 * Base error class for all social provider errors
 */
export class SocialError extends Data.TaggedError('SocialError')<{
  readonly message: string;
  readonly provider: string;
  readonly cause?: unknown;
}> {}

/**
 * Authentication failed or credentials are invalid
 */
export class AuthenticationError extends Data.TaggedError('AuthenticationError')<{
  readonly message: string;
  readonly provider: string;
  readonly cause?: unknown;
}> {}

/**
 * Rate limit exceeded
 */
export class RateLimitError extends Data.TaggedError('RateLimitError')<{
  readonly message: string;
  readonly provider: string;
  readonly retryAfter?: number;
  readonly cause?: unknown;
}> {}

/**
 * Resource not found (post, user, etc.)
 */
export class NotFoundError extends Data.TaggedError('NotFoundError')<{
  readonly message: string;
  readonly provider: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly cause?: unknown;
}> {}

/**
 * Validation error for input data
 */
export class ValidationError extends Data.TaggedError('ValidationError')<{
  readonly message: string;
  readonly provider: string;
  readonly field?: string;
  readonly cause?: unknown;
}> {}

/**
 * Network or API communication error
 */
export class NetworkError extends Data.TaggedError('NetworkError')<{
  readonly message: string;
  readonly provider: string;
  readonly statusCode?: number;
  readonly cause?: unknown;
}> {}

/**
 * Permission denied for the requested operation
 */
export class PermissionError extends Data.TaggedError('PermissionError')<{
  readonly message: string;
  readonly provider: string;
  readonly operation: string;
  readonly cause?: unknown;
}> {}

/**
 * Provider is not initialized
 */
export class NotInitializedError extends Data.TaggedError('NotInitializedError')<{
  readonly message: string;
  readonly provider: string;
}> {}

/**
 * Configuration error
 */
export class ConfigurationError extends Data.TaggedError('ConfigurationError')<{
  readonly message: string;
  readonly provider: string;
  readonly missingFields?: string[];
  readonly cause?: unknown;
}> {}

/**
 * Union type of all social errors
 */
export type AnySocialError =
  | SocialError
  | AuthenticationError
  | RateLimitError
  | NotFoundError
  | ValidationError
  | NetworkError
  | PermissionError
  | NotInitializedError
  | ConfigurationError;
