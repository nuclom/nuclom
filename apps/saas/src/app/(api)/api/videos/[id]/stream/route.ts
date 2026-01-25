/**
 * Video Stream URL API
 *
 * Returns a presigned URL for streaming video content from R2.
 * URLs are valid for 1 hour and support range requests for seeking.
 */

import { handleEffectExitWithOptions, runPublicApiEffect } from '@nuclom/lib/api-handler';
import { NotFoundError } from '@nuclom/lib/effect/errors';
import { Storage } from '@nuclom/lib/effect/services/storage';
import { VideoRepository } from '@nuclom/lib/effect/services/video-repository';
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

    // Get storage service and generate presigned URLs
    const storage = yield* Storage;
    const streamUrl = yield* storage.generatePresignedDownloadUrl(video.videoUrl, PRESIGNED_URL_EXPIRY);

    // Generate thumbnail URL if available
    let thumbnailStreamUrl: string | null = null;
    if (video.thumbnailUrl) {
      thumbnailStreamUrl = yield* storage.generatePresignedDownloadUrl(video.thumbnailUrl, PRESIGNED_URL_EXPIRY);
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
