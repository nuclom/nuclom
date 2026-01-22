/**
 * Form Validation Utilities
 *
 * Provides hooks and utilities for form validation with Effect Schema and React Hook Form.
 */

import { effectTsResolver } from '@hookform/resolvers/effect-ts';
import { ParseResult, Schema } from 'effect';
import { useCallback, useState } from 'react';
import type { DefaultValues, FieldError, FieldValues, Path } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { type ErrorCode, errorMessages, getErrorMessage, isApiError, isRecord } from '../api-errors';

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if a value is a valid ErrorCode
 */
function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && value in errorMessages;
}

/**
 * Type guard for field error details
 */
function hasFieldDetail(details: Record<string, unknown>): details is { field: string } {
  return typeof details.field === 'string';
}

/**
 * Type guard for fields array details
 */
function hasFieldsDetail(
  details: Record<string, unknown>,
): details is { fields: Array<{ field: string; message: string }> } {
  if (!Array.isArray(details.fields)) return false;
  return details.fields.every(
    (item) => isRecord(item) && typeof item.field === 'string' && typeof item.message === 'string',
  );
}

/**
 * Type guard for ParseResult.ParseError
 */
function isParseError(error: unknown): error is ParseResult.ParseError {
  return error instanceof Error && 'issue' in error && typeof (error as { issue?: unknown }).issue === 'object';
}

// =============================================================================
// Types
// =============================================================================

interface UseValidatedFormOptions<TInput extends FieldValues, I> {
  schema: Schema.Schema<TInput, I>;
  defaultValues?: DefaultValues<TInput>;
  onSubmit: (data: TInput) => Promise<void>;
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
  successMessage?: string;
  resetOnSuccess?: boolean;
}

// =============================================================================
// Hook: useValidatedForm
// =============================================================================

/**
 * A hook that combines React Hook Form with Effect Schema validation and API error handling.
 *
 * @example
 * ```tsx
 * const { form, handleFormSubmit, isSubmitting, submitError } = useValidatedForm({
 *   schema: LoginSchema,
 *   defaultValues: { email: "", password: "" },
 *   onSubmit: async (data) => {
 *     await login(data);
 *   },
 *   successMessage: "Logged in successfully",
 *   onSuccess: () => router.push("/dashboard"),
 * });
 *
 * return (
 *   <form onSubmit={handleFormSubmit}>
 *     <FormField name="email" control={form.control} />
 *     {submitError && <ErrorMessage>{submitError}</ErrorMessage>}
 *     <button type="submit" disabled={isSubmitting}>
 *       {isSubmitting ? "Loading..." : "Submit"}
 *     </button>
 *   </form>
 * );
 * ```
 */
export function useValidatedForm<TInput extends FieldValues, I>({
  schema,
  defaultValues,
  onSubmit,
  onSuccess,
  onError,
  successMessage,
  resetOnSuccess = false,
}: UseValidatedFormOptions<TInput, I>) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  // SAFETY: Type assertion is required here due to a known incompatibility between
  // Effect Schema's type system and @hookform/resolvers/effect-ts.
  // The effectTsResolver expects Schema.Schema<A, I> where I extends FieldValues,
  // but our schema may have a different input type. The resolver performs runtime
  // validation correctly regardless of the compile-time types.
  // See: https://github.com/react-hook-form/resolvers/issues/595
  // biome-ignore lint/suspicious/noExplicitAny: Required for library interoperability - resolver types are incompatible
  const resolver = effectTsResolver(schema as Schema.Schema<TInput, FieldValues>) as any;
  const form = useForm<TInput>({
    resolver,
    defaultValues,
    mode: 'onBlur',
  });

  const clearSubmitError = useCallback(() => {
    setSubmitError(null);
  }, []);

  const handleFormSubmit = useCallback(
    async (e?: React.BaseSyntheticEvent) => {
      e?.preventDefault();
      clearSubmitError();

      const result = await form.trigger();
      if (!result) return;

      try {
        const data = form.getValues();
        await onSubmit(data);

        if (successMessage) {
          toast.success(successMessage);
        }

        if (resetOnSuccess) {
          form.reset();
        }

        onSuccess?.();
      } catch (error) {
        handleSubmitError(error, form.setError, setSubmitError);
        onError?.(error);
      }
    },
    [form, onSubmit, onSuccess, onError, successMessage, resetOnSuccess, clearSubmitError],
  );

  return {
    form,
    handleFormSubmit,
    isSubmitting: form.formState.isSubmitting,
    submitError,
    clearSubmitError,
  };
}

