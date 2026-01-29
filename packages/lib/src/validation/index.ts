import { Effect, ParseResult, pipe, Schema } from 'effect';
import { ValidationError } from '../effect/errors';

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
 * Result type for safeParse - matches a familiar safeParse-style API
 */
export type SafeParseResult<A> =
  | { success: true; data: A }
  | { success: false; error: { issues: Array<{ message: string; path?: string }> } };

/**
 * Safely parses data against an Effect Schema.
 * Returns the parsed data or validation errors if validation fails.
 * Does not throw errors - useful for form handling.
 * Returns a safeParse-style result object for compatibility.
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
// Common Query Parameter Schemas
// =============================================================================

/**
 * Common pagination query parameters schema.
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
