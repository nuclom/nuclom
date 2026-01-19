import { db } from '@nuclom/lib/db';
import { logger } from '@nuclom/lib/logger';
import { sql } from 'drizzle-orm';

export interface DatabaseHealthStatus {
  status: 'healthy' | 'unhealthy';
  latencyMs: number;
  timestamp: string;
  details?: {
    connectionPool?: string;
    activeConnections?: number;
  };
  error?: string;
}

export async function GET() {
  const startTime = performance.now();

  try {
    // Simple connectivity check
    await db.execute(sql`SELECT 1`);

    const latencyMs = Math.round(performance.now() - startTime);

    const response: DatabaseHealthStatus = {
      status: 'healthy',
      latencyMs,
      timestamp: new Date().toISOString(),
    };

    logger.debug('Database health check passed', { latencyMs });

    return Response.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    const latencyMs = Math.round(performance.now() - startTime);
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Database health check failed', error instanceof Error ? error : new Error(errorMessage));

    const response: DatabaseHealthStatus = {
      status: 'unhealthy',
      latencyMs,
      timestamp: new Date().toISOString(),
      error: errorMessage,
    };

    return Response.json(response, {
      status: 503,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  }
}
