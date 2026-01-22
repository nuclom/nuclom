/**
 * Effect Streaming Utilities for React Server Components
 *
 * Provides streaming capabilities for progressive data loading
 * using React Suspense and Effect Streams.
 */

import { Effect, Stream } from 'effect';
import type { AppServices } from './runtime';
import { runEffect } from './runtime';

// =============================================================================
// Streaming Types
// =============================================================================

export interface StreamChunk<T> {
  readonly type: 'data' | 'done' | 'error';
  readonly data?: T;
  readonly error?: string;
}

// =============================================================================
// Stream to AsyncIterable
// =============================================================================

/**
 * Convert an Effect Stream to an AsyncIterable for use with React
 * This enables streaming data to client components
 */
export async function* streamToAsyncIterable<A, E, R extends AppServices>(
  stream: Stream.Stream<A, E, R>,
): AsyncGenerator<StreamChunk<A>> {
  try {
    const chunks = await runEffect(Stream.runCollect(stream));
    for (const item of chunks) {
      yield { type: 'data', data: item };
    }
    yield { type: 'done' };
  } catch (error) {
    yield {
      type: 'error',
      error: error instanceof Error ? error.message : 'Stream error',
    };
  }
}

/**
 * Run a stream and collect all results
 */
export const runStream = async <A, E, R extends AppServices>(stream: Stream.Stream<A, E, R>): Promise<A[]> => {
  const chunks = await runEffect(Stream.runCollect(stream));
  return Array.from(chunks);
};

// =============================================================================
// Progressive Loading Patterns
// =============================================================================

/**
 * Create a deferred data loader for Suspense
 * Returns a promise that can be used with React's use() hook
 */
export const createDeferredLoader = <A, E, R extends AppServices>(effect: Effect.Effect<A, E, R>): Promise<A> => {
  return runEffect(effect);
};

/**
 * Create multiple deferred loaders for parallel loading
 */
export const createParallelLoaders = <T extends Record<string, Effect.Effect<unknown, unknown, AppServices>>>(
  effects: T,
): { [K in keyof T]: Promise<T[K] extends Effect.Effect<infer A, unknown, unknown> ? A : never> } => {
  const result = {} as Record<string, Promise<unknown>>;

  for (const [key, effect] of Object.entries(effects)) {
    result[key] = createDeferredLoader(effect);
  }

  return result as { [K in keyof T]: Promise<T[K] extends Effect.Effect<infer A, unknown, unknown> ? A : never> };
};

// =============================================================================
// Streaming Server Actions
// =============================================================================

import { AI } from './services/ai';

/**
 * Stream AI summary generation
 * Returns an async generator for progressive updates
 */
export async function* streamVideoSummary(transcript: string): AsyncGenerator<StreamChunk<string>> {
  const effect = Effect.gen(function* () {
    const ai = yield* AI;
    return ai.createSummaryStream(transcript);
  });

  try {
    const stream = await runEffect(effect);

    // Convert Effect Stream to async generator
    const collectEffect = Stream.runCollect(stream);
    const chunks = await runEffect(collectEffect);

    for (const chunk of chunks) {
      yield { type: 'data', data: chunk };
    }
    yield { type: 'done' };
  } catch (error) {
    yield {
      type: 'error',
      error: error instanceof Error ? error.message : 'Streaming error',
    };
  }
}
