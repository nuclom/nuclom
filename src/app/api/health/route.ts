import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { env } from "@/lib/env/server";
import { logger } from "@/lib/logger";

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  checks: {
    database: boolean;
    storage: boolean;
    ai: boolean;
  };
  timestamp: string;
  version?: string;
}

export async function GET() {
  const startTime = performance.now();
  const checks = {
    database: false,
    storage: true, // Assume healthy unless we add a check
    ai: true, // Assume healthy unless we add a check
  };

  // Database check
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = true;
  } catch (error) {
    logger.error("Health check failed: database", error instanceof Error ? error : new Error(String(error)));
    checks.database = false;
  }

  // Determine overall status
  const allHealthy = Object.values(checks).every(Boolean);
  const someHealthy = Object.values(checks).some(Boolean);

  let status: HealthStatus["status"];
  if (allHealthy) {
    status = "healthy";
  } else if (someHealthy) {
    status = "degraded";
  } else {
    status = "unhealthy";
  }

  const durationMs = Math.round(performance.now() - startTime);
  const response: HealthStatus = {
    status,
    checks,
    timestamp: new Date().toISOString(),
    version: env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev",
  };

  logger.info("Health check completed", {
    status,
    checks,
    durationMs,
  });

  return Response.json(response, {
    status: status === "healthy" ? 200 : status === "degraded" ? 200 : 503,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
