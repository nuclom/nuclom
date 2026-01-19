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

import { createWorkflowLogger } from './workflow-logger';

const log = createWorkflowLogger('cleanup-workflow');

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
  'use step';

  const { and, isNotNull, lt } = await import('drizzle-orm');
  const { db } = await import('@nuclom/lib/db');
  const { videos } = await import('@nuclom/lib/db/schema');
  const { env } = await import('@nuclom/lib/env/server');

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
  const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');

  const accountId = env.R2_ACCOUNT_ID;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  const bucketName = env.R2_BUCKET_NAME;

  if (accountId && accessKeyId && secretAccessKey && bucketName) {
    const client = new S3Client({
      region: 'auto',
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
          const key = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;

          await client.send(
            new DeleteObjectCommand({
              Bucket: bucketName,
              Key: key,
            }),
          );
        } catch (error) {
          log.error({ videoId: video.id, error }, 'Failed to delete file for video');
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
 * Safely run cleanup and log any errors.
 * Separate step to handle errors internally without breaking workflow tracing.
 */
async function safeCleanupExpiredVideos(): Promise<number> {
  'use step';

  const { and, isNotNull, lt } = await import('drizzle-orm');
  const { db } = await import('@nuclom/lib/db');
  const { videos } = await import('@nuclom/lib/db/schema');
  const { env } = await import('@nuclom/lib/env/server');

  try {
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
    const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');

    const accountId = env.R2_ACCOUNT_ID;
    const accessKeyId = env.R2_ACCESS_KEY_ID;
    const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
    const bucketName = env.R2_BUCKET_NAME;

    if (accountId && accessKeyId && secretAccessKey && bucketName) {
      const client = new S3Client({
        region: 'auto',
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
            const key = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;

            await client.send(
              new DeleteObjectCommand({
                Bucket: bucketName,
                Key: key,
              }),
            );
          } catch (error) {
            log.error({ videoId: video.id, error }, 'Failed to delete file for video');
          }
        }
      }
    }

    // Permanently delete video records from database
    await db
      .delete(videos)
      .where(and(isNotNull(videos.deletedAt), isNotNull(videos.retentionUntil), lt(videos.retentionUntil, now)));

    return expiredVideos.length;
  } catch (error) {
    log.error({ error }, 'Error during cleanup');
    return 0;
  }
}

/**
 * Run video cleanup once per cron invocation.
 *
 * This workflow executes once and exits - cron handles the daily scheduling.
 * Each invocation cleans up videos that have passed their retention period.
 *
 * IMPORTANT: This workflow is designed to run once per cron invocation.
 * Do NOT add infinite loops - the cron schedule handles periodic execution.
 */
export async function scheduledCleanupWorkflow(): Promise<CleanupResult> {
  'use workflow';

  log.info({}, 'Starting scheduled video cleanup workflow');

  // Run cleanup - errors are handled inside the step
  const deletedCount = await safeCleanupExpiredVideos();
  log.info({ deletedCount, timestamp: new Date().toISOString() }, 'Cleanup cycle completed');

  return {
    deletedCount,
    timestamp: new Date(),
  };
}

/**
 * Run a single cleanup operation (for manual triggering or testing).
 */
export async function runCleanupOnce(): Promise<CleanupResult> {
  'use workflow';

  const deletedCount = await cleanupExpiredVideos();

  return {
    deletedCount,
    timestamp: new Date(),
  };
}
