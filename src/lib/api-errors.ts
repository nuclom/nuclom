import { NextResponse } from 'next/server';
import { type AppErrorTag, type AppErrorUnion, isAppError } from '@/lib/effect/errors';
import { notifySlackMonitoring } from '@/lib/effect/services/slack-monitoring';
import { env } from '@/lib/env/server';
import { logger } from '@/lib/logger';

/**
 * Standardized API Error Codes
 *
 * Error codes follow the format: CATEGORY_SPECIFIC_ERROR
 * Categories:
 * - AUTH: Authentication & authorization errors
 * - VALIDATION: Input validation errors
 * - NOT_FOUND: Resource not found errors
 * - CONFLICT: Duplicate/conflict errors
 * - STORAGE: File storage errors
 * - VIDEO: Video processing errors
 * - BILLING: Payment & subscription errors
 * - INTERNAL: Internal server errors
 */
export const ErrorCodes = {
  // Authentication & Authorization (401, 403)
  AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
  AUTH_FORBIDDEN: 'AUTH_FORBIDDEN',
  AUTH_SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
  AUTH_SESSION_INVALID: 'AUTH_SESSION_INVALID',

  // Validation (400)
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  VALIDATION_MISSING_FIELD: 'VALIDATION_MISSING_FIELD',
  VALIDATION_INVALID_FORMAT: 'VALIDATION_INVALID_FORMAT',

  // Not Found (404)
  NOT_FOUND_RESOURCE: 'NOT_FOUND_RESOURCE',
  NOT_FOUND_VIDEO: 'NOT_FOUND_VIDEO',
  NOT_FOUND_USER: 'NOT_FOUND_USER',
  NOT_FOUND_ORGANIZATION: 'NOT_FOUND_ORGANIZATION',
  NOT_FOUND_SERIES: 'NOT_FOUND_SERIES',
  NOT_FOUND_PLAN: 'NOT_FOUND_PLAN',

  // Conflict (409)
  CONFLICT_DUPLICATE: 'CONFLICT_DUPLICATE',
  CONFLICT_ALREADY_EXISTS: 'CONFLICT_ALREADY_EXISTS',

  // Storage (500, 503)
  STORAGE_NOT_CONFIGURED: 'STORAGE_NOT_CONFIGURED',
  STORAGE_UPLOAD_FAILED: 'STORAGE_UPLOAD_FAILED',
  STORAGE_DELETE_FAILED: 'STORAGE_DELETE_FAILED',
  STORAGE_URL_GENERATION_FAILED: 'STORAGE_URL_GENERATION_FAILED',

  // Video Processing (400, 500)
  VIDEO_UNSUPPORTED_FORMAT: 'VIDEO_UNSUPPORTED_FORMAT',
  VIDEO_FILE_TOO_LARGE: 'VIDEO_FILE_TOO_LARGE',
  VIDEO_PROCESSING_FAILED: 'VIDEO_PROCESSING_FAILED',

  // Billing (400, 402, 403)
  BILLING_NOT_CONFIGURED: 'BILLING_NOT_CONFIGURED',
  BILLING_PAYMENT_FAILED: 'BILLING_PAYMENT_FAILED',
  BILLING_PLAN_LIMIT_EXCEEDED: 'BILLING_PLAN_LIMIT_EXCEEDED',
  BILLING_NO_SUBSCRIPTION: 'BILLING_NO_SUBSCRIPTION',
  BILLING_WEBHOOK_INVALID: 'BILLING_WEBHOOK_INVALID',
  BILLING_STRIPE_ERROR: 'BILLING_STRIPE_ERROR',

  // Database (500)
  DATABASE_ERROR: 'DATABASE_ERROR',
  DATABASE_TRANSACTION_FAILED: 'DATABASE_TRANSACTION_FAILED',

  // Internal (500)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  INTERNAL_CONFIGURATION_ERROR: 'INTERNAL_CONFIGURATION_ERROR',
  INTERNAL_AI_SERVICE_ERROR: 'INTERNAL_AI_SERVICE_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Standardized API Error Response
 */
export interface ApiErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  status: number,
  details?: Record<string, unknown>,
): NextResponse<ApiErrorResponse> {
  const response: ApiErrorResponse = {
    error: {
      code,
      message,
      ...(details && { details }),
    },
  };

  return NextResponse.json(response, { status });
}

