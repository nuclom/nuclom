/**
 * Common Effect-TS exports
 *
 * This file serves as the central import point for Effect modules.
 * Following Effect-TS best practices, we re-export commonly used modules
 * to ensure consistent usage across the codebase.
 */

export { HttpClient, HttpClientError, HttpClientRequest, HttpClientResponse } from '@effect/platform';
// Platform-specific imports for Node.js
export { NodeContext, NodeRuntime } from '@effect/platform-node';
export { PgDrizzle } from '@effect/sql-drizzle/Pg';
// SQL and database
export { PgClient } from '@effect/sql-pg';
// Core Effect modules
// Data structures and utilities
// Schema for validation and encoding/decoding
// Config for environment variables
// Logging and observability
// Concurrency and scheduling
// Error handling
// Duration and time
export {
  Array as EffectArray,
  Brand,
  Cause,
  Channel,
  Chunk,
  Config,
  ConfigError,
  ConfigProvider,
  Context,
  Data,
  Deferred,
  Duration,
  Effect,
  Either,
  Exit,
  Fiber,
  FiberRef,
  flow,
  HashMap,
  HashSet,
  identity,
  Layer,
  Logger,
  LogLevel,
  ManagedRuntime,
  Match,
  Micro,
  Option,
  Predicate,
  pipe,
  Queue,
  Record as EffectRecord,
  Ref,
  Runtime,
  Schedule,
  Schema,
  Scope,
  Sink,
  Stream,
  Tuple,
} from 'effect';

// Re-export type utilities
export type { Simplify } from 'effect/Types';
