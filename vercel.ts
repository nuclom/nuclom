import type { VercelConfig } from '@vercel/config/v1';

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
