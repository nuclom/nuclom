/**
 * Video Stream URL API
 *
 * Returns a presigned URL for streaming video content from R2.
 * URLs are valid for 1 hour and support range requests for seeking.
 */

import { handleEffectExitWithOptions, runPublicApiEffect } from '@nuclom/lib/api-handler';
import { NotFoundError, Storage, VideoRepository } from '@nuclom/lib/effect';
import { Effect } from 'effect';
import type { NextRequest } from 'next/server';

// URL expiration time in seconds (1 hour)
const PRESIGNED_URL_EXPIRY = 3600;

// =============================================================================
// GET /api/videos/[id]/stream - Get presigned URL for video streaming
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);

    // Get video from repository
    const videoRepo = yield* VideoRepository;
    const video = yield* videoRepo.getVideo(resolvedParams.id);

    if (!video.videoUrl) {
      return yield* Effect.fail(
        new NotFoundError({
          message: 'Video file not found',
          entity: 'VideoFile',
          id: resolvedParams.id,
        }),
      );
    }

    // Get storage service
    const storage = yield* Storage;

    // Extract the R2 key from the stored value
    // Supports both formats:
    // - New format: just the file key (e.g., "org-id/videos/123-video.mp4")
    // - Legacy format: full URL (e.g., "https://{bucket}.{accountId}.r2.cloudflarestorage.com/{key}")
    let fileKey: string;
    if (video.videoUrl.includes('.r2.cloudflarestorage.com/')) {
      const extractedKey = storage.extractKeyFromUrl(video.videoUrl);
      if (!extractedKey) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Invalid video URL format',
            entity: 'VideoFile',
            id: resolvedParams.id,
          }),
        );
      }
      fileKey = extractedKey;
    } else {
      // New format: videoUrl is already the file key
      fileKey = video.videoUrl;
    }

    // Generate presigned URL for streaming
    const streamUrl = yield* storage.generatePresignedDownloadUrl(fileKey, PRESIGNED_URL_EXPIRY);

    // Also generate thumbnail URL if available
    let thumbnailStreamUrl: string | null = null;
    if (video.thumbnailUrl) {
      let thumbnailKey: string;
      if (video.thumbnailUrl.includes('.r2.cloudflarestorage.com/')) {
        const extractedKey = storage.extractKeyFromUrl(video.thumbnailUrl);
        if (extractedKey) {
          thumbnailKey = extractedKey;
          thumbnailStreamUrl = yield* storage.generatePresignedDownloadUrl(thumbnailKey, PRESIGNED_URL_EXPIRY);
        }
      } else {
        // New format: thumbnailUrl is already the file key
        thumbnailKey = video.thumbnailUrl;
        thumbnailStreamUrl = yield* storage.generatePresignedDownloadUrl(thumbnailKey, PRESIGNED_URL_EXPIRY);
      }
    }

    return {
      videoUrl: streamUrl,
      thumbnailUrl: thumbnailStreamUrl,
      expiresIn: PRESIGNED_URL_EXPIRY,
    };
  });

  const exit = await runPublicApiEffect(effect);
  return handleEffectExitWithOptions(exit, {
    successHeaders: {
      // Short cache since URL expires
      'Cache-Control': 'private, max-age=300',
    },
  });
}
