/**
 * Scheduled Video Cleanup Workflow using Workflow DevKit
 *
 * Automatically cleans up soft-deleted videos that have passed their
 * retention period. Uses the `sleep()` function to run daily without
 * consuming resources during wait periods.
 *
 * Benefits over cron:
 * - No external cron service needed
 * - Built-in observability
 * - Automatic recovery if server restarts
 * - Consumes no resources during sleep
 */

import { and, isNotNull, lt, sql } from "drizzle-orm";
import { sleep } from "workflow";
import { db } from "@/lib/db";
import { videos } from "@/lib/db/schema";

// =============================================================================
// Types
// =============================================================================

export interface CleanupResult {
  deletedCount: number;
  timestamp: Date;
}

// =============================================================================
// Helper Functions
// =============================================================================

async function cleanupExpiredVideos(): Promise<number> {
  const now = new Date();

  // Find videos where retentionUntil has passed
  const expiredVideos = await db
    .select({ id: videos.id, videoUrl: videos.videoUrl })
    .from(videos)
    .where(and(isNotNull(videos.deletedAt), isNotNull(videos.retentionUntil), lt(videos.retentionUntil, now)));

  if (expiredVideos.length === 0) {
    return 0;
  }

  // Delete videos from R2 storage
  const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;

  if (accountId && accessKeyId && secretAccessKey && bucketName) {
    const client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    // Delete files from storage
    for (const video of expiredVideos) {
      if (video.videoUrl) {
        try {
          // Extract key from URL
          const url = new URL(video.videoUrl);
          const key = url.pathname.startsWith("/") ? url.pathname.slice(1) : url.pathname;

          await client.send(
            new DeleteObjectCommand({
              Bucket: bucketName,
              Key: key,
            }),
          );
        } catch (error) {
          console.error(`[Cleanup] Failed to delete file for video ${video.id}:`, error);
        }
      }
    }
  }

  // Permanently delete video records from database
  await db
    .delete(videos)
    .where(and(isNotNull(videos.deletedAt), isNotNull(videos.retentionUntil), lt(videos.retentionUntil, now)));

  return expiredVideos.length;
}

// =============================================================================
// Scheduled Workflow
// =============================================================================

/**
 * Run video cleanup on a daily schedule.
 *
 * This workflow runs indefinitely, sleeping for 24 hours between cleanups.
 * The sleep consumes no resources - the workflow is suspended and resumed
 * by the Workflow DevKit runtime.
 *
 * To start this workflow, call it once (e.g., on app startup or via admin endpoint).
 * It will then run forever, cleaning up expired videos daily.
 */
export async function scheduledCleanupWorkflow(): Promise<never> {
  "use workflow";

  console.log("[Cleanup Workflow] Starting scheduled video cleanup workflow");

  while (true) {
    try {
      const deletedCount = await cleanupExpiredVideos();
      console.log(`[Cleanup Workflow] Deleted ${deletedCount} expired videos at ${new Date().toISOString()}`);
      "use step";
    } catch (error) {
      console.error("[Cleanup Workflow] Error during cleanup:", error);
      "use step";
    }

    // Sleep for 24 hours
    await sleep("24 hours");
  }
}

/**
 * Run a single cleanup operation (for manual triggering or testing).
 */
export async function runCleanupOnce(): Promise<CleanupResult> {
  "use workflow";

  const deletedCount = await cleanupExpiredVideos();

  return {
    deletedCount,
    timestamp: new Date(),
  };
}
