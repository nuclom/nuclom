/**
 * Database Service using Effect-TS and Drizzle ORM
 *
 * This service provides a type-safe database layer using @effect/sql-drizzle
 * which integrates Drizzle ORM with Effect's execution model.
 */

import { layer as pgDrizzleLayer } from '@effect/sql-drizzle/Pg';
import { PgClient } from '@effect/sql-pg';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { Config, Context, Effect, Layer, pipe, Redacted } from 'effect';
import postgres from 'postgres';
import * as schema from '@/lib/db/schema';
import { DatabaseError, DuplicateError, NotFoundError, TransactionError } from '../errors';

// =============================================================================
// Types
// =============================================================================

export type DrizzleDB = PostgresJsDatabase<typeof schema>;

export interface DatabaseService {
  readonly db: DrizzleDB;
  readonly client: postgres.Sql;
}

// =============================================================================
// Database Service Tag
// =============================================================================

export class Database extends Context.Tag('Database')<Database, DatabaseService>() {}

// =============================================================================
// Database Layer using Effect SQL
// =============================================================================

/**
 * Creates the PostgreSQL client layer using Effect SQL
 */
const makePgClientLayer = Layer.unwrapEffect(
  Effect.gen(function* () {
    const databaseUrl = yield* Config.redacted('DATABASE_URL');

    return PgClient.layerConfig({
      url: Config.succeed(databaseUrl),
    });
  }),
);

/**
 * Creates the Drizzle layer on top of the PgClient
 */
export const DrizzleLive = pgDrizzleLayer.pipe(Layer.provide(makePgClientLayer));

// =============================================================================
// Alternative: Direct Drizzle Connection (for simpler use cases)
// =============================================================================

/**
 * Creates a Database service layer using direct postgres-js connection
 * This is useful when you don't need full Effect SQL features
 */
export const DatabaseLive = Layer.scoped(
  Database,
  Effect.gen(function* () {
    const databaseUrl = yield* Config.redacted('DATABASE_URL');

    const client = postgres(Redacted.value(databaseUrl), {
      prepare: false, // Required for "Transaction" pool mode
    });

    const db = drizzle(client, { schema });

    // Cleanup on scope closure
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        client.end();
      }),
    );

    return { db, client };
  }),
);

// =============================================================================
// Database Helper Functions
// =============================================================================

/**
 * Get the database instance
 */
export const getDb = Effect.serviceFunction(Database, (service) => () => service.db);

/**
 * Execute a database query with error handling
 */
export const query = <A>(
  operation: string,
  queryFn: (db: DrizzleDB) => Promise<A>,
): Effect.Effect<A, DatabaseError, Database> =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    return yield* Effect.tryPromise({
      try: () => queryFn(db),
      catch: (error) =>
        new DatabaseError({
          message: `Database operation failed: ${operation}`,
          operation,
          cause: error,
        }),
    });
  });

/**
 * Execute a database transaction with error handling
 */
export const transaction = <A>(
  operations: (tx: DrizzleDB) => Promise<A>,
): Effect.Effect<A, TransactionError, Database> =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    return yield* Effect.tryPromise({
      try: () => db.transaction(operations),
      catch: (error) =>
        new TransactionError({
          message: 'Transaction failed',
          cause: error,
        }),
    });
  });

/**
 * Find a single entity or fail with NotFoundError
 */
export const findOneOrFail = <A>(
  entity: string,
  id: string,
  queryFn: (db: DrizzleDB) => Promise<A | undefined>,
): Effect.Effect<A, DatabaseError | NotFoundError, Database> =>
  pipe(
    query(`find ${entity}`, queryFn),
    Effect.flatMap((result) =>
      result !== undefined
        ? Effect.succeed(result)
        : Effect.fail(
            new NotFoundError({
              message: `${entity} not found`,
              entity,
              id,
            }),
          ),
    ),
  );

/**
 * Insert with duplicate handling
 */
export const insertUnique = <A>(
  entity: string,
  field: string,
  insertFn: (db: DrizzleDB) => Promise<A>,
): Effect.Effect<A, DatabaseError | DuplicateError, Database> =>
  Effect.gen(function* () {
    const result = yield* query(`insert ${entity}`, insertFn).pipe(
      Effect.mapError((error: DatabaseError): DatabaseError | DuplicateError => {
        // Check if it's a unique constraint violation
        const cause = error.cause as Error | undefined;
        if (cause?.message?.includes('unique') || cause?.message?.includes('duplicate')) {
          return new DuplicateError({
            message: `${entity} with this ${field} already exists`,
            entity,
            field,
          });
        }
        return error;
      }),
    );
    return result;
  });