/**
 * Map error tag to error code and HTTP status
 */
interface ErrorMapping {
  code: ErrorCode;
  status: number;
}

/**
 * Type-safe error tag mapping using AppErrorTag.
 * TypeScript will error if any error tag is missing from this mapping.
 *
 * This ensures all errors defined in errors.ts are properly mapped to HTTP responses.
 */
const errorTagMapping: Record<AppErrorTag, ErrorMapping> = {
  // Base errors
  AppError: { code: ErrorCodes.INTERNAL_ERROR, status: 500 },
  ConfigurationError: { code: ErrorCodes.INTERNAL_CONFIGURATION_ERROR, status: 500 },

  // Auth errors
  UnauthorizedError: { code: ErrorCodes.AUTH_UNAUTHORIZED, status: 401 },
  ForbiddenError: { code: ErrorCodes.AUTH_FORBIDDEN, status: 403 },
  SessionError: { code: ErrorCodes.AUTH_SESSION_INVALID, status: 401 },

  // Validation errors
  ValidationError: { code: ErrorCodes.VALIDATION_FAILED, status: 400 },
  MissingFieldError: { code: ErrorCodes.VALIDATION_MISSING_FIELD, status: 400 },

  // Database errors
  DatabaseError: { code: ErrorCodes.DATABASE_ERROR, status: 500 },
  NotFoundError: { code: ErrorCodes.NOT_FOUND_RESOURCE, status: 404 },
  DuplicateError: { code: ErrorCodes.CONFLICT_DUPLICATE, status: 409 },
  TransactionError: { code: ErrorCodes.DATABASE_TRANSACTION_FAILED, status: 500 },

  // Storage errors
  StorageNotConfiguredError: { code: ErrorCodes.STORAGE_NOT_CONFIGURED, status: 503 },
  UploadError: { code: ErrorCodes.STORAGE_UPLOAD_FAILED, status: 500 },
  DeleteError: { code: ErrorCodes.STORAGE_DELETE_FAILED, status: 500 },
  PresignedUrlError: { code: ErrorCodes.STORAGE_URL_GENERATION_FAILED, status: 500 },

  // Video errors
  UnsupportedFormatError: { code: ErrorCodes.VIDEO_UNSUPPORTED_FORMAT, status: 400 },
  FileSizeExceededError: { code: ErrorCodes.VIDEO_FILE_TOO_LARGE, status: 400 },
  VideoProcessingError: { code: ErrorCodes.VIDEO_PROCESSING_FAILED, status: 500 },

  // AI errors
  AIServiceError: { code: ErrorCodes.INTERNAL_AI_SERVICE_ERROR, status: 500 },

  // HTTP errors
  HttpError: { code: ErrorCodes.INTERNAL_ERROR, status: 500 },
  ParseError: { code: ErrorCodes.INTERNAL_ERROR, status: 500 },

  // Billing errors
  StripeNotConfiguredError: { code: ErrorCodes.BILLING_NOT_CONFIGURED, status: 503 },
  StripeApiError: { code: ErrorCodes.BILLING_STRIPE_ERROR, status: 500 },
  WebhookSignatureError: { code: ErrorCodes.BILLING_WEBHOOK_INVALID, status: 400 },
  SubscriptionError: { code: ErrorCodes.BILLING_STRIPE_ERROR, status: 500 },
  PlanLimitExceededError: { code: ErrorCodes.BILLING_PLAN_LIMIT_EXCEEDED, status: 403 },
  PaymentFailedError: { code: ErrorCodes.BILLING_PAYMENT_FAILED, status: 402 },
  PlanNotFoundError: { code: ErrorCodes.NOT_FOUND_PLAN, status: 404 },
  NoSubscriptionError: { code: ErrorCodes.BILLING_NO_SUBSCRIPTION, status: 403 },
  UsageTrackingError: { code: ErrorCodes.BILLING_STRIPE_ERROR, status: 500 },
};

