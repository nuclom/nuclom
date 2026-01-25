import {
  generatePresignedThumbnailUrl,
  generatePresignedVideoUrl,
  handleEffectExitWithOptions,
  runPublicApiEffect,
} from '@nuclom/lib/api-handler';
import { NotFoundError } from '@nuclom/lib/effect/errors';
import { Storage } from '@nuclom/lib/effect/services/storage';
import { VideoRepository } from '@nuclom/lib/effect/services/video-repository';
import { VideoShareLinksRepository } from '@nuclom/lib/effect/services/video-share-links-repository';
import { Effect, Option } from 'effect';
import { connection, type NextRequest, NextResponse } from 'next/server';

// =============================================================================
// GET /api/embed/[id] - Get embed video data
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connection();

  const { id } = await params;

  const effect = Effect.gen(function* () {
    const shareLinkRepo = yield* VideoShareLinksRepository;
    const videoRepo = yield* VideoRepository;
    const storage = yield* Storage;

    const shareLinkOption = yield* shareLinkRepo.getShareLinkOption(id);
    const shareLink = Option.isSome(shareLinkOption) ? shareLinkOption.value : null;
    const videoId = shareLink ? shareLink.videoId : id;
    const video = yield* videoRepo.getVideo(videoId);

    let isShareLink = false;

    if (shareLink) {
      // Validate share link
      if (shareLink.status !== 'active') {
        return yield* Effect.fail(new NotFoundError({ message: 'This video is no longer available', entity: 'video' }));
      }

      if (shareLink.expiresAt && new Date(shareLink.expiresAt) < new Date()) {
        return yield* Effect.fail(new NotFoundError({ message: 'This video link has expired', entity: 'video' }));
      }

      if (shareLink.maxViews && (shareLink.viewCount ?? 0) >= shareLink.maxViews) {
        return yield* Effect.fail(
          new NotFoundError({ message: 'This video has reached its view limit', entity: 'video' }),
        );
      }

      isShareLink = true;
    }

    if (!video.videoUrl) {
      return yield* Effect.fail(new NotFoundError({ message: 'Video not found', entity: 'video' }));
    }

    // Generate presigned URLs using helpers
    const presignedVideoUrl = yield* generatePresignedVideoUrl(storage, video.videoUrl);
    const presignedThumbnailUrl = yield* generatePresignedThumbnailUrl(storage, video.thumbnailUrl);

    if (!presignedVideoUrl) {
      return yield* Effect.fail(new NotFoundError({ message: 'Failed to generate video URL', entity: 'video' }));
    }

    return {
      success: true,
      data: {
        id: video.id,
        title: video.title,
        videoUrl: presignedVideoUrl,
        thumbnailUrl: presignedThumbnailUrl,
        duration: video.duration,
        organization: {
          name: video.organization?.name || 'Unknown',
          slug: video.organization?.slug || '',
        },
        isShareLink,
      },
    };
  });

  const exit = await runPublicApiEffect(effect);
  const response = handleEffectExitWithOptions(exit, {
    successHeaders: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });

  return response;
}

// Handle preflight requests for CORS
export async function OPTIONS() {
  const response = new NextResponse(null, { status: 200 });
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}
