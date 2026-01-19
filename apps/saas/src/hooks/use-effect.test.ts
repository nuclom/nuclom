import { HttpError, ParseError } from '@nuclom/lib/effect/errors';
import { act, renderHook, waitFor } from '@testing-library/react';
import { Effect, Either } from 'effect';
import { describe, expect, it, vi } from 'vitest';
import {
  getErrorStatus,
  isHttpError,
  isParseError,
  useEffectMutation,
  useEffectQuery,
  useErrorMessage,
} from './use-effect';

// Mock the Effect client
vi.mock('@nuclom/lib/effect/client', () => ({
  runClientEffect: vi.fn(),
}));

import { runClientEffect } from '@nuclom/lib/effect/client';

describe('useEffectQuery', () => {
  it('should start with loading state when immediate is true', async () => {
    vi.mocked(runClientEffect).mockResolvedValue(Either.right({ data: 'test' }));

    const { result } = renderHook(() => useEffectQuery(() => Effect.succeed({ data: 'test' }), { immediate: true }));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    // Wait for async operation to complete to prevent memory leak
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('should not start loading when immediate is false', () => {
    const { result } = renderHook(() => useEffectQuery(() => Effect.succeed({ data: 'test' }), { immediate: false }));

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
  });

  it('should fetch data successfully', async () => {
    const mockData = { id: 1, name: 'Test' };
    vi.mocked(runClientEffect).mockResolvedValue(Either.right(mockData));

    const { result } = renderHook(() => useEffectQuery(() => Effect.succeed(mockData)));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.isSuccess).toBe(true);
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle errors', async () => {
    const mockError = new HttpError({ message: 'Not found', status: 404 });
    vi.mocked(runClientEffect).mockResolvedValue(Either.left(mockError));

    const { result } = renderHook(() => useEffectQuery(() => Effect.fail(mockError)));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.isError).toBe(true);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.error).toEqual(mockError);
  });

  it('should refetch data when refetch is called', async () => {
    const mockData = { count: 1 };
    vi.mocked(runClientEffect).mockResolvedValue(Either.right(mockData));

    const { result } = renderHook(() => useEffectQuery(() => Effect.succeed(mockData)));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Update mock to return different data
    const newData = { count: 2 };
    vi.mocked(runClientEffect).mockResolvedValue(Either.right(newData));

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.data).toEqual(newData);
  });

  it('should reset state when reset is called', async () => {
    const mockData = { id: 1 };
    vi.mocked(runClientEffect).mockResolvedValue(Either.right(mockData));

    const { result } = renderHook(() => useEffectQuery(() => Effect.succeed(mockData)));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it('should refetch when deps change', async () => {
    vi.mocked(runClientEffect).mockResolvedValue(Either.right({ count: 1 }));

    const { result, rerender } = renderHook(
      ({ dep }) => useEffectQuery(() => Effect.succeed({ dep }), { deps: [dep] }),
      { initialProps: { dep: 1 } },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const firstCallCount = vi.mocked(runClientEffect).mock.calls.length;

    // Change dependency
    vi.mocked(runClientEffect).mockResolvedValue(Either.right({ count: 2 }));
    rerender({ dep: 2 });

    await waitFor(() => {
      expect(vi.mocked(runClientEffect).mock.calls.length).toBeGreaterThan(firstCallCount);
    });
  });

  it('should not update state after unmount', async () => {
    // Use a delayed resolution to simulate async operation
    let resolvePromise: (value: Either.Either<{ id: number }, never>) => void;
    vi.mocked(runClientEffect).mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );

    const { result, unmount } = renderHook(() => useEffectQuery(() => Effect.succeed({ id: 1 })));

    expect(result.current.loading).toBe(true);

    // Unmount before promise resolves
    unmount();

    // Resolve promise after unmount
    await act(async () => {
      // biome-ignore lint/style/noNonNullAssertion: resolvePromise is guaranteed to be set in the promise callback above
      resolvePromise!(Either.right({ id: 1 }));
    });

    // No error should be thrown
  });
});

