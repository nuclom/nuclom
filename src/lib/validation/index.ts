import { Effect, ParseResult, pipe, Schema } from 'effect';
import { ValidationError } from '@/lib/effect/errors';

/**
 * Validates data against an Effect Schema and returns an Effect
 * that either succeeds with the parsed data or fails with a ValidationError.
 */
export function validate<A, I>(schema: Schema.Schema<A, I>, data: unknown): Effect.Effect<A, ValidationError> {
  return Schema.decodeUnknown(schema)(data).pipe(
    Effect.mapError((error) => {
      const issues = ParseResult.ArrayFormatter.formatErrorSync(error);
      const messages = issues.map((issue) =>
        issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message,
      );
      return new ValidationError({ message: messages.join('; ') });
    }),
  );
}

/**
 * Validates data against an Effect Schema and returns an Effect
 * that succeeds with the parsed data or fails with a ValidationError.
 * Returns undefined instead of failing for missing optional data.
 */
export function validateOptional<A, I>(
  schema: Schema.Schema<A, I>,
  data: unknown,
): Effect.Effect<A | undefined, ValidationError> {
  if (data === undefined || data === null) {
    return Effect.succeed(undefined);
  }
  return validate(schema, data);
}

/**
 * Result type for safeParse - matches Zod-like API for easy migration
 */
export type SafeParseResult<A> =
  | { success: true; data: A }
  | { success: false; error: { issues: Array<{ message: string; path?: string }> } };

/**
 * Safely parses data against an Effect Schema.
 * Returns the parsed data or validation errors if validation fails.
 * Does not throw errors - useful for form handling.
 * Returns a Zod-like result object for compatibility.
 */
export function safeParse<A, I>(schema: Schema.Schema<A, I>, data: unknown): SafeParseResult<A> {
  const result = Schema.decodeUnknownEither(schema)(data);

  if (result._tag === 'Right') {
    return { success: true, data: result.right };
  }

  const formattedIssues = ParseResult.ArrayFormatter.formatErrorSync(result.left);
  const issues = formattedIssues.map((issue) => ({
    message: issue.message,
    path: issue.path.length > 0 ? issue.path.join('.') : undefined,
  }));

  return { success: false, error: { issues } };
}

/**
 * Parses query parameters from a URL into an object.
 * Handles arrays and boolean conversion.
 */
export function parseQueryParams(url: string | URL): Record<string, unknown> {
  const { searchParams } = typeof url === 'string' ? new URL(url) : url;
  const params: Record<string, unknown> = {};

  searchParams.forEach((value, key) => {
    // Handle array parameters (e.g., ?ids=1&ids=2)
    const existing = params[key];
    if (existing !== undefined) {
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        params[key] = [existing, value];
      }
    } else {
      params[key] = value;
    }
  });

  return params;
}

/**
 * Validates query parameters against an Effect Schema.
 */
export function validateQueryParams<A, I>(
  schema: Schema.Schema<A, I>,
  url: string | URL,
): Effect.Effect<A, ValidationError> {
  const params = parseQueryParams(url);
  return validate(schema, params);
}

/**
 * Validates a JSON request body against an Effect Schema.
 */
export function validateRequestBody<A, I>(
  schema: Schema.Schema<A, I>,
  request: Request,
): Effect.Effect<A, ValidationError> {
  return Effect.gen(function* () {
    const body = yield* Effect.tryPromise({
      try: () => request.json(),
      catch: () => new ValidationError({ message: 'Invalid JSON body' }),
    });

    return yield* validate(schema, body);
  });
}

/**
 * Validates form data against an Effect Schema.
 */
export function validateFormData<A, I>(
  schema: Schema.Schema<A, I>,
  formData: FormData,
): Effect.Effect<A, ValidationError> {
  const data: Record<string, unknown> = {};

  formData.forEach((value, key) => {
    if (value instanceof File) {
      // Skip file fields - they should be handled separately
      return;
    }
    data[key] = value;
  });

  return validate(schema, data);
}

// =============================================================================
// Type-Safe Query Validators
// =============================================================================

/**
 * Create a reusable, type-safe query parameter validator.
 * This provides a consistent interface for validating URL query parameters
 * with full TypeScript type inference.
 *
 * @example
 * ```typescript
 * // Define the validator once
 * const getVideosQuery = createQueryValidator(Schema.Struct({
 *   page: Schema.optional(Schema.NumberFromString),
 *   limit: Schema.optional(Schema.NumberFromString),
 *   organizationId: Schema.String,
 * }));
 *
 * // Use in API route
 * export async function GET(request: NextRequest) {
 *   const params = yield* getVideosQuery.validate(request.url);
 *   // params is typed as { page?: number; limit?: number; organizationId: string }
 * }
 *
 * // Or use safeParse for form handling
 * const result = getVideosQuery.safeParse(url);
 * if (result.success) {
 *   // result.data is typed
 * }
 * ```
 */
