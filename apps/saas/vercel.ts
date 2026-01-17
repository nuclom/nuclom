import path from 'node:path';
import { routes, type VercelConfig } from '@vercel/config/v1';
import dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

// Resolve the drizzle migrations folder relative to this file's location
// When Vercel compiles vercel.ts, it outputs to .vercel/vercel-temp.mjs
// so we need to navigate up one level in that case
const currentDir = import.meta.dirname;
const migrationsFolder = currentDir.endsWith('.vercel')
  ? path.join(currentDir, '..', 'drizzle')
  : path.join(currentDir, 'drizzle');

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
  console.log(`[vercel.ts] Migrations folder: ${migrationsFolder}`);

  // Create a dedicated connection for migrations
  // Using max: 1 to ensure migrations run sequentially
  const migrationClient = postgres(databaseUrl, {
    max: 1,
    onnotice: () => {}, // Suppress notices
  });

  const db = drizzle(migrationClient);

  try {
    const startTime = Date.now();
    await migrate(db, { migrationsFolder });
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

// =============================================================================
// Mintlify Documentation Hosting
// =============================================================================

const branch = process.env.VERCEL_GIT_COMMIT_REF;
const prodHost = 'nuclom.mintlify.app';

/**
 * Determines the Mintlify host to use.
 * Checks if a preview deployment exists for the current branch,
 * falls back to production if not available.
 */
async function getDocsHost(): Promise<string> {
  if (!branch || branch === 'main') {
    return prodHost;
  }

  const previewHost = `nuclom-${branch}.mintlify.app`;
  const res = await fetch(`https://${previewHost}/docs`, { method: 'HEAD' }).catch(() => null);
  return res?.ok ? previewHost : prodHost;
}

const docsHost = await getDocsHost();

/**
 * Vercel Programmatic Configuration
 *
 * Defines:
 * - Rewrites: Proxy /docs to Mintlify hosted documentation
 * - Cron Jobs: Periodic workflows for maintenance tasks
 *
 * @see https://vercel.com/docs/project-configuration/vercel-ts
 * @see https://vercel.com/docs/cron-jobs
 */
export const config: VercelConfig = {
  // Rewrite /docs/* to Mintlify hosted documentation
  rewrites: [
    routes.rewrite('/docs', `https://${docsHost}/docs`),
    routes.rewrite('/docs/:path*', `https://${docsHost}/docs/:path*`),
    routes.rewrite('/_mintlify/:path*', `https://${docsHost}/_mintlify/:path*`),
    routes.rewrite('/docs/llms.txt', `https://${docsHost}/llms.txt`),
    routes.rewrite('/docs/llms-full.txt', `https://${docsHost}/llms-full.txt`),
    routes.rewrite('/docs/sitemap.xml', `https://${docsHost}/sitemap.xml`),
    routes.rewrite('/docs/robots.txt', `https://${docsHost}/robots.txt`),
    routes.rewrite('/docs/mcp', `https://${docsHost}/mcp`),
    routes.rewrite('/mintlify-assets/:path+', `https://${docsHost}/mintlify-assets/:path+`),
  ],
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