describe('useEffectMutation', () => {
  it('should start with idle state', () => {
    const { result } = renderHook(() => useEffectMutation(() => Effect.succeed({ id: 1 })));

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it('should execute mutation successfully', async () => {
    const mockData = { id: 1, created: true };
    vi.mocked(runClientEffect).mockResolvedValue(Either.right(mockData));

    const { result } = renderHook(() =>
      useEffectMutation((input: { name: string }) => Effect.succeed({ ...input, id: 1 })),
    );

    // biome-ignore lint/suspicious/noExplicitAny: Test needs to capture mutation result with flexible type
    let mutationResult: Either.Either<unknown, unknown> = Either.right(null) as Either.Either<any, any>;
    await act(async () => {
      mutationResult = await result.current.mutate({ name: 'Test' });
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.isSuccess).toBe(true);
    expect(result.current.isError).toBe(false);
    expect(Either.isRight(mutationResult)).toBe(true);
  });

  it('should handle mutation errors', async () => {
    const mockError = new HttpError({ message: 'Bad request', status: 400 });
    vi.mocked(runClientEffect).mockResolvedValue(Either.left(mockError));

    const { result } = renderHook(() => useEffectMutation((_input: { name: string }) => Effect.fail(mockError)));

    await act(async () => {
      await result.current.mutate({ name: 'Test' });
    });

    expect(result.current.data).toBeNull();
    expect(result.current.isError).toBe(true);
    expect(result.current.error).toEqual(mockError);
  });

  it('should set loading state during mutation', async () => {
    let resolvePromise: (value: Either.Either<{ id: number }, never>) => void;
    vi.mocked(runClientEffect).mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );

    const { result } = renderHook(() => useEffectMutation(() => Effect.succeed({ id: 1 })));

    // Start mutation
    act(() => {
      result.current.mutate({});
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      // biome-ignore lint/style/noNonNullAssertion: resolvePromise is guaranteed to be set in the promise callback above
      resolvePromise!(Either.right({ id: 1 }));
    });

    expect(result.current.loading).toBe(false);
  });

  it('should reset mutation state', async () => {
    const mockData = { id: 1 };
    vi.mocked(runClientEffect).mockResolvedValue(Either.right(mockData));

    const { result } = renderHook(() => useEffectMutation(() => Effect.succeed(mockData)));

    await act(async () => {
      await result.current.mutate({});
    });

    expect(result.current.isSuccess).toBe(true);

    act(() => {
      result.current.reset();
    });

    expect(result.current.data).toBeNull();
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  it('should throw error with mutateAsync on failure', async () => {
    const mockError = new HttpError({ message: 'Server error', status: 500 });
    vi.mocked(runClientEffect).mockResolvedValue(Either.left(mockError));

    const { result } = renderHook(() => useEffectMutation(() => Effect.fail(mockError)));

    await expect(
      act(async () => {
        await result.current.mutateAsync({});
      }),
    ).rejects.toEqual(mockError);
  });

  it('should return data with mutateAsync on success', async () => {
    const mockData = { id: 1, name: 'Test' };
    vi.mocked(runClientEffect).mockResolvedValue(Either.right(mockData));

    const { result } = renderHook(() => useEffectMutation(() => Effect.succeed(mockData)));

    let data: typeof mockData | null = null;
    await act(async () => {
      data = await result.current.mutateAsync({});
    });

    expect(data).toEqual(mockData);
  });
});

describe('useErrorMessage', () => {
  it('should return null for falsy errors', () => {
    expect(useErrorMessage(null)).toBeNull();
    expect(useErrorMessage(undefined)).toBeNull();
    expect(useErrorMessage(false)).toBeNull();
  });

  it('should extract message from tagged error', () => {
    const taggedError = { _tag: 'HttpError', message: 'Not found' };
    expect(useErrorMessage(taggedError)).toBe('Not found');
  });

  it('should extract message from Error instance', () => {
    const error = new Error('Something went wrong');
    expect(useErrorMessage(error)).toBe('Something went wrong');
  });

  it('should return default message for unknown error', () => {
    expect(useErrorMessage('string error')).toBe('An unknown error occurred');
    expect(useErrorMessage(123)).toBe('An unknown error occurred');
    expect(useErrorMessage({ foo: 'bar' })).toBe('An unknown error occurred');
  });
});

describe('isHttpError', () => {
  it('should return true for HttpError instances', () => {
    const error = new HttpError({ message: 'Not found', status: 404 });
    expect(isHttpError(error)).toBe(true);
  });

  it('should return false for non-HttpError instances', () => {
    expect(isHttpError(new Error('test'))).toBe(false);
    expect(isHttpError(null)).toBe(false);
    expect(isHttpError({ _tag: 'HttpError' })).toBe(false);
  });
});

describe('isParseError', () => {
  it('should return true for ParseError instances', () => {
    const error = new ParseError({ message: 'Invalid JSON' });
    expect(isParseError(error)).toBe(true);
  });

  it('should return false for non-ParseError instances', () => {
    expect(isParseError(new Error('test'))).toBe(false);
    expect(isParseError(null)).toBe(false);
    expect(isParseError({ _tag: 'ParseError' })).toBe(false);
  });
});

describe('getErrorStatus', () => {
  it('should return status from HttpError', () => {
    const error = new HttpError({ message: 'Not found', status: 404 });
    expect(getErrorStatus(error)).toBe(404);
  });

  it('should return null for non-HttpError', () => {
    expect(getErrorStatus(new Error('test'))).toBeNull();
    expect(getErrorStatus(null)).toBeNull();
    expect(getErrorStatus({ status: 404 })).toBeNull();
  });
});
