import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { connection } from "next/server";
import { env } from "@/lib/env/server";
import { logger } from "@/lib/logger";

export interface R2HealthStatus {
  status: "healthy" | "unhealthy" | "not_configured";
  latencyMs: number;
  timestamp: string;
  details?: {
    bucket?: string;
    region?: string;
  };
  error?: string;
}

export async function GET() {
  await connection();

  const startTime = performance.now();

  // Check if R2 is configured
  const isConfigured = env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET_NAME;

  if (!isConfigured) {
    const response: R2HealthStatus = {
      status: "not_configured",
      latencyMs: 0,
      timestamp: new Date().toISOString(),
      error: "R2 storage is not configured",
    };

    return Response.json(response, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  }

  try {
    // Create S3 client for R2
    const r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });

    // Check bucket exists and is accessible
    const command = new HeadBucketCommand({
      Bucket: env.R2_BUCKET_NAME,
    });

    await r2Client.send(command);

    const latencyMs = Math.round(performance.now() - startTime);

    const response: R2HealthStatus = {
      status: "healthy",
      latencyMs,
      timestamp: new Date().toISOString(),
      details: {
        bucket: env.R2_BUCKET_NAME,
        region: "auto",
      },
    };

    logger.debug("R2 health check passed", { latencyMs, bucket: env.R2_BUCKET_NAME });

    return Response.json(response, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    const latencyMs = Math.round(performance.now() - startTime);
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error("R2 health check failed", error instanceof Error ? error : new Error(errorMessage));

    const response: R2HealthStatus = {
      status: "unhealthy",
      latencyMs,
      timestamp: new Date().toISOString(),
      error: errorMessage,
    };

    return Response.json(response, {
      status: 503,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  }
}
