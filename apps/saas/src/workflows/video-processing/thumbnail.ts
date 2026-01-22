/**
 * Thumbnail Generation
 *
 * Functions for generating and saving video thumbnails using Replicate.
 */

import { createWorkflowLogger } from '../workflow-logger';

const log = createWorkflowLogger('video-processing:thumbnail');

/**
 * Generate and upload a thumbnail for a video using Replicate's frame extractor
 */
export async function generateAndUploadThumbnail(
  videoId: string,
  videoUrl: string,
  organizationId: string,
): Promise<string | null> {
  'use step';

  const { env } = await import('@nuclom/lib/env/server');
  const replicateToken = env.REPLICATE_API_TOKEN;
  const accountId = env.R2_ACCOUNT_ID;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  const bucketName = env.R2_BUCKET_NAME;

  if (!replicateToken) {
    log.info({}, 'Replicate not configured, skipping thumbnail generation');
    return null;
  }

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    log.info({}, 'R2 storage not configured, skipping thumbnail generation');
    return null;
  }

  try {
    const { default: Replicate } = await import('replicate');
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

    const replicate = new Replicate({ auth: replicateToken });

    // Use lucataco/frame-extractor to extract a frame as a static image thumbnail
    // This is fast (uses OpenCV) and produces a static image instead of a GIF
    // Note: Only supports first/last frame, not arbitrary timestamps
    const FRAME_EXTRACTOR_MODEL = 'lucataco/frame-extractor';

    const output = await replicate.run(FRAME_EXTRACTOR_MODEL as `${string}/${string}`, {
      input: {
        video: videoUrl,
        return_first_frame: false, // Use last frame to avoid black intro screens
      },
    });

    // The model returns a single URI string
    const generatedUrl = typeof output === 'string' ? output : null;

    if (!generatedUrl) {
      log.warn({ videoId }, 'No thumbnail URL returned from Replicate');
      return null;
    }

    // Download the generated thumbnail
    const response = await fetch(generatedUrl);
    if (!response.ok) {
      log.warn({ videoId, status: response.status }, 'Failed to download generated thumbnail');
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Determine content type and extension (frame-extractor returns PNG images)
    const contentType = response.headers.get('content-type') || 'image/png';
    const extension = contentType.includes('png') ? 'png' : contentType.includes('gif') ? 'gif' : 'jpg';

    // Upload to R2 storage
    const thumbnailKey = `${organizationId}/thumbnails/${Date.now()}-${videoId}.${extension}`;

    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: thumbnailKey,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    const thumbnailUrl = `https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${thumbnailKey}`;

    log.info({ videoId, thumbnailUrl }, 'Thumbnail generated and uploaded successfully');

    return thumbnailUrl;
  } catch (error) {
    log.error({ error, videoId }, 'Failed to generate thumbnail, continuing without it');
    return null;
  }
}

/**
 * Save the thumbnail URL to the video record
 */
export async function saveThumbnailUrl(videoId: string, thumbnailUrl: string): Promise<void> {
  'use step';

  const { eq } = await import('drizzle-orm');
  const { db } = await import('@nuclom/lib/db');
  const { videos } = await import('@nuclom/lib/db/schema');

  await db
    .update(videos)
    .set({
      thumbnailUrl,
      updatedAt: new Date(),
    })
    .where(eq(videos.id, videoId));
}
