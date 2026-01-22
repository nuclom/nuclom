/**
 * Database Helpers
 *
 * Database utility functions for video processing workflow.
 */

import type { ProcessingStatus } from '@nuclom/lib/db/schema';
import { createWorkflowLogger } from '../workflow-logger';

const log = createWorkflowLogger('video-processing:db');

/**
 * Update the processing status of a video
 */
export async function updateProcessingStatus(videoId: string, status: ProcessingStatus, error?: string): Promise<void> {
  'use step';

  const { eq } = await import('drizzle-orm');
  const { db } = await import('@nuclom/lib/db');
  const { videos } = await import('@nuclom/lib/db/schema');

  await db
    .update(videos)
    .set({
      processingStatus: status,
      processingError: error || null,
      updatedAt: new Date(),
    })
    .where(eq(videos.id, videoId));
}

/**
 * Get organization ID from video if not provided in input.
 * This is a separate step for traceability.
 */
export async function getVideoOrganizationId(videoId: string): Promise<string | null> {
  'use step';

  const { db } = await import('@nuclom/lib/db');
  const video = await db.query.videos.findFirst({
    where: (v, { eq: eqOp }) => eqOp(v.id, videoId),
    columns: { organizationId: true },
  });
  return video?.organizationId ?? null;
}

/**
 * Update the content_item with processed video data (transcript, summary, tags).
 * This syncs the processed video data to the unified knowledge base.
 */
export async function updateContentItemWithProcessedData(
  videoId: string,
  organizationId: string,
  data: {
    transcript?: string;
    summary?: string;
    tags?: string[];
  },
): Promise<void> {
  'use step';

  try {
    const { Effect } = await import('effect');
    const { updateVideoContentItem } = await import('@nuclom/lib/effect/services');
    const { createPublicLayer } = await import('@nuclom/lib/api-handler');

    const effect = updateVideoContentItem(videoId, organizationId, data);
    const runnable = Effect.provide(effect, createPublicLayer());
    await Effect.runPromise(runnable);

    log.info({ videoId }, 'Updated content_item with processed video data');
  } catch (error) {
    // Log but don't fail - content sync is not critical to workflow completion
    log.warn({ videoId, error }, 'Failed to update content_item with processed data');
  }
}
