/**
 * Custom Error Types for Effect-TS
 *
 * Using Data.TaggedError for type-safe error tracking in Effect's type system.
 * Each error has a _tag field that serves as a discriminant for error matching.
 */

import { Data } from 'effect';

// =============================================================================
// Base Application Errors
// =============================================================================

/**
 * Generic application error for unexpected failures
 */
export class AppError extends Data.TaggedError('AppError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * Configuration error for missing or invalid environment variables
 */
export class ConfigurationError extends Data.TaggedError('ConfigurationError')<{
  readonly message: string;
  readonly key?: string;
}> {}

// =============================================================================
// Authentication & Authorization Errors
// =============================================================================

/**
 * Error when user is not authenticated
 */
export class UnauthorizedError extends Data.TaggedError('UnauthorizedError')<{
  readonly message: string;
}> {
  static readonly default = new UnauthorizedError({ message: 'Unauthorized' });
}

/**
 * Error when user doesn't have permission to access a resource
 */
export class ForbiddenError extends Data.TaggedError('ForbiddenError')<{
  readonly message: string;
  readonly resource?: string;
}> {}

/**
 * Error when session is invalid or expired
 */
export class SessionError extends Data.TaggedError('SessionError')<{
  readonly message: string;
}> {}

// =============================================================================
// Validation Errors
// =============================================================================

/**
 * Error for invalid input data
 */
export class ValidationError extends Data.TaggedError('ValidationError')<{
  readonly message: string;
  readonly field?: string;
  readonly errors?: ReadonlyArray<{ field: string; message: string }>;
}> {}

/**
 * Error when a required field is missing
 */
export class MissingFieldError extends Data.TaggedError('MissingFieldError')<{
  readonly field: string;
  readonly message: string;
}> {}

// =============================================================================
// Database Errors
// =============================================================================

/**
 * Error when a database query fails
 */
export class DatabaseError extends Data.TaggedError('DatabaseError')<{
  readonly message: string;
  readonly operation?: string;
  readonly cause?: unknown;
}> {}

/**
 * Error when a requested entity is not found
 */
export class NotFoundError extends Data.TaggedError('NotFoundError')<{
  readonly message: string;
  readonly entity: string;
  readonly id?: string;
}> {}

/**
 * Error when trying to create a duplicate entity
 */
export class DuplicateError extends Data.TaggedError('DuplicateError')<{
  readonly message: string;
  readonly entity: string;
  readonly field?: string;
}> {}

/**
 * Error when a database transaction fails
 */
export class TransactionError extends Data.TaggedError('TransactionError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

// =============================================================================
// Storage Errors
// =============================================================================

/**
 * Error when storage service is not configured
 */
export class StorageNotConfiguredError extends Data.TaggedError('StorageNotConfiguredError')<{
  readonly message: string;
}> {
  static readonly default = new StorageNotConfiguredError({
    message: 'R2 storage not configured. Please set up R2 credentials.',
  });
}

/**
 * Error when file upload fails
 */
export class UploadError extends Data.TaggedError('UploadError')<{
  readonly message: string;
  readonly filename?: string;
  readonly cause?: unknown;
}> {}

/**
 * Error when file deletion fails
 */
export class DeleteError extends Data.TaggedError('DeleteError')<{
  readonly message: string;
  readonly key?: string;
  readonly cause?: unknown;
}> {}

/**
 * Error when generating presigned URL fails
 */
export class PresignedUrlError extends Data.TaggedError('PresignedUrlError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

// =============================================================================
// Video Processing Errors
// =============================================================================

/**
 * Error when video format is not supported
 */
export class UnsupportedFormatError extends Data.TaggedError('UnsupportedFormatError')<{
  readonly message: string;
  readonly format?: string;
  readonly supportedFormats: ReadonlyArray<string>;
}> {}

/**
 * Error when file size exceeds limit
 */
export class FileSizeExceededError extends Data.TaggedError('FileSizeExceededError')<{
  readonly message: string;
  readonly fileSize: number;
  readonly maxSize: number;
}> {}

/**
 * Error when video processing fails
 */
export class VideoProcessingError extends Data.TaggedError('VideoProcessingError')<{
  readonly message: string;
  readonly stage?: 'uploading' | 'processing' | 'generating_thumbnail' | 'complete';
  readonly cause?: unknown;
}> {}

/**
 * Error when AI video processing fails
 */
export class VideoAIProcessingError extends Data.TaggedError('VideoAIProcessingError')<{
  readonly message: string;
  readonly stage?: 'pending' | 'transcribing' | 'diarizing' | 'analyzing' | 'completed' | 'failed';
  readonly videoId?: string;
  readonly cause?: unknown;
}> {}

/**
 * Error when transcription fails
 */
export class TranscriptionError extends Data.TaggedError('TranscriptionError')<{
  readonly message: string;
  readonly operation?: string;
  readonly cause?: unknown;
}> {}

/**
 * Error when audio extraction fails
 */
export class AudioExtractionError extends Data.TaggedError('AudioExtractionError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

// =============================================================================
// AI Service Errors
// =============================================================================

/**
 * Error when AI service fails
 */
export class AIServiceError extends Data.TaggedError('AIServiceError')<{
  readonly message: string;
  readonly operation?: string;
  readonly cause?: unknown;
}> {}

// =============================================================================
// HTTP/API Errors
// =============================================================================

/**
 * Error for HTTP request failures
 */
export class HttpError extends Data.TaggedError('HttpError')<{
  readonly message: string;
  readonly status: number;
  readonly body?: unknown;
}> {}

/**
 * Error for API response parsing failures
 */
export class ParseError extends Data.TaggedError('ParseError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

// =============================================================================
// Error Union Types for Service Layers
// =============================================================================

/**
 * All possible storage errors
 */
export type StorageError = StorageNotConfiguredError | UploadError | DeleteError | PresignedUrlError;

/**
 * All possible database errors
 */
export type DbError = DatabaseError | NotFoundError | DuplicateError | TransactionError;

/**
 * All possible video processing errors
 */
export type VideoError =
  | UnsupportedFormatError
  | FileSizeExceededError
  | VideoProcessingError
  | VideoAIProcessingError
  | TranscriptionError
  | AudioExtractionError;

/**
 * All possible authentication errors
 */
export type AuthError = UnauthorizedError | ForbiddenError | SessionError;

/**
 * All possible validation errors
 */
export type InputError = ValidationError | MissingFieldError;

// =============================================================================
// Billing Errors
// =============================================================================

/**
 * Error when Stripe service is not configured
 */
export class StripeNotConfiguredError extends Data.TaggedError('StripeNotConfiguredError')<{
  readonly message: string;
}> {
  static readonly default = new StripeNotConfiguredError({
    message: 'Stripe is not configured. Please set up Stripe credentials.',
  });
}

/**
 * Error when a Stripe API call fails
 */
export class StripeApiError extends Data.TaggedError('StripeApiError')<{
  readonly message: string;
  readonly code?: string;
  readonly cause?: unknown;
}> {}

/**
 * Error when webhook signature verification fails
 */
export class WebhookSignatureError extends Data.TaggedError('WebhookSignatureError')<{
  readonly message: string;
}> {}

/**
 * Error when subscription operation fails
 */
export class SubscriptionError extends Data.TaggedError('SubscriptionError')<{
  readonly message: string;
  readonly subscriptionId?: string;
  readonly cause?: unknown;
}> {}

/**
 * Error when plan limit is exceeded
 */
export class PlanLimitExceededError extends Data.TaggedError('PlanLimitExceededError')<{
  readonly message: string;
  readonly resource: 'storage' | 'videos' | 'members' | 'bandwidth' | 'ai_requests';
  readonly currentUsage: number;
  readonly limit: number;
}> {}

/**
 * Error when payment fails
 */
export class PaymentFailedError extends Data.TaggedError('PaymentFailedError')<{
  readonly message: string;
  readonly invoiceId?: string;
  readonly cause?: unknown;
}> {}

/**
 * Error when plan is not found
 */
export class PlanNotFoundError extends Data.TaggedError('PlanNotFoundError')<{
  readonly message: string;
  readonly planId: string;
}> {}

/**
 * Error when organization has no subscription
 */
export class NoSubscriptionError extends Data.TaggedError('NoSubscriptionError')<{
  readonly message: string;
  readonly organizationId: string;
}> {}

/**
 * Error when usage tracking fails
 */
export class UsageTrackingError extends Data.TaggedError('UsageTrackingError')<{
  readonly message: string;
  readonly organizationId: string;
  readonly cause?: unknown;
}> {}

/**
 * All possible billing errors
 */
export type BillingError =
  | StripeNotConfiguredError
  | StripeApiError
  | WebhookSignatureError
  | SubscriptionError
  | PlanLimitExceededError
  | PaymentFailedError
  | PlanNotFoundError
  | NoSubscriptionError
  | UsageTrackingError;

// =============================================================================
// Complete Application Error Union (for exhaustive type checking)
// =============================================================================

/**
 * Union of all application errors for exhaustive error handling.
 * Use this type to ensure all error cases are handled.
 *
 * @example
 * ```typescript
 * // Exhaustive pattern matching
 * const handleError = (error: AppErrorUnion): Response => {
 *   switch (error._tag) {
 *     case "UnauthorizedError": return Response.json({}, { status: 401 });
 *     case "NotFoundError": return Response.json({}, { status: 404 });
 *     // ... TypeScript will error if any case is missing
 *   }
 * }
 * ```
 */
export type AppErrorUnion =
  // Base errors
  | AppError
  | ConfigurationError
  // Auth errors
  | UnauthorizedError
  | ForbiddenError
  | SessionError
  // Validation errors
  | ValidationError
  | MissingFieldError
  // Database errors
  | DatabaseError
  | NotFoundError
  | DuplicateError
  | TransactionError
  // Storage errors
  | StorageNotConfiguredError
  | UploadError
  | DeleteError
  | PresignedUrlError
  // Video errors
  | UnsupportedFormatError
  | FileSizeExceededError
  | VideoProcessingError
  | VideoAIProcessingError
  | TranscriptionError
  | AudioExtractionError
  // AI errors
  | AIServiceError
  // HTTP errors
  | HttpError
  | ParseError
  // Billing errors
  | StripeNotConfiguredError
  | StripeApiError
  | WebhookSignatureError
  | SubscriptionError
  | PlanLimitExceededError
  | PaymentFailedError
  | PlanNotFoundError
  | NoSubscriptionError
  | UsageTrackingError;

/**
 * All possible error tags for discriminated union matching.
 * This type extracts the _tag literal from each error type.
 */
export type AppErrorTag = AppErrorUnion['_tag'];

/**
 * Type-safe error tag mapping helper.
 * Use this to create exhaustive error handlers.
 */
export type ErrorTagMapping<T> = {
  [K in AppErrorTag]: T;
};

/**
 * Extract specific error type by tag.
 * Useful for type-safe error handling in catchTag.
 *
 * @example
 * ```typescript
 * type NotFound = ExtractErrorByTag<"NotFoundError">;
 * // NotFound is now NotFoundError type
 * ```
 */
export type ExtractErrorByTag<Tag extends AppErrorTag> = Extract<AppErrorUnion, { _tag: Tag }>;

/**
 * Type guard to check if an unknown value is an AppErrorUnion.
 */
export function isAppError(value: unknown): value is AppErrorUnion {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_tag' in value &&
    typeof (value as { _tag: unknown })._tag === 'string' &&
    'message' in value &&
    typeof (value as { message: unknown }).message === 'string'
  );
}

/**
 * Assert exhaustive handling of all error tags.
 * Use this in default case of switch statements to ensure all cases are covered.
 *
 * @example
 * ```typescript
 * switch (error._tag) {
 *   case "UnauthorizedError": // ...
 *   case "NotFoundError": // ...
 *   default:
 *     assertExhaustive(error); // TypeScript error if cases are missing
 * }
 * ```
 */
export function assertExhaustive(value: never): never {
  throw new Error(`Unhandled error type: ${(value as { _tag: string })._tag}`);
}