/**
 * Extract additional details from specific error types.
 * Uses type narrowing for type-safe property access.
 */
function extractErrorDetails(error: AppErrorUnion): Record<string, unknown> | undefined {
  switch (error._tag) {
    case 'ValidationError':
      return error.errors ? { fields: error.errors } : error.field ? { field: error.field } : undefined;
    case 'MissingFieldError':
      return { field: error.field };
    case 'NotFoundError':
      return { entity: error.entity, id: error.id };
    case 'DuplicateError':
      return { entity: error.entity, field: error.field };
    case 'PlanLimitExceededError':
      return {
        resource: error.resource,
        currentUsage: error.currentUsage,
        limit: error.limit,
      };
    case 'FileSizeExceededError':
      return { fileSize: error.fileSize, maxSize: error.maxSize };
    case 'UnsupportedFormatError':
      return { format: error.format, supportedFormats: error.supportedFormats };
    case 'VideoProcessingError':
      return error.stage ? { stage: error.stage } : undefined;
    case 'ForbiddenError':
      return error.resource ? { resource: error.resource } : undefined;
    default:
      return undefined;
  }
}

/**
 * Type guard to check if a value is a non-null object/record
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Type guard to check if a value is a tagged error with _tag and message
 */
export function isTaggedError(error: unknown): error is { _tag: string; message: string; status?: number } {
  return (
    isRecord(error) &&
    typeof error._tag === 'string' &&
    typeof error.message === 'string' &&
    (error.status === undefined || typeof error.status === 'number')
  );
}

/**
 * Type-safe mapping of AppErrorUnion to API response.
 * This function is the preferred way to handle known application errors.
 */
export function mapAppErrorToResponse(error: AppErrorUnion): NextResponse<ApiErrorResponse> {
  const mapping = errorTagMapping[error._tag];
  const details = extractErrorDetails(error);

  // Log non-client errors server-side and send to Slack
  if (mapping.status >= 500) {
    logger.error(`API Error: ${error._tag}`, new Error(error.message), {
      errorTag: error._tag,
    });
    // Send Slack notification for server errors (fire-and-forget)
    notifySlackMonitoring('api_error', {
      errorMessage: error.message,
      errorCode: error._tag,
    }).catch(() => {});
  }

  return createErrorResponse(mapping.code, error.message, mapping.status, details);
}

/**
 * Map any Effect-TS TaggedError to a standardized API response.
 * This handles both typed AppErrorUnion and unknown errors.
 *
 * For type-safe error handling, prefer using mapAppErrorToResponse with typed errors.
 */
export function mapErrorToApiResponse(error: unknown): NextResponse<ApiErrorResponse> {
  // Handle typed AppErrorUnion from Effect-TS
  if (isAppError(error)) {
    return mapAppErrorToResponse(error);
  }

  // Handle unknown tagged errors (errors from libraries or legacy code)
  if (isRecord(error) && typeof error._tag === 'string' && typeof error.message === 'string') {
    logger.error(`Unknown tagged error: ${error._tag}`, new Error(error.message as string), {
      errorTag: error._tag,
    });
    notifySlackMonitoring('api_error', {
      errorMessage: error.message as string,
      errorCode: `Unknown: ${error._tag}`,
    }).catch(() => {});
    return createErrorResponse(ErrorCodes.INTERNAL_ERROR, 'An unexpected error occurred', 500);
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    logger.error('API Error', error);
    notifySlackMonitoring('api_error', {
      errorMessage: error.message,
      errorCode: error.name,
    }).catch(() => {});
    return createErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred',
      500,
    );
  }

  // Handle unknown error types
  logger.error('Unknown API error', new Error(String(error)));
  notifySlackMonitoring('api_error', {
    errorMessage: String(error),
    errorCode: 'Unknown',
  }).catch(() => {});
  return createErrorResponse(ErrorCodes.INTERNAL_ERROR, 'An unexpected error occurred', 500);
}

/**
 * Helper to check if a response is an error response
 */
export function isApiError(response: unknown): response is ApiErrorResponse {
  if (!isRecord(response)) {
    return false;
  }

  const errorValue = response.error;
  if (!isRecord(errorValue)) {
    return false;
  }

  return typeof errorValue.code === 'string' && typeof errorValue.message === 'string';
}

