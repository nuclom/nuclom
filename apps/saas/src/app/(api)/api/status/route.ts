import { createPublicLayer } from '@nuclom/lib/api-handler';
import { type HealthCheckService, type HealthCheckStatus, healthChecks } from '@nuclom/lib/db/schema';
import { DatabaseError } from '@nuclom/lib/effect/errors';
import { Database, type DrizzleDB } from '@nuclom/lib/effect/services/database';
import { logger } from '@nuclom/lib/logger';
import { sql } from 'drizzle-orm';
import { Effect, Exit } from 'effect';
import { connection } from 'next/server';

export interface ServiceStatus {
  service: HealthCheckService;
  status: HealthCheckStatus;
  latencyMs: number;
  lastChecked: string;
  uptimePercent: number;
}

export interface StatusResponse {
  status: 'operational' | 'degraded' | 'outage';
  services: ServiceStatus[];
  lastUpdated: string;
  history: {
    date: string;
    status: 'operational' | 'degraded' | 'outage';
  }[];
}

// =============================================================================
// Helper functions (now take db as parameter for Effect pattern)
// =============================================================================

function getLatestStatus(
  db: DrizzleDB,
  service: HealthCheckService,
): Effect.Effect<ServiceStatus | null, DatabaseError> {
  return Effect.gen(function* () {
    const latest = yield* Effect.tryPromise({
      try: () =>
        db.query.healthChecks.findFirst({
          where: (hc, { eq }) => eq(hc.service, service),
          orderBy: (hc, { desc }) => [desc(hc.checkedAt)],
        }),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch latest status for ${service}`,
          operation: 'getLatestStatus',
          cause: error,
        }),
    });

    if (!latest) return null;

    // Calculate uptime for last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const checksLast24h = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(healthChecks)
          .where(
            sql`${healthChecks.service} = ${service} AND ${healthChecks.checkedAt} >= ${twentyFourHoursAgo.toISOString()}`,
          ),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch 24h checks for ${service}`,
          operation: 'getChecksLast24h',
          cause: error,
        }),
    });

    const healthyChecks = checksLast24h.filter((c) => c.status === 'healthy' || c.status === 'not_configured');
    const uptimePercent =
      checksLast24h.length > 0 ? Math.round((healthyChecks.length / checksLast24h.length) * 100) : 100;

    return {
      service: latest.service,
      status: latest.status,
      latencyMs: latest.latencyMs,
      lastChecked: latest.checkedAt.toISOString(),
      uptimePercent,
    };
  });
}

function getStatusHistory(db: DrizzleDB): Effect.Effect<StatusResponse['history'], DatabaseError> {
  return Effect.gen(function* () {
    // Get daily status for the last 90 days
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const dailyStats = yield* Effect.tryPromise({
      try: () =>
        db.execute(sql`
          SELECT
            DATE(checked_at) as date,
            COUNT(*) as total_checks,
            SUM(CASE WHEN status = 'healthy' OR status = 'not_configured' THEN 1 ELSE 0 END) as healthy_checks,
            SUM(CASE WHEN status = 'unhealthy' THEN 1 ELSE 0 END) as unhealthy_checks
          FROM health_checks
          WHERE service = 'overall' AND checked_at >= ${ninetyDaysAgo.toISOString()}
          GROUP BY DATE(checked_at)
          ORDER BY date DESC
          LIMIT 90
        `),
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch status history',
          operation: 'getStatusHistory',
          cause: error,
        }),
    });

    const rows = dailyStats as unknown as Array<{
      date: string;
      total_checks: number;
      healthy_checks: number;
      unhealthy_checks: number;
    }>;

    return rows.map((row) => {
      const healthyRatio = row.total_checks > 0 ? row.healthy_checks / row.total_checks : 1;

      let status: 'operational' | 'degraded' | 'outage';
      if (healthyRatio >= 0.99) {
        status = 'operational';
      } else if (healthyRatio >= 0.9) {
        status = 'degraded';
      } else {
        status = 'outage';
      }

      return { date: row.date, status };
    });
  });
}

// =============================================================================
// GET /api/status - Public status page endpoint
// =============================================================================

export async function GET() {
  await connection();

  const effect = Effect.gen(function* () {
    const startTime = performance.now();
    const { db } = yield* Database;

    // Get current status for each service in parallel
    const [dbStatus, storageStatus, aiStatus, overallStatus] = yield* Effect.all(
      [
        getLatestStatus(db, 'database'),
        getLatestStatus(db, 'storage'),
        getLatestStatus(db, 'ai'),
        getLatestStatus(db, 'overall'),
      ],
      { concurrency: 4 },
    );

    const services = [dbStatus, storageStatus, aiStatus].filter((s): s is ServiceStatus => s !== null);

    // If no health checks have been recorded, return default healthy status
    if (services.length === 0) {
      const now = new Date().toISOString();
      return {
        status: 'operational' as const,
        services: [
          {
            service: 'database' as const,
            status: 'healthy' as const,
            latencyMs: 0,
            lastChecked: now,
            uptimePercent: 100,
          },
          {
            service: 'storage' as const,
            status: 'healthy' as const,
            latencyMs: 0,
            lastChecked: now,
            uptimePercent: 100,
          },
          { service: 'ai' as const, status: 'healthy' as const, latencyMs: 0, lastChecked: now, uptimePercent: 100 },
        ],
        lastUpdated: now,
        history: [] as StatusResponse['history'],
      };
    }

    // Determine overall status
    const hasUnhealthy = services.some((s) => s.status === 'unhealthy');
    const hasDegraded = services.some((s) => s.status === 'degraded');

    let status: StatusResponse['status'];
    if (hasUnhealthy) {
      status = 'outage';
    } else if (hasDegraded) {
      status = 'degraded';
    } else {
      status = 'operational';
    }

    // Get historical data
    const history = yield* getStatusHistory(db);

    const durationMs = Math.round(performance.now() - startTime);
    logger.debug('Status API request completed', { durationMs, status });

    return {
      status,
      services,
      lastUpdated: overallStatus?.lastChecked || new Date().toISOString(),
      history,
    };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);

  // Custom exit handling for cache headers
  return Exit.match(exit, {
    onFailure: (cause) => {
      logger.error('Status API error', new Error(String(cause)));

      return Response.json(
        {
          status: 'outage',
          services: [],
          lastUpdated: new Date().toISOString(),
          history: [],
          error: 'Failed to fetch status',
        },
        {
          status: 503,
          headers: { 'Cache-Control': 'no-store' },
        },
      );
    },
    onSuccess: (data) => {
      return Response.json(data, {
        status: 200,
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
      });
    },
  });
}
