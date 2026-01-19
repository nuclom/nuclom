/**
 * Uptime Monitoring Workflow using Workflow DevKit
 *
 * Performs health checks on all services at regular intervals:
 * 1. Database connectivity
 * 2. R2 storage
 * 3. AI service
 *
 * Benefits:
 * - Durable execution ensures checks continue after restarts
 * - Automatic retry on transient failures
 * - Historical data for uptime calculations
 * - Admin notifications on service failures
 */

import { createWorkflowLogger } from './workflow-logger';

const log = createWorkflowLogger('uptime-monitor');

// =============================================================================
// Types
// =============================================================================

export interface UptimeMonitorInput {
  /** Check interval in milliseconds (default: 5 minutes) */
  intervalMs?: number;
  /** Maximum number of checks before stopping (0 = infinite) */
  maxChecks?: number;
}

export interface UptimeMonitorResult {
  checksPerformed: number;
  lastCheckAt: string;
}

export interface ServiceCheckResult {
  service: 'database' | 'storage' | 'ai' | 'overall';
  status: 'healthy' | 'degraded' | 'unhealthy' | 'not_configured';
  latencyMs: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Helper Functions
// =============================================================================

async function checkDatabase(): Promise<ServiceCheckResult> {
  'use step';

  const startTime = performance.now();

  try {
    const { sql } = await import('drizzle-orm');
    const { db } = await import('@nuclom/lib/db');

    await db.execute(sql`SELECT 1`);

    return {
      service: 'database',
      status: 'healthy',
      latencyMs: Math.round(performance.now() - startTime),
    };
  } catch (error) {
    return {
      service: 'database',
      status: 'unhealthy',
      latencyMs: Math.round(performance.now() - startTime),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkStorage(): Promise<ServiceCheckResult> {
  'use step';

  const startTime = performance.now();

  try {
    const { HeadBucketCommand, S3Client } = await import('@aws-sdk/client-s3');
    const { env } = await import('@nuclom/lib/env/server');

    const isConfigured = env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET_NAME;

    if (!isConfigured) {
      return {
        service: 'storage',
        status: 'not_configured',
        latencyMs: 0,
        error: 'R2 storage is not configured',
      };
    }

    const r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });

    await r2Client.send(
      new HeadBucketCommand({
        Bucket: env.R2_BUCKET_NAME,
      }),
    );

    return {
      service: 'storage',
      status: 'healthy',
      latencyMs: Math.round(performance.now() - startTime),
      metadata: {
        bucket: env.R2_BUCKET_NAME,
      },
    };
  } catch (error) {
    return {
      service: 'storage',
      status: 'unhealthy',
      latencyMs: Math.round(performance.now() - startTime),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkAI(): Promise<ServiceCheckResult> {
  'use step';

  const startTime = performance.now();

  try {
    const { gateway } = await import('@ai-sdk/gateway');
    const { generateText } = await import('ai');

    const model = gateway('xai/grok-3');

    const result = await generateText({
      model,
      prompt: "Reply with 'ok'",
    });

    if (!result.text) {
      throw new Error('Empty response from AI service');
    }

    return {
      service: 'ai',
      status: 'healthy',
      latencyMs: Math.round(performance.now() - startTime),
      metadata: {
        model: 'xai/grok-3',
        provider: 'vercel-ai-gateway',
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isConfigError =
      errorMessage.includes('API key') || errorMessage.includes('authentication') || errorMessage.includes('401');

    return {
      service: 'ai',
      status: isConfigError ? 'not_configured' : 'unhealthy',
      latencyMs: Math.round(performance.now() - startTime),
      error: errorMessage,
    };
  }
}

async function saveHealthCheckResults(results: ServiceCheckResult[]): Promise<void> {
  'use step';

  const { db } = await import('@nuclom/lib/db');
  const { healthChecks } = await import('@nuclom/lib/db/schema');

  const now = new Date();

  await db.insert(healthChecks).values(
    results.map((result) => ({
      service: result.service,
      status: result.status,
      latencyMs: result.latencyMs,
      error: result.error ?? null,
      metadata: result.metadata ?? null,
      checkedAt: now,
    })),
  );
}

async function notifyAdminsOnFailure(failedServices: ServiceCheckResult[]): Promise<void> {
  'use step';

  if (failedServices.length === 0) return;

  try {
    const { db } = await import('@nuclom/lib/db');
    const { notifications, users } = await import('@nuclom/lib/db/schema');
    const { eq } = await import('drizzle-orm');
    const { resend } = await import('@nuclom/lib/email');
    const { env, getAppUrl } = await import('@nuclom/lib/env/server');

    // Get all admin users
    const adminUsers = await db.query.users.findMany({
      where: eq(users.role, 'admin'),
    });

    if (adminUsers.length === 0) {
      log.warn({}, 'No admin users found to notify');
      return;
    }

    const failureMessage = failedServices
      .map((s) => `- ${s.service}: ${s.status}${s.error ? ` (${s.error})` : ''}`)
      .join('\n');

    const baseUrl = getAppUrl();

    // Create in-app notifications for each admin
    for (const admin of adminUsers) {
      await db.insert(notifications).values({
        userId: admin.id,
        type: 'video_processing_failed', // Reusing existing type for service alerts
        title: 'Service Health Alert',
        body: `The following services are experiencing issues:\n${failureMessage}`,
        resourceType: 'video',
        resourceId: 'health-check',
      });

      // Send email notification
      if (admin.email) {
        const fromEmail = env.RESEND_FROM_EMAIL ?? 'alerts@nuclom.com';
        await resend.emails.send({
          from: fromEmail,
          to: admin.email,
          subject: `[ALERT] Service Health Issues Detected`,
          html: `
            <h2>Service Health Alert</h2>
            <p>Hi ${admin.name || 'Admin'},</p>
            <p>The following services are experiencing issues:</p>
            <ul>
              ${failedServices.map((s) => `<li><strong>${s.service}</strong>: ${s.status}${s.error ? ` - ${s.error}` : ''}</li>`).join('')}
            </ul>
            <p>Please check the <a href="${baseUrl}/status">status page</a> for more details.</p>
          `,
        });
      }
    }
  } catch (error) {
    log.error({ error, failedServiceCount: failedServices.length }, 'Failed to send admin notifications');
  }
}

// =============================================================================
// Main Workflow
// =============================================================================

/**
 * Uptime monitoring workflow that runs a single health check.
 *
 * This workflow executes once and exits - cron handles the scheduling.
 * Each invocation:
 * 1. Checks database connectivity
 * 2. Checks R2 storage
 * 3. Checks AI service
 * 4. Stores results in healthChecks table
 * 5. Sends admin notifications on failures
 * 6. Returns and exits
 *
 * IMPORTANT: This workflow is designed to run once per cron invocation.
 * Do NOT add infinite loops - the cron schedule handles periodic execution.
 */
export async function uptimeMonitorWorkflow(_input: UptimeMonitorInput): Promise<UptimeMonitorResult> {
  'use workflow';

  // Step 1: Check all services in parallel
  const [dbResult, storageResult, aiResult] = await Promise.all([checkDatabase(), checkStorage(), checkAI()]);

  // Step 2: Calculate overall status
  const results = [dbResult, storageResult, aiResult];
  const activeResults = results.filter((r) => r.status !== 'not_configured');
  const allHealthy = activeResults.every((r) => r.status === 'healthy');
  const someHealthy = activeResults.some((r) => r.status === 'healthy');

  let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  if (allHealthy) {
    overallStatus = 'healthy';
  } else if (someHealthy) {
    overallStatus = 'degraded';
  } else {
    overallStatus = 'unhealthy';
  }

  const overallResult: ServiceCheckResult = {
    service: 'overall',
    status: overallStatus,
    latencyMs: Math.max(dbResult.latencyMs, storageResult.latencyMs, aiResult.latencyMs),
    metadata: {
      database: dbResult.status,
      storage: storageResult.status,
      ai: aiResult.status,
    },
  };

  // Step 3: Save results to database
  await saveHealthCheckResults([...results, overallResult]);

  // Step 4: Notify admins on failures
  const failedServices = results.filter((r) => r.status === 'unhealthy');
  if (failedServices.length > 0) {
    await notifyAdminsOnFailure(failedServices);
  }

  const lastCheckAt = new Date().toISOString();

  return {
    checksPerformed: 1,
    lastCheckAt,
  };
}

/**
 * Run a single health check (useful for testing or manual checks)
 */
export async function runSingleHealthCheck(): Promise<ServiceCheckResult[]> {
  'use workflow';

  const [dbResult, storageResult, aiResult] = await Promise.all([checkDatabase(), checkStorage(), checkAI()]);

  const results = [dbResult, storageResult, aiResult];
  const activeResults = results.filter((r) => r.status !== 'not_configured');
  const allHealthy = activeResults.every((r) => r.status === 'healthy');
  const someHealthy = activeResults.some((r) => r.status === 'healthy');

  let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  if (allHealthy) {
    overallStatus = 'healthy';
  } else if (someHealthy) {
    overallStatus = 'degraded';
  } else {
    overallStatus = 'unhealthy';
  }

  const overallResult: ServiceCheckResult = {
    service: 'overall',
    status: overallStatus,
    latencyMs: Math.max(dbResult.latencyMs, storageResult.latencyMs, aiResult.latencyMs),
  };

  const allResults = [...results, overallResult];

  await saveHealthCheckResults(allResults);

  const failedServices = results.filter((r) => r.status === 'unhealthy');
  if (failedServices.length > 0) {
    await notifyAdminsOnFailure(failedServices);
  }

  return allResults;
}
