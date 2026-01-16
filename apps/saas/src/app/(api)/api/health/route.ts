import { sql } from 'drizzle-orm';
import { Effect, Exit } from 'effect';
import { connection } from 'next/server';
import { createPublicLayer } from '@/lib/api-handler';
import { Database } from '@/lib/effect/services/database';
import { env } from '@/lib/env/server';
import { logger } from '@/lib/logger';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: boolean;
    storage: boolean;
    ai: boolean;
  };
  timestamp: string;
  version?: string;
  durationMs?: number;
}

/**
 * GET /api/health - Health check endpoint
 *
 * Returns the health status of all services using Effect-TS pattern
 * for consistent error handling and observability.
 */
export async function GET() {
  await connection();

  const effect = Effect.gen(function* () {
    const startTime = performance.now();
    const checks = {
      database: false,
      storage: true, // Assume healthy unless we add a check
      ai: true, // Assume healthy unless we add a check
    };

    // Database check using Effect service
    const { db } = yield* Database;
    const dbCheck = yield* Effect.tryPromise({
      try: () => db.execute(sql`SELECT 1`),
      catch: (error) => error,
    }).pipe(
      Effect.match({
        onSuccess: () => true,
        onFailure: (error) => {
          logger.error('Health check failed: database', error instanceof Error ? error : new Error(String(error)));
          return false;
        },
      }),
    );
    checks.database = dbCheck;

    // Determine overall status
    const allHealthy = Object.values(checks).every(Boolean);
    const someHealthy = Object.values(checks).some(Boolean);

    let status: HealthStatus['status'];
    if (allHealthy) {
      status = 'healthy';
    } else if (someHealthy) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    const durationMs = Math.round(performance.now() - startTime);

    logger.info('Health check completed', {
      status,
      checks,
      durationMs,
    });

    return {
      status,
      checks,
      timestamp: new Date().toISOString(),
      version: env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'dev',
      durationMs,
    } satisfies HealthStatus;
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);

  // Custom handling for health check - we want proper HTTP status codes
  return Exit.match(exit, {
    onFailure: () => {
      const response: HealthStatus = {
        status: 'unhealthy',
        checks: { database: false, storage: false, ai: false },
        timestamp: new Date().toISOString(),
        version: env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'dev',
      };
      return Response.json(response, {
        status: 503,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      });
    },
    onSuccess: (data: HealthStatus) => {
      return Response.json(data, {
        status: data.status === 'unhealthy' ? 503 : 200,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      });
    },
  });
}
