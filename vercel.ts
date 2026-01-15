import dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import type { VercelConfig } from '@vercel/config/v1';

// =============================================================================
// Pre-Build Migration Runner
// =============================================================================

/**
 * Runs database migrations before Vercel builds.
 *
 * This ensures staging and production databases are up-to-date before
 * the application is deployed. Uses top-level await to block until
 * migrations complete.
 *
 * Environment Detection:
 * - Skips migrations in local development (NODE_ENV=development)
 * - Runs migrations for preview, staging, and production deployments
 */
async function runMigrations(): Promise<void> {
  // Load environment variables from .env files
  dotenv.config({ path: ['.env.local', '.env'] });

  const databaseUrl = process.env.DATABASE_URL;
  const vercelEnv = process.env.VERCEL_ENV;
  const nodeEnv = process.env.NODE_ENV;

  // Skip migrations in local development
  if (nodeEnv === 'development' && !vercelEnv) {
    console.log('[vercel.ts] Skipping migrations in local development');
    return;
  }

  // Validate DATABASE_URL is present
  if (!databaseUrl) {
    console.error('[vercel.ts] DATABASE_URL is not set, skipping migrations');
    return;
  }

  console.log(`[vercel.ts] Running database migrations (env: ${vercelEnv || nodeEnv})...`);

  // Create a dedicated connection for migrations
  // Using max: 1 to ensure migrations run sequentially
  const migrationClient = postgres(databaseUrl, {
    max: 1,
    onnotice: () => {}, // Suppress notices
  });

  const db = drizzle(migrationClient);

  try {
    const startTime = Date.now();
    await migrate(db, { migrationsFolder: './drizzle' });
    const duration = Date.now() - startTime;
    console.log(`[vercel.ts] Migrations completed successfully in ${duration}ms`);
  } catch (error) {
    console.error('[vercel.ts] Migration failed:', error);
    // Re-throw to fail the build if migrations fail
    throw error;
  } finally {
    // Clean up the connection
    await migrationClient.end();
  }
}

// Run migrations using top-level await
await runMigrations();

/**
 * Vercel Programmatic Configuration
 *
 * Defines cron jobs for periodic workflows:
 * - Subscription Enforcement: Daily at midnight UTC
 * - Scheduled Cleanup: Daily at 2 AM UTC
 * - Uptime Monitor: Every 5 minutes
 *
 * @see https://vercel.com/docs/project-configuration/vercel-ts
 * @see https://vercel.com/docs/cron-jobs
 */
export const config: VercelConfig = {
  crons: [
    // Daily subscription enforcement - runs at midnight UTC
    {
      path: '/api/cron?workflow=enforcement',
      schedule: '0 0 * * *',
    },
    // Daily cleanup of expired/deleted videos - runs at 2 AM UTC
    {
      path: '/api/cron?workflow=cleanup',
      schedule: '0 2 * * *',
    },
    // Uptime monitoring - runs every 5 minutes
    {
      path: '/api/cron?workflow=uptime',
      schedule: '*/5 * * * *',
    },
  ],
};
