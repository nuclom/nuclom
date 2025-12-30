/**
 * Form Validation Utilities
 *
 * Provides hooks and utilities for form validation with Zod and React Hook Form.
 */

export * from "./schemas";

import { useCallback, useState } from "react";
import type { FieldValues, Path, FieldError, DefaultValues } from "react-hook-form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodType, ZodError } from "zod";
import { toast } from "sonner";
import { type ApiErrorResponse, isApiError, getErrorMessage, type ErrorCode } from "@/lib/api-errors";

// =============================================================================
// Types
// =============================================================================

interface UseValidatedFormOptions<TInput extends FieldValues> {
  schema: ZodType<TInput>;
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
 * A hook that combines React Hook Form with Zod validation and API error handling.
 *
 * @example
 * ```tsx
 * const { form, handleFormSubmit, isSubmitting, submitError } = useValidatedForm({
 *   schema: loginSchema,
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
export function useValidatedForm<TInput extends FieldValues>({
  schema,
  defaultValues,
  onSubmit,
  onSuccess,
  onError,
  successMessage,
  resetOnSuccess = false,
}: UseValidatedFormOptions<TInput>) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Use type assertion to work around Zod v4 / hookform resolver type compatibility
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<TInput>({
    resolver: zodResolver(schema as any) as any,
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

  // Handle Zod validation errors
  if (error instanceof Error && "issues" in error) {
    const zodError = error as ZodError;
    for (const issue of zodError.issues) {
      const path = issue.path.join(".") as Path<TInput>;
      setError(path, {
        type: "validation",
        message: issue.message,
      });
    }
    setSubmitError("Please check the form for errors");
    return;
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
 * Validate data against a schema and return typed result
 */
export function validateData<T>(
  schema: ZodType<T>,
  data: unknown,
): { success: true; data: T } | { success: false; errors: Array<{ field: string; message: string }> } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));

  return { success: false, errors };
}

/**
 * Format Zod errors into a flat object for easy display
 */
export function formatZodErrors(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  }

  return errors;
}
