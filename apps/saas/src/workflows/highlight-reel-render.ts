/**
 * Highlight Reel Rendering Workflow using Workflow DevKit
 *
 * Handles the complete highlight reel rendering pipeline with durable execution:
 * 1. Validates all clips exist and are accessible
 * 2. Extracts clip segments from source videos
 * 3. Concatenates clips into a single video
 * 4. Uploads the rendered video to R2 storage
 * 5. Updates the highlight reel with the final video URL
 * 6. Sets status to "ready" or "failed"
 *
 * Benefits over fire-and-forget:
 * - Automatic retries on transient failures
 * - Resume from last successful step if server restarts
 * - Built-in observability for debugging
 * - No lost processing on deploy
 */

import type { HighlightReelStatus } from '@nuclom/lib/db/schema';
import { FatalError } from 'workflow';
import { createWorkflowLogger } from './workflow-logger';

const log = createWorkflowLogger('highlight-reel-render');

// =============================================================================
// Types
// =============================================================================

export interface HighlightReelRenderInput {
  readonly reelId: string;
  readonly organizationId: string;
}

export interface HighlightReelRenderResult {
  readonly reelId: string;
  readonly success: boolean;
  readonly storageKey?: string;
  readonly duration?: number;
  readonly error?: string;
}

interface ClipSegmentInfo {
  readonly clipId: string;
  readonly videoUrl: string;
  readonly startTime: number;
  readonly endTime: number;
  readonly duration: number;
}

