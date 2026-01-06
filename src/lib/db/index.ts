import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/lib/env/server';
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
  max: 20, // Maximum connections in pool
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
      max: 30, // Higher pool for read replicas
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
// Backward Compatibility
// =============================================================================

// Re-export schema for convenience
export * from './schema';
