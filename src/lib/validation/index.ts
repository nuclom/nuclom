import { Effect } from "effect";
import type { z } from "zod";
import { ValidationError } from "@/lib/effect/errors";

/**
 * Validates data against a Zod schema and returns an Effect
 * that either succeeds with the parsed data or fails with a ValidationError.
 */
export function validate<T extends z.ZodSchema>(
  schema: T,
  data: unknown,
): Effect.Effect<z.infer<T>, ValidationError> {
  return Effect.try({
    try: () => schema.parse(data),
    catch: (error) => {
      if (error && typeof error === "object" && "errors" in error) {
        const zodError = error as { errors: Array<{ message: string; path: (string | number)[] }> };
        const messages = zodError.errors.map(
          (e) => (e.path.length > 0 ? `${e.path.join(".")}: ${e.message}` : e.message),
        );
        return new ValidationError({ message: messages.join("; ") });
      }
      return new ValidationError({ message: "Validation failed" });
    },
  });
}

/**
 * Validates data against a Zod schema and returns an Effect
 * that succeeds with the parsed data or fails with a ValidationError.
 * Returns undefined instead of failing for missing optional data.
 */
export function validateOptional<T extends z.ZodSchema>(
  schema: T,
  data: unknown,
): Effect.Effect<z.infer<T> | undefined, ValidationError> {
  if (data === undefined || data === null) {
    return Effect.succeed(undefined);
  }
  return validate(schema, data);
}

/**
 * Safely parses data against a Zod schema.
 * Returns the parsed data or null if validation fails.
 * Does not throw errors - useful for form handling.
 */
export function safeParse<T extends z.ZodSchema>(
  schema: T,
  data: unknown,
): { success: true; data: z.infer<T> } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  // Handle Zod 4 error structure
  const zodError = result.error;
  const issues = "issues" in zodError ? zodError.issues : [];
  const errors = issues.map((e) => {
    const path = e.path.map(String);
    return path.length > 0 ? `${path.join(".")}: ${e.message}` : e.message;
  });

  return { success: false, errors };
}

/**
 * Parses query parameters from a URL into an object.
 * Handles arrays and boolean conversion.
 */
export function parseQueryParams(url: string | URL): Record<string, unknown> {
  const { searchParams } = typeof url === "string" ? new URL(url) : url;
  const params: Record<string, unknown> = {};

  searchParams.forEach((value, key) => {
    // Handle array parameters (e.g., ?ids=1&ids=2)
    if (params[key] !== undefined) {
      if (Array.isArray(params[key])) {
        (params[key] as unknown[]).push(value);
      } else {
        params[key] = [params[key], value];
      }
    } else {
      params[key] = value;
    }
  });

  return params;
}

/**
 * Validates query parameters against a Zod schema.
 */
export function validateQueryParams<T extends z.ZodSchema>(
  schema: T,
  url: string | URL,
): Effect.Effect<z.infer<T>, ValidationError> {
  const params = parseQueryParams(url);
  return validate(schema, params);
}

/**
 * Validates a JSON request body against a Zod schema.
 */
export function validateRequestBody<T extends z.ZodSchema>(
  schema: T,
  request: Request,
): Effect.Effect<z.infer<T>, ValidationError> {
  return Effect.gen(function* () {
    const body = yield* Effect.tryPromise({
      try: () => request.json(),
      catch: () => new ValidationError({ message: "Invalid JSON body" }),
    });

    return yield* validate(schema, body);
  });
}

/**
 * Validates form data against a Zod schema.
 */
export function validateFormData<T extends z.ZodSchema>(
  schema: T,
  formData: FormData,
): Effect.Effect<z.infer<T>, ValidationError> {
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

// Re-export schemas
export * from "./schemas";

// Re-export file validation
export * from "./file-validation";

// Re-export sanitization
export * from "./sanitize";