/**
 * Client-side helper to get user-friendly error messages
 */
export const errorMessages: Record<ErrorCode, string> = {
  // Auth
  [ErrorCodes.AUTH_UNAUTHORIZED]: 'Please sign in to continue.',
  [ErrorCodes.AUTH_FORBIDDEN]: "You don't have permission to access this resource.",
  [ErrorCodes.AUTH_SESSION_EXPIRED]: 'Your session has expired. Please sign in again.',
  [ErrorCodes.AUTH_SESSION_INVALID]: 'Your session is invalid. Please sign in again.',

  // Validation
  [ErrorCodes.VALIDATION_FAILED]: 'Please check your input and try again.',
  [ErrorCodes.VALIDATION_MISSING_FIELD]: 'Please fill in all required fields.',
  [ErrorCodes.VALIDATION_INVALID_FORMAT]: 'The format of your input is invalid.',

  // Not found
  [ErrorCodes.NOT_FOUND_RESOURCE]: 'The requested resource was not found.',
  [ErrorCodes.NOT_FOUND_VIDEO]: 'The video was not found.',
  [ErrorCodes.NOT_FOUND_USER]: 'The user was not found.',
  [ErrorCodes.NOT_FOUND_ORGANIZATION]: 'The organization was not found.',
  [ErrorCodes.NOT_FOUND_SERIES]: 'The series was not found.',
  [ErrorCodes.NOT_FOUND_PLAN]: 'The plan was not found.',

  // Conflict
  [ErrorCodes.CONFLICT_DUPLICATE]: 'This item already exists.',
  [ErrorCodes.CONFLICT_ALREADY_EXISTS]: 'A resource with this name already exists.',

  // Storage
  [ErrorCodes.STORAGE_NOT_CONFIGURED]: 'File storage is not available. Please try again later.',
  [ErrorCodes.STORAGE_UPLOAD_FAILED]: 'Failed to upload the file. Please try again.',
  [ErrorCodes.STORAGE_DELETE_FAILED]: 'Failed to delete the file. Please try again.',
  [ErrorCodes.STORAGE_URL_GENERATION_FAILED]: 'Failed to generate file URL. Please try again.',

  // Video
  [ErrorCodes.VIDEO_UNSUPPORTED_FORMAT]: 'This video format is not supported.',
  [ErrorCodes.VIDEO_FILE_TOO_LARGE]: 'The video file is too large.',
  [ErrorCodes.VIDEO_PROCESSING_FAILED]: 'Video processing failed. Please try again.',

  // Billing
  [ErrorCodes.BILLING_NOT_CONFIGURED]: 'Billing is not available. Please try again later.',
  [ErrorCodes.BILLING_PAYMENT_FAILED]: 'Payment failed. Please check your payment method.',
  [ErrorCodes.BILLING_PLAN_LIMIT_EXCEEDED]: "You've reached your plan's limit. Please upgrade to continue.",
  [ErrorCodes.BILLING_NO_SUBSCRIPTION]: 'No active subscription found.',
  [ErrorCodes.BILLING_WEBHOOK_INVALID]: 'Invalid payment notification.',
  [ErrorCodes.BILLING_STRIPE_ERROR]: 'A billing error occurred. Please try again.',

  // Database
  [ErrorCodes.DATABASE_ERROR]: 'A database error occurred. Please try again.',
  [ErrorCodes.DATABASE_TRANSACTION_FAILED]: 'The operation failed. Please try again.',

  // Internal
  [ErrorCodes.INTERNAL_ERROR]: 'An unexpected error occurred. Please try again.',
  [ErrorCodes.INTERNAL_CONFIGURATION_ERROR]: 'Service configuration error. Please try again later.',
  [ErrorCodes.INTERNAL_AI_SERVICE_ERROR]: 'AI service is unavailable. Please try again.',
};

/**
 * Get a user-friendly error message from an error code
 */
export function getErrorMessage(code: ErrorCode): string {
  return errorMessages[code] || errorMessages[ErrorCodes.INTERNAL_ERROR];
}