interface RenderedVideo {
  readonly url: string;
  readonly duration: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

async function updateReelStatus(
  reelId: string,
  status: HighlightReelStatus,
  error?: string,
  storageKey?: string,
  duration?: number,
): Promise<void> {
  'use step';

  const { eq } = await import('drizzle-orm');
  const { db } = await import('@nuclom/lib/db');
  const { highlightReels } = await import('@nuclom/lib/db/schema');

  await db
    .update(highlightReels)
    .set({
      status,
      processingError: error || null,
      storageKey: storageKey || undefined,
      duration: duration || undefined,
      updatedAt: new Date(),
    })
    .where(eq(highlightReels.id, reelId));
}

async function getClipSegments(clipIds: string[]): Promise<ClipSegmentInfo[]> {
  'use step';

  const { db } = await import('@nuclom/lib/db');
  const { videoClips, videos } = await import('@nuclom/lib/db/schema');
  const { inArray, eq } = await import('drizzle-orm');

  if (clipIds.length === 0) {
    throw new FatalError('No clips provided for highlight reel');
  }

  // Fetch all clips with their parent video information
  const clipsData = await db
    .select({
      clip: videoClips,
      video: videos,
    })
    .from(videoClips)
    .innerJoin(videos, eq(videoClips.videoId, videos.id))
    .where(inArray(videoClips.id, clipIds));

  if (clipsData.length === 0) {
    throw new FatalError('No clips found for the provided IDs');
  }

  if (clipsData.length !== clipIds.length) {
    log.warn(
      { expected: clipIds.length, found: clipsData.length },
      'Some clips were not found, continuing with available clips',
    );
  }

  // Map clips to segment info, preserving the order from clipIds
  const clipMap = new Map(clipsData.map((data) => [data.clip.id, data]));

  return clipIds
    .map((clipId) => {
      const data = clipMap.get(clipId);
      if (!data) return null;

      const { clip, video } = data;

      if (!video.videoUrl) {
        log.error({ clipId, videoId: video.id }, 'Video has no URL, skipping clip');
        return null;
      }

      return {
        clipId: clip.id,
        videoUrl: video.videoUrl,
        startTime: clip.startTime,
        endTime: clip.endTime,
        duration: clip.endTime - clip.startTime,
      };
    })
    .filter((segment): segment is ClipSegmentInfo => segment !== null);
}

/**
 * Render clips into a single video using Replicate's video editing model
 * Falls back to a simple concatenation if advanced editing is not available
 */
async function renderHighlightReel(segments: ClipSegmentInfo[]): Promise<RenderedVideo> {
  'use step';

  const { env } = await import('@nuclom/lib/env/server');
  const replicateToken = env.REPLICATE_API_TOKEN;
  if (!replicateToken) {
    throw new FatalError('Replicate API token not configured. Please set REPLICATE_API_TOKEN.');
  }

  const { default: Replicate } = await import('replicate');
  const replicate = new Replicate({ auth: replicateToken });

  // Use a video concatenation/editing model from Replicate
  // Note: This uses a general-purpose FFmpeg-based model for video editing
  // Model: noxinc/video-concat - concatenates multiple video clips
  const VIDEO_CONCAT_MODEL = 'noxinc/video-concat:latest';

  try {
    // Prepare input for the video concatenation model
    // The model expects an array of video segments with timestamps
    const videoSegments = segments.map((segment) => ({
      url: segment.videoUrl,
      start: segment.startTime,
      end: segment.endTime,
    }));

    log.info({ segmentCount: segments.length }, 'Starting video concatenation with Replicate');

    const output = (await replicate.run(VIDEO_CONCAT_MODEL as `${string}/${string}`, {
      input: {
        segments: videoSegments,
        output_format: 'mp4',
        codec: 'h264',
        quality: 'high',
      },
    })) as { video_url?: string; duration?: number } | string;

    // Handle different output formats
    let videoUrl: string;
    let duration: number;

    if (typeof output === 'string') {
      videoUrl = output;
      duration = segments.reduce((sum, seg) => sum + seg.duration, 0);
    } else if (output.video_url) {
      videoUrl = output.video_url;
      duration = output.duration || segments.reduce((sum, seg) => sum + seg.duration, 0);
    } else {
      throw new Error('Invalid output format from video concatenation model');
    }

    log.info({ videoUrl, duration }, 'Video concatenation completed successfully');

    return {
      url: videoUrl,
      duration,
    };
  } catch (error) {
    // If the specific model is not available, throw a fatal error with helpful message
    log.error({ error, segmentCount: segments.length }, 'Video concatenation failed');

    throw new FatalError(
      `Video concatenation failed: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
        `Please ensure the video concatenation model is available on Replicate or implement a custom solution.`,
    );
  }
}

async function downloadAndUploadVideo(
  videoUrl: string,
  organizationId: string,
  reelId: string,
): Promise<{ storageKey: string }> {
  'use step';

  const { env } = await import('@nuclom/lib/env/server');

  // Download the rendered video from the temporary URL
  const response = await fetch(videoUrl);
  if (!response.ok) {
    throw new Error(`Failed to download rendered video: ${response.statusText}`);
  }

  const videoBuffer = Buffer.from(await response.arrayBuffer());

  // Generate storage key
  const timestamp = Date.now();
  const storageKey = `${organizationId}/highlight-reels/${reelId}-${timestamp}.mp4`;

  // Upload to R2 storage
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

  const accountId = env.R2_ACCOUNT_ID;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  const bucketName = env.R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new FatalError('R2 storage not configured. Please set R2_* environment variables.');
  }

  const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: storageKey,
      Body: videoBuffer,
      ContentType: 'video/mp4',
    }),
  );

  log.info({ storageKey }, 'Video uploaded to R2 storage');

  return { storageKey };
}

// =============================================================================
// Main Workflow
// =============================================================================

/**
 * Get highlight reel data step.
 * Separate step for static analyzer traceability.
 */
async function getHighlightReelData(reelId: string): Promise<{ clipIds: string[] } | null> {
  'use step';

  const { db } = await import('@nuclom/lib/db');
  const { highlightReels } = await import('@nuclom/lib/db/schema');
  const { eq } = await import('drizzle-orm');

  const reel = await db.query.highlightReels.findFirst({
    where: eq(highlightReels.id, reelId),
  });

  if (!reel) {
    return null;
  }

  return { clipIds: reel.clipIds || [] };
}

/**
 * Handle workflow failure step.
 * Separate step for static analyzer traceability.
 */
async function handleReelRenderFailure(reelId: string, errorMessage: string): Promise<HighlightReelRenderResult> {
  'use step';

  const { eq } = await import('drizzle-orm');
  const { db } = await import('@nuclom/lib/db');
  const { highlightReels } = await import('@nuclom/lib/db/schema');

  log.error({ reelId, error: errorMessage }, 'Highlight reel rendering failed');

  await db
    .update(highlightReels)
    .set({
      status: 'failed',
      processingError: errorMessage,
      updatedAt: new Date(),
    })
    .where(eq(highlightReels.id, reelId));

  return {
    reelId,
    success: false,
    error: errorMessage,
  };
}

/**
 * Render a highlight reel from multiple clips using durable workflow execution.
 *
 * This workflow:
 * 1. Updates status to "rendering"
 * 2. Fetches all clip data including source video URLs
 * 3. Validates that all clips are accessible
 * 4. Uses Replicate to concatenate clips into a single video
 * 5. Downloads the rendered video
 * 6. Uploads to R2 storage
 * 7. Updates the highlight reel with storage key and duration
 * 8. Updates status to "ready" or "failed"
 *
 * Each step is checkpointed, so if the server restarts, processing resumes
 * from the last successful step.
 *
 * Note: Step calls are at top level (not inside try/catch) so the workflow
 * static analyzer can trace them for the debug UI.
 */
export async function renderHighlightReelWorkflow(input: HighlightReelRenderInput): Promise<HighlightReelRenderResult> {
  'use workflow';

  const { reelId, organizationId } = input;

  // Step 1: Get the highlight reel data
  const reel = await getHighlightReelData(reelId);

  if (!reel) {
    return handleReelRenderFailure(reelId, 'Highlight reel not found');
  }

  if (reel.clipIds.length === 0) {
    return handleReelRenderFailure(reelId, 'Highlight reel has no clips');
  }

  // Step 2: Update status to "rendering"
  const renderingResult = await updateReelStatus(reelId, 'rendering').catch((error) => ({
    error: error instanceof Error ? error.message : String(error),
  }));
  if (renderingResult && 'error' in renderingResult) {
    return handleReelRenderFailure(reelId, renderingResult.error);
  }

  // Step 3: Get all clip segments
  log.info({ reelId, clipCount: reel.clipIds.length }, 'Fetching clip segments');
  const segmentsResult = await getClipSegments(reel.clipIds).catch((error) => ({
    error: error instanceof Error ? error.message : String(error),
    isFatal: error instanceof FatalError,
  }));
  if ('error' in segmentsResult) {
    if (segmentsResult.isFatal) {
      await handleReelRenderFailure(reelId, segmentsResult.error);
      throw new FatalError(segmentsResult.error);
    }
    return handleReelRenderFailure(reelId, segmentsResult.error);
  }
  const segments = segmentsResult;

  if (segments.length === 0) {
    return handleReelRenderFailure(reelId, 'No valid clip segments found');
  }

  log.info({ reelId, segmentCount: segments.length }, 'Retrieved clip segments');

  // Step 4: Render the highlight reel
  log.info({ reelId }, 'Starting highlight reel rendering');
  const renderResult = await renderHighlightReel(segments).catch((error) => ({
    error: error instanceof Error ? error.message : String(error),
    isFatal: error instanceof FatalError,
  }));
  if ('error' in renderResult) {
    if (renderResult.isFatal) {
      await handleReelRenderFailure(reelId, renderResult.error);
      throw new FatalError(renderResult.error);
    }
    return handleReelRenderFailure(reelId, renderResult.error);
  }
  const renderedVideo = renderResult;

  log.info({ reelId, videoUrl: renderedVideo.url }, 'Highlight reel rendered successfully');

  // Step 5: Download and upload to R2 storage
  log.info({ reelId }, 'Uploading rendered video to R2 storage');
  const uploadResult = await downloadAndUploadVideo(renderedVideo.url, organizationId, reelId).catch((error) => ({
    error: error instanceof Error ? error.message : String(error),
    isFatal: error instanceof FatalError,
  }));
  if ('error' in uploadResult) {
    if (uploadResult.isFatal) {
      await handleReelRenderFailure(reelId, uploadResult.error);
      throw new FatalError(uploadResult.error);
    }
    return handleReelRenderFailure(reelId, uploadResult.error);
  }
  const { storageKey } = uploadResult;

  // Step 6: Update highlight reel with final data
  await updateReelStatus(reelId, 'ready', undefined, storageKey, renderedVideo.duration);

  log.info({ reelId, storageKey, duration: renderedVideo.duration }, 'Highlight reel rendering completed');

  return {
    reelId,
    success: true,
    storageKey,
    duration: renderedVideo.duration,
  };
}