// =============================================================================
// Error Handling Utilities
// =============================================================================

type SetErrorFn<TInput extends FieldValues> = (name: Path<TInput>, error: { type: string; message: string }) => void;

/**
 * Handle form submission errors from API responses
 */
function handleSubmitError<TInput extends FieldValues>(
  error: unknown,
  setError: SetErrorFn<TInput>,
  setSubmitError: (error: string | null) => void,
): void {
  // Handle API error responses
  if (isApiError(error)) {
    const errorCode = error.error.code;
    const message = isErrorCode(errorCode) ? getErrorMessage(errorCode) : 'An unexpected error occurred';

    // Set field-specific errors if provided
    const details = error.error.details;
    if (details && hasFieldDetail(details)) {
      // Note: Path<TInput> cast is necessary as we can't statically verify the field name matches the form schema
      setError(details.field as Path<TInput>, {
        type: 'server',
        message: error.error.message,
      });
    } else if (details && hasFieldsDetail(details)) {
      for (const fieldError of details.fields) {
        // Note: Path<TInput> cast is necessary as we can't statically verify the field name matches the form schema
        setError(fieldError.field as Path<TInput>, {
          type: 'server',
          message: fieldError.message,
        });
      }
    } else {
      setSubmitError(message);
    }

    toast.error(message);
    return;
  }

  // Handle Effect Schema validation errors (ParseError)
  if (isParseError(error)) {
    try {
      const issues = ParseResult.ArrayFormatter.formatErrorSync(error);
      for (const issue of issues) {
        // Note: Path<TInput> cast is necessary as we can't statically verify the path matches the form schema
        const path = issue.path.join('.') as Path<TInput>;
        setError(path, {
          type: 'validation',
          message: issue.message,
        });
      }
      setSubmitError('Please check the form for errors');
      return;
    } catch {
      // Fall through to generic error handling
    }
  }

  // Handle fetch errors
  if (error instanceof Response) {
    error
      .json()
      .then((data) => {
        if (isApiError(data)) {
          handleSubmitError(data, setError, setSubmitError);
        } else {
          setSubmitError('An unexpected error occurred. Please try again.');
          toast.error('An unexpected error occurred');
        }
      })
      .catch(() => {
        setSubmitError('An unexpected error occurred. Please try again.');
        toast.error('An unexpected error occurred');
      });
    return;
  }

  // Handle generic errors
  if (error instanceof Error) {
    setSubmitError(error.message);
    toast.error(error.message);
    return;
  }

  // Unknown error
  setSubmitError('An unexpected error occurred. Please try again.');
  toast.error('An unexpected error occurred');
}

/**
 * Extract error message from a form field error
 */
export function getFieldErrorMessage(error: FieldError | undefined): string | undefined {
  if (!error) return undefined;
  return error.message;
}

/**
 * Check if a field has an error
 */
export function hasFieldError(error: FieldError | undefined): boolean {
  return !!error;
}

// =============================================================================
// Validation Utility Functions
// =============================================================================

/**
 * Validate data against an Effect Schema and return typed result
 */
export function validateData<A, I>(
  schema: Schema.Schema<A, I>,
  data: unknown,
): { success: true; data: A } | { success: false; errors: Array<{ field: string; message: string }> } {
  const result = Schema.decodeUnknownEither(schema)(data);

  if (result._tag === 'Right') {
    return { success: true, data: result.right };
  }

  const issues = ParseResult.ArrayFormatter.formatErrorSync(result.left);
  const errors = issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));

  return { success: false, errors };
}

/**
 * Format Effect Schema errors into a flat object for easy display
 */
export function formatSchemaErrors(error: ParseResult.ParseError): Record<string, string> {
  const errors: Record<string, string> = {};
  const issues = ParseResult.ArrayFormatter.formatErrorSync(error);

  for (const issue of issues) {
    const path = issue.path.join('.');
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  }

  return errors;
}
