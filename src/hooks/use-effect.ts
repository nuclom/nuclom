"use client";

/**
 * Effect-based React Hooks
 *
 * Custom hooks that leverage Effect-TS for type-safe data fetching
 * with built-in error handling and loading states.
 */

import { type Effect, Either } from "effect";
import { useCallback, useEffect, useRef, useState } from "react";
import { runClientEffect } from "@/lib/effect/client";
import { HttpError, ParseError } from "@/lib/effect/errors";

// =============================================================================
// Types
// =============================================================================

export interface UseEffectState<T, E = unknown> {
  data: T | null;
  loading: boolean;
  error: E | null;
  isError: boolean;
  isSuccess: boolean;
}

export interface UseEffectOptions {
  /** Whether to fetch immediately on mount */
  immediate?: boolean;
  /** Dependencies that trigger a refetch */
  deps?: unknown[];
}

export interface UseEffectResult<T, E> extends UseEffectState<T, E> {
  /** Manually trigger a refetch */
  refetch: () => Promise<void>;
  /** Reset the state */
  reset: () => void;
}

// =============================================================================
// Core Hook: useEffect for Effect-TS
// =============================================================================

/**
 * Execute an Effect and manage its state in React
 *
 * @example
 * ```tsx
 * const { data, loading, error, refetch } = useEffectQuery(
 *   () => videoApiEffect.getVideos({ organizationId }),
 *   { deps: [organizationId] }
 * );
 * ```
 */
export function useEffectQuery<T, E>(
  effectFn: () => Effect.Effect<T, E, never>,
  options: UseEffectOptions = {},
): UseEffectResult<T, E> {
  const { immediate = true, deps = [] } = options;

  const [state, setState] = useState<UseEffectState<T, E>>({
    data: null,
    loading: immediate,
    error: null,
    isError: false,
    isSuccess: false,
  });

  const isMountedRef = useRef(true);
  const effectFnRef = useRef(effectFn);
  effectFnRef.current = effectFn;

  const execute = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
      isError: false,
    }));

    const result = await runClientEffect(effectFnRef.current());

    if (!isMountedRef.current) return;

    Either.match(result, {
      onLeft: (error) => {
        setState({
          data: null,
          loading: false,
          error,
          isError: true,
          isSuccess: false,
        });
      },
      onRight: (data) => {
        setState({
          data,
          loading: false,
          error: null,
          isError: false,
          isSuccess: true,
        });
      },
    });
  }, []);

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
      isError: false,
      isSuccess: false,
    });
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    if (immediate) {
      execute();
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [execute, immediate, ...deps]);

  return {
    ...state,
    refetch: execute,
    reset,
  };
}

// =============================================================================
// Mutation Hook
// =============================================================================

export interface UseMutationState<T, E> {
  data: T | null;
  loading: boolean;
  error: E | null;
  isError: boolean;
  isSuccess: boolean;
}

export interface UseMutationResult<T, E, TVariables> extends UseMutationState<T, E> {
  /** Execute the mutation */
  mutate: (variables: TVariables) => Promise<Either.Either<T, E>>;
  /** Execute the mutation and throw on error */
  mutateAsync: (variables: TVariables) => Promise<T>;
  /** Reset the state */
  reset: () => void;
}

/**
 * Execute an Effect mutation (POST, PUT, DELETE, etc.)
 *
 * @example
 * ```tsx
 * const { mutate, loading, error } = useEffectMutation(
 *   (data: CreateVideoInput) => videoApiEffect.createVideo(data)
 * );
 *
 * const handleSubmit = async (data) => {
 *   const result = await mutate(data);
 *   if (Either.isRight(result)) {
 *     // Success!
 *   }
 * };
 * ```
 */
export function useEffectMutation<T, E, TVariables>(
  mutationFn: (variables: TVariables) => Effect.Effect<T, E, never>,
): UseMutationResult<T, E, TVariables> {
  const [state, setState] = useState<UseMutationState<T, E>>({
    data: null,
    loading: false,
    error: null,
    isError: false,
    isSuccess: false,
  });

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const mutate = useCallback(
    async (variables: TVariables): Promise<Either.Either<T, E>> => {
      setState((prev) => ({
        ...prev,
        loading: true,
        error: null,
        isError: false,
      }));

      const result = await runClientEffect(mutationFn(variables));

      if (!isMountedRef.current) return result;

      Either.match(result, {
        onLeft: (error) => {
          setState({
            data: null,
            loading: false,
            error,
            isError: true,
            isSuccess: false,
          });
        },
        onRight: (data) => {
          setState({
            data,
            loading: false,
            error: null,
            isError: false,
            isSuccess: true,
          });
        },
      });

      return result;
    },
    [mutationFn],
  );

  const mutateAsync = useCallback(
    async (variables: TVariables): Promise<T> => {
      const result = await mutate(variables);

      return Either.match(result, {
        onLeft: (error) => {
          throw error;
        },
        onRight: (data) => data,
      });
    },
    [mutate],
  );

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
      isError: false,
      isSuccess: false,
    });
  }, []);

  return {
    ...state,
    mutate,
    mutateAsync,
    reset,
  };
}

// =============================================================================
// Utility Hooks
// =============================================================================

/**
 * Extract error message from Effect error types
 */
export function useErrorMessage(error: unknown): string | null {
  if (!error) return null;

  if (error && typeof error === "object" && "_tag" in error) {
    const taggedError = error as { _tag: string; message: string };
    return taggedError.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unknown error occurred";
}

/**
 * Check if error is a specific type
 */
export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

export function isParseError(error: unknown): error is ParseError {
  return error instanceof ParseError;
}

/**
 * Get HTTP status from error if available
 */
export function getErrorStatus(error: unknown): number | null {
  if (isHttpError(error)) {
    return error.status;
  }
  return null;
}
