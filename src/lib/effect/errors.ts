/**
 * Custom Error Types for Effect-TS
 *
 * Using Data.TaggedError for type-safe error tracking in Effect's type system.
 * Each error has a _tag field that serves as a discriminant for error matching.
 */

import { Data } from "effect";

// =============================================================================
// Base Application Errors
// =============================================================================

/**
 * Generic application error for unexpected failures
 */
export class AppError extends Data.TaggedError("AppError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * Configuration error for missing or invalid environment variables
 */
export class ConfigurationError extends Data.TaggedError("ConfigurationError")<{
  readonly message: string;
  readonly key?: string;
}> {}

// =============================================================================
// Authentication & Authorization Errors
// =============================================================================

/**
 * Error when user is not authenticated
 */
export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<{
  readonly message: string;
}> {
  static readonly default = new UnauthorizedError({ message: "Unauthorized" });
}

/**
 * Error when user doesn't have permission to access a resource
 */
export class ForbiddenError extends Data.TaggedError("ForbiddenError")<{
  readonly message: string;
  readonly resource?: string;
}> {}

/**
 * Error when session is invalid or expired
 */
export class SessionError extends Data.TaggedError("SessionError")<{
  readonly message: string;
}> {}

// =============================================================================
// Validation Errors
// =============================================================================

/**
 * Error for invalid input data
 */
export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly message: string;
  readonly field?: string;
  readonly errors?: ReadonlyArray<{ field: string; message: string }>;
}> {}

/**
 * Error when a required field is missing
 */
export class MissingFieldError extends Data.TaggedError("MissingFieldError")<{
  readonly field: string;
  readonly message: string;
}> {}

// =============================================================================
// Database Errors
// =============================================================================

/**
 * Error when a database query fails
 */
export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly message: string;
  readonly operation?: string;
  readonly cause?: unknown;
}> {}

/**
 * Error when a requested entity is not found
 */
export class NotFoundError extends Data.TaggedError("NotFoundError")<{
  readonly message: string;
  readonly entity: string;
  readonly id?: string;
}> {}

/**
 * Error when trying to create a duplicate entity
 */
export class DuplicateError extends Data.TaggedError("DuplicateError")<{
  readonly message: string;
  readonly entity: string;
  readonly field?: string;
}> {}

/**
 * Error when a database transaction fails
 */
export class TransactionError extends Data.TaggedError("TransactionError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

// =============================================================================
// Storage Errors
// =============================================================================

/**
 * Error when storage service is not configured
 */
export class StorageNotConfiguredError extends Data.TaggedError("StorageNotConfiguredError")<{
  readonly message: string;
}> {
  static readonly default = new StorageNotConfiguredError({
    message: "R2 storage not configured. Please set up R2 credentials.",
  });
}

/**
 * Error when file upload fails
 */
export class UploadError extends Data.TaggedError("UploadError")<{
  readonly message: string;
  readonly filename?: string;
  readonly cause?: unknown;
}> {}

/**
 * Error when file deletion fails
 */
export class DeleteError extends Data.TaggedError("DeleteError")<{
  readonly message: string;
  readonly key?: string;
  readonly cause?: unknown;
}> {}

/**
 * Error when generating presigned URL fails
 */
export class PresignedUrlError extends Data.TaggedError("PresignedUrlError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

// =============================================================================
// Video Processing Errors
// =============================================================================

/**
 * Error when video format is not supported
 */
export class UnsupportedFormatError extends Data.TaggedError("UnsupportedFormatError")<{
  readonly message: string;
  readonly format?: string;
  readonly supportedFormats: ReadonlyArray<string>;
}> {}

/**
 * Error when file size exceeds limit
 */
export class FileSizeExceededError extends Data.TaggedError("FileSizeExceededError")<{
  readonly message: string;
  readonly fileSize: number;
  readonly maxSize: number;
}> {}

/**
 * Error when video processing fails
 */
export class VideoProcessingError extends Data.TaggedError("VideoProcessingError")<{
  readonly message: string;
  readonly stage?: "uploading" | "processing" | "generating_thumbnail" | "complete";
  readonly cause?: unknown;
}> {}

// =============================================================================
// AI Service Errors
// =============================================================================

/**
 * Error when AI service fails
 */
export class AIServiceError extends Data.TaggedError("AIServiceError")<{
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
export class HttpError extends Data.TaggedError("HttpError")<{
  readonly message: string;
  readonly status: number;
  readonly body?: unknown;
}> {}

/**
 * Error for API response parsing failures
 */
export class ParseError extends Data.TaggedError("ParseError")<{
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
export type VideoError = UnsupportedFormatError | FileSizeExceededError | VideoProcessingError;

/**
 * All possible authentication errors
 */
export type AuthError = UnauthorizedError | ForbiddenError | SessionError;

/**
 * All possible validation errors
 */
export type InputError = ValidationError | MissingFieldError;
