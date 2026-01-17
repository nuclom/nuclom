import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../env/server';
import * as schema from './schema';

// =============================================================================
// Database Connection Configuration
// =============================================================================

/**
 * Primary database connection
 * Used for all write operations and when read replicas are not available
 */
const primaryClient = postgres(env.DATABASE_URL, {
  prepare: false, // Disable prefetch - not supported for "Transaction" pool mode
  max: 5, // Reduced for serverless - prevents connection exhaustion
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Connection timeout
});

/**
 * Read replica database connection (optional)
 * Used for read-heavy operations to reduce load on primary
 * Falls back to primary if DATABASE_REPLICA_URL is not set
 */
const replicaClient = env.DATABASE_REPLICA_URL
  ? postgres(env.DATABASE_REPLICA_URL, {
      prepare: false,
      max: 5, // Reduced for serverless - prevents connection exhaustion
      idle_timeout: 20,
      connect_timeout: 10,
    })
  : null;

// =============================================================================
// Drizzle ORM Instances
// =============================================================================

/**
 * Primary database instance
 * Use for:
 * - All INSERT, UPDATE, DELETE operations
 * - Transactions
 * - Operations requiring strong consistency
 */
export const db: PostgresJsDatabase<typeof schema> = drizzle(primaryClient, { schema });

/**
 * Read replica database instance
 * Falls back to primary if no replica is configured
 *
 * Use for:
 * - Read-heavy queries (listing, searching)
 * - Analytics queries
 * - Reports and dashboards
 *
 * Important: Data may be slightly stale due to replication lag (typically <1s)
 * Do NOT use for:
 * - Operations requiring strong consistency
 * - Reads immediately after writes
 */
export const dbRead: PostgresJsDatabase<typeof schema> = replicaClient ? drizzle(replicaClient, { schema }) : db;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if read replica is configured and available
 */
export function hasReadReplica(): boolean {
  return replicaClient !== null;
}

/**
 * Get database statistics
 */
export function getDbStats() {
  return {
    primary: {
      // postgres.js doesn't expose pool stats directly
      // In production, use database-level monitoring
      configured: true,
    },
    replica: {
      configured: hasReadReplica(),
    },
  };
}

// =============================================================================
// Connection Cleanup
// =============================================================================

/**
 * Close all database connections gracefully
 * Call this during application shutdown to prevent connection leaks
 */
export async function closeConnections(): Promise<void> {
  const promises: Promise<void>[] = [];

  promises.push(
    primaryClient.end().catch((err) => {
      console.error('Error closing primary database connection:', err);
    }),
  );

  if (replicaClient) {
    promises.push(
      replicaClient.end().catch((err) => {
        console.error('Error closing replica database connection:', err);
      }),
    );
  }

  await Promise.all(promises);
}

/**
 * Get the raw postgres client for the Effect layer to reuse
 * This allows the Effect layer to use the same pooled connection
 */
export function getPrimaryClient(): postgres.Sql {
  return primaryClient;
}

/**
 * Register shutdown handlers to close connections on process exit
 * This should be called once during application initialization
 */
let shutdownHandlersRegistered = false;

export function registerShutdownHandlers(): void {
  if (shutdownHandlersRegistered) return;
  shutdownHandlersRegistered = true;

  const gracefulShutdown = async (signal: string) => {
    console.log(`Received ${signal}. Closing database connections...`);
    await closeConnections();
    console.log('Database connections closed.');
    // biome-ignore lint/correctness/noProcessGlobal: Required for graceful shutdown
    process.exit(0);
  };

  // Handle various shutdown signals
  // biome-ignore lint/correctness/noProcessGlobal: Required for signal handlers
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  // biome-ignore lint/correctness/noProcessGlobal: Required for signal handlers
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught exceptions and unhandled rejections
  // biome-ignore lint/correctness/noProcessGlobal: Required for shutdown cleanup
  process.on('beforeExit', async () => {
    await closeConnections();
  });
}

// Auto-register shutdown handlers in non-test environments
// biome-ignore lint/correctness/noProcessGlobal: Required for environment check
if (process.env.NODE_ENV !== 'test') {
  registerShutdownHandlers();
}

// =============================================================================
// Backward Compatibility
// =============================================================================

// Re-export schema for convenience
export * from './schema';