export function createQueryValidator<A, I>(schema: Schema.Schema<A, I>) {
  return {
    /** Validate query parameters, returning an Effect that fails with ValidationError */
    validate: (url: string | URL): Effect.Effect<A, ValidationError> => validateQueryParams(schema, url),

    /** Validate query parameters with a Zod-like result object */
    safeParse: (url: string | URL): SafeParseResult<A> => safeParse(schema, parseQueryParams(url)),

    /** Get the underlying schema for composition */
    schema,
  };
}

/**
 * Create a reusable, type-safe request body validator.
 * This provides a consistent interface for validating JSON request bodies
 * with full TypeScript type inference.
 *
 * @example
 * ```typescript
 * // Define the validator once
 * const createVideoBody = createBodyValidator(Schema.Struct({
 *   title: Schema.String,
 *   description: Schema.optional(Schema.String),
 *   organizationId: Schema.String,
 * }));
 *
 * // Use in API route
 * export async function POST(request: NextRequest) {
 *   const body = yield* createVideoBody.validate(request);
 *   // body is typed as { title: string; description?: string; organizationId: string }
 * }
 * ```
 */
export function createBodyValidator<A, I>(schema: Schema.Schema<A, I>) {
  return {
    /** Validate request body, returning an Effect that fails with ValidationError */
    validate: (request: Request): Effect.Effect<A, ValidationError> => validateRequestBody(schema, request),

    /** Validate raw data with a Zod-like result object */
    safeParse: (data: unknown): SafeParseResult<A> => safeParse(schema, data),

    /** Get the underlying schema for composition */
    schema,
  };
}

/**
 * Combine multiple validators into a single validator that validates all schemas.
 * Useful when you need to validate both query params and body together.
 *
 * @example
 * ```typescript
 * const updateVideoParams = createQueryValidator(Schema.Struct({ id: Schema.String }));
 * const updateVideoBody = createBodyValidator(Schema.Struct({ title: Schema.String }));
 *
 * // In route handler:
 * const params = yield* updateVideoParams.validate(request.url);
 * const body = yield* updateVideoBody.validate(request);
 * // Both are fully typed
 * ```
 */
export function combineValidators<A, B, I1, I2>(
  queryValidator: ReturnType<typeof createQueryValidator<A, I1>>,
  bodyValidator: ReturnType<typeof createBodyValidator<B, I2>>,
) {
  return {
    /** Validate both query params and body */
    validate: (request: Request): Effect.Effect<{ query: A; body: B }, ValidationError> =>
      Effect.gen(function* () {
        const query = yield* queryValidator.validate(request.url);
        const body = yield* bodyValidator.validate(request);
        return { query, body };
      }),
  };
}

// =============================================================================
// Common Query Parameter Schemas
// =============================================================================

/**
 * Common pagination query parameters.
 * Use these in your query validators for consistency.
 */
export const PaginationParams = Schema.Struct({
  page: Schema.optional(
    pipe(
      Schema.String,
      Schema.transform(Schema.Number, {
        decode: (s) => parseInt(s, 10),
        encode: (n) => String(n),
      }),
    ),
  ),
  limit: Schema.optional(
    pipe(
      Schema.String,
      Schema.transform(Schema.Number, {
        decode: (s) => parseInt(s, 10),
        encode: (n) => String(n),
      }),
    ),
  ),
});

/**
 * Type for pagination query parameters.
 */
export type PaginationParams = Schema.Schema.Type<typeof PaginationParams>;

/**
 * Common ID parameter.
 */
export const IdParam = Schema.Struct({
  id: Schema.String,
});

/**
 * Organization ID parameter (commonly used in multi-tenant APIs).
 */
export const OrganizationIdParam = Schema.Struct({
  organizationId: Schema.String,
});

// Re-export file validation
export * from './file-validation';
// Re-export sanitization
export * from './sanitize';
// Re-export schemas
export * from './schemas';

// Note: Form utilities (useValidatedForm, etc.) are in ./form.ts
// Import them directly for client-side usage:
// import { useValidatedForm } from "@/lib/validation/form";
