import { eq } from 'drizzle-orm';
import { Effect } from 'effect';
import { connection, type NextRequest, NextResponse } from 'next/server';
import { createPublicLayer } from '@/lib/api-handler';
import { db } from '@/lib/db';
import { organizations, videoShareLinks, videos } from '@/lib/db/schema';
import { Storage } from '@/lib/effect';
import { logger } from '@/lib/logger';

// =============================================================================
// GET /api/embed/[id] - Get embed video data
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connection();

  const { id } = await params;

  try {
    // First try to find as a share link
    const [shareLink] = await db
      .select({
        id: videoShareLinks.id,
        videoId: videoShareLinks.videoId,
        accessLevel: videoShareLinks.accessLevel,
        status: videoShareLinks.status,
        expiresAt: videoShareLinks.expiresAt,
        maxViews: videoShareLinks.maxViews,
        viewCount: videoShareLinks.viewCount,
      })
      .from(videoShareLinks)
      .where(eq(videoShareLinks.id, id));

    let videoId = id;
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

      videoId = shareLink.videoId;
      isShareLink = true;
    }

    // Get video data
    const [video] = await db
      .select({
        id: videos.id,
        title: videos.title,
        videoUrl: videos.videoUrl,
        thumbnailUrl: videos.thumbnailUrl,
        duration: videos.duration,
        organizationId: videos.organizationId,
      })
      .from(videos)
      .where(eq(videos.id, videoId));

    if (!video || !video.videoUrl) {
      return NextResponse.json({ success: false, error: 'Video not found' }, { status: 404 });
    }

    // Get organization
    const [org] = await db
      .select({
        name: organizations.name,
        slug: organizations.slug,
      })
      .from(organizations)
      .where(eq(organizations.id, video.organizationId));

    // Capture video URL (we've already validated it's not null above)
    // TypeScript doesn't narrow after the early return, so we assert
    const videoUrlValue = video.videoUrl as string;

    // Generate presigned URLs for video and thumbnail
    const presignedUrlEffect = Effect.gen(function* () {
      const storage = yield* Storage;

      // Extract file key from stored URL (supports both legacy URL and new key format)
      let videoKey: string;
      if (videoUrlValue.includes('.r2.cloudflarestorage.com/')) {
        const extractedKey = storage.extractKeyFromUrl(videoUrlValue);
        if (!extractedKey) {
          return { videoUrl: null, thumbnailUrl: null };
        }
        videoKey = extractedKey;
      } else {
        videoKey = videoUrlValue;
      }

      const presignedVideoUrl = yield* storage.generatePresignedDownloadUrl(videoKey, 3600);

      let presignedThumbnailUrl: string | null = null;
      if (video.thumbnailUrl) {
        let thumbnailKey: string;
        if (video.thumbnailUrl.includes('.r2.cloudflarestorage.com/')) {
          const extractedKey = storage.extractKeyFromUrl(video.thumbnailUrl);
          if (extractedKey) {
            thumbnailKey = extractedKey;
            presignedThumbnailUrl = yield* storage.generatePresignedDownloadUrl(thumbnailKey, 3600);
          }
        } else {
          thumbnailKey = video.thumbnailUrl;
          presignedThumbnailUrl = yield* storage.generatePresignedDownloadUrl(thumbnailKey, 3600);
        }
      }

      return { videoUrl: presignedVideoUrl, thumbnailUrl: presignedThumbnailUrl };
    });

    const runnable = Effect.provide(presignedUrlEffect, createPublicLayer());
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
          name: org?.name || 'Unknown',
          slug: org?.slug || '',
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
