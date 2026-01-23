import { createPublicLayer } from '@nuclom/lib/api-handler';
import { Storage, VideoRepository, VideoShareLinksRepository } from '@nuclom/lib/effect';
import { logger } from '@nuclom/lib/logger';
import { Effect, Option } from 'effect';
import { connection, type NextRequest, NextResponse } from 'next/server';

// =============================================================================
// GET /api/embed/[id] - Get embed video data
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connection();

  const { id } = await params;
  const PublicLayer = createPublicLayer();

  try {
    const { shareLink, video } = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* () {
          const shareLinkRepo = yield* VideoShareLinksRepository;
          const videoRepo = yield* VideoRepository;

          const shareLinkOption = yield* shareLinkRepo.getShareLinkOption(id);
          const resolvedShareLink = Option.isSome(shareLinkOption) ? shareLinkOption.value : null;
          const videoId = resolvedShareLink ? resolvedShareLink.videoId : id;
          const resolvedVideo = yield* videoRepo.getVideo(videoId);

          return { shareLink: resolvedShareLink, video: resolvedVideo };
        }),
        PublicLayer,
      ),
    );

    let isShareLink = false;

    if (shareLink) {
      // Validate share link
      if (shareLink.status !== 'active') {
        return NextResponse.json({ success: false, error: 'This video is no longer available' }, { status: 410 });
      }

      if (shareLink.expiresAt && new Date(shareLink.expiresAt) < new Date()) {
        return NextResponse.json({ success: false, error: 'This video link has expired' }, { status: 410 });
      }

      if (shareLink.maxViews && (shareLink.viewCount ?? 0) >= shareLink.maxViews) {
        return NextResponse.json({ success: false, error: 'This video has reached its view limit' }, { status: 410 });
      }

      isShareLink = true;
    }

    if (!video.videoUrl) {
      return NextResponse.json({ success: false, error: 'Video not found' }, { status: 404 });
    }

    // Capture video URL (we've already validated it's not null above)
    // TypeScript doesn't narrow after the early return, so we assert
    const videoUrlValue = video.videoUrl as string;

    // Generate presigned URLs for video and thumbnail
    const presignedUrlEffect = Effect.gen(function* () {
      const storage = yield* Storage;

      const presignedVideoUrl = yield* storage.generatePresignedDownloadUrl(videoUrlValue, 3600);

      let presignedThumbnailUrl: string | null = null;
      if (video.thumbnailUrl) {
        presignedThumbnailUrl = yield* storage.generatePresignedDownloadUrl(video.thumbnailUrl, 3600);
      }

      return { videoUrl: presignedVideoUrl, thumbnailUrl: presignedThumbnailUrl };
    });

    const runnable = Effect.provide(presignedUrlEffect, PublicLayer);
    const presignedUrls = await Effect.runPromise(runnable);

    if (!presignedUrls.videoUrl) {
      return NextResponse.json({ success: false, error: 'Failed to generate video URL' }, { status: 500 });
    }

    // Return embed data with CORS headers for iframe embedding
    const response = NextResponse.json({
      success: true,
      data: {
        id: video.id,
        title: video.title,
        videoUrl: presignedUrls.videoUrl,
        thumbnailUrl: presignedUrls.thumbnailUrl,
        duration: video.duration,
        organization: {
          name: video.organization?.name || 'Unknown',
          slug: video.organization?.slug || '',
        },
        isShareLink,
      },
    });

    // Allow embedding from any origin
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');

    return response;
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      '_tag' in error &&
      (error as { _tag?: string })._tag === 'NotFoundError'
    ) {
      return NextResponse.json({ success: false, error: 'Video not found' }, { status: 404 });
    }
    logger.error('Embed API error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// Handle preflight requests for CORS
export async function OPTIONS() {
  const response = new NextResponse(null, { status: 200 });
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}
