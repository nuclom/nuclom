/**
 * Common Effect-TS exports
 *
 * This file serves as the central import point for Effect modules.
 * Following Effect-TS best practices, we re-export commonly used modules
 * to ensure consistent usage across the codebase.
 */

// Core Effect modules
export {
  Effect,
  Layer,
  Context,
  Scope,
  Runtime,
  Exit,
  Cause,
  Either,
  Option,
  pipe,
  flow,
  identity,
  ManagedRuntime,
} from "effect";

// Data structures and utilities
export {
  Data,
  Match,
  Predicate,
  Tuple,
  Brand,
  Chunk,
  HashMap,
  HashSet,
  Array as EffectArray,
  Record as EffectRecord,
} from "effect";

// Schema for validation and encoding/decoding
export { Schema } from "effect";

// Config for environment variables
export { Config, ConfigProvider, ConfigError } from "effect";

// Logging and observability
export { Logger, LogLevel } from "effect";

// Concurrency and scheduling
export { Fiber, FiberRef, Queue, Ref, Deferred, Schedule, Stream, Sink, Channel } from "effect";

// Error handling
export { Micro } from "effect";

// Duration and time
export { Duration } from "effect";

// Platform-specific imports for Node.js
export { NodeRuntime, NodeContext } from "@effect/platform-node";
export { HttpClient, HttpClientRequest, HttpClientResponse, HttpClientError } from "@effect/platform";

// SQL and database
export { PgClient } from "@effect/sql-pg";
export { PgDrizzle } from "@effect/sql-drizzle/Pg";

// Re-export type utilities
export type { Simplify } from "effect/Types";
