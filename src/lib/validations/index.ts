/**
 * Form Validation Utilities
 *
 * Provides hooks and utilities for form validation with Effect Schema and React Hook Form.
 */

export * from "./schemas";

import { effectTsResolver } from "@hookform/resolvers/effect-ts";
import { ParseResult, Schema } from "effect";
import { useCallback, useState } from "react";
import type { DefaultValues, FieldError, FieldValues, Path } from "react-hook-form";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { type ApiErrorResponse, type ErrorCode, getErrorMessage, isApiError } from "@/lib/api-errors";

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

  // Use type assertion to work around Effect Schema / hookform resolver type compatibility
  // The resolver will still validate correctly at runtime
  const form = useForm<TInput>({
    resolver: effectTsResolver(schema as unknown as Schema.Schema<TInput, FieldValues>) as never,
    defaultValues,
    mode: "onBlur",
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
    const apiError = error as ApiErrorResponse;
    const message = getErrorMessage(apiError.error.code as ErrorCode);

    // Set field-specific errors if provided
    if (apiError.error.details?.field) {
      const field = apiError.error.details.field as Path<TInput>;
      setError(field, {
        type: "server",
        message: apiError.error.message,
      });
    } else if (apiError.error.details?.fields) {
      const fields = apiError.error.details.fields as Array<{ field: string; message: string }>;
      for (const { field, message } of fields) {
        setError(field as Path<TInput>, {
          type: "server",
          message,
        });
      }
    } else {
      setSubmitError(message);
    }

    toast.error(message);
    return;
  }

  // Handle Effect Schema validation errors (ParseError)
  if (error instanceof Error && "issue" in error) {
    try {
      const parseError = error as ParseResult.ParseError;
      const issues = ParseResult.ArrayFormatter.formatErrorSync(parseError);
      for (const issue of issues) {
        const path = issue.path.join(".") as Path<TInput>;
        setError(path, {
          type: "validation",
          message: issue.message,
        });
      }
      setSubmitError("Please check the form for errors");
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
          setSubmitError("An unexpected error occurred. Please try again.");
          toast.error("An unexpected error occurred");
        }
      })
      .catch(() => {
        setSubmitError("An unexpected error occurred. Please try again.");
        toast.error("An unexpected error occurred");
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
  setSubmitError("An unexpected error occurred. Please try again.");
  toast.error("An unexpected error occurred");
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

  if (result._tag === "Right") {
    return { success: true, data: result.right };
  }

  const issues = ParseResult.ArrayFormatter.formatErrorSync(result.left);
  const errors = issues.map((issue) => ({
    field: issue.path.join("."),
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
    const path = issue.path.join(".");
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  }

  return errors;
}
