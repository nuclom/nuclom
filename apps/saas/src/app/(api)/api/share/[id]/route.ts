import { handleEffectExit, runPublicApiEffect } from '@nuclom/lib/api-handler';
import { NotFoundError, ValidationError } from '@nuclom/lib/effect/errors';
import { Storage } from '@nuclom/lib/effect/services/storage';
import { VideoShareLinksRepository } from '@nuclom/lib/effect/services/video-share-links-repository';
import { Effect, Option } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// GET /api/share/[id] - Get share link data for public access
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const { id } = yield* Effect.promise(() => params);
    const shareLinkRepo = yield* VideoShareLinksRepository;

    // Get share link with video details
    const shareLinkOption = yield* shareLinkRepo.getShareLinkWithVideoAndOrganizationOption(id);
    if (Option.isNone(shareLinkOption)) {
      return yield* Effect.fail(
        new NotFoundError({
          message: 'Share link not found or has been revoked',
          entity: 'VideoShareLink',
          id,
        }),
      );
    }
    const shareLink = shareLinkOption.value;
    if (!shareLink.video) {
      return yield* Effect.fail(
        new NotFoundError({
          message: 'Video not found',
          entity: 'Video',
          id: shareLink.videoId,
        }),
      );
    }

    // Check if link is active
    if (shareLink.status !== 'active') {
      return yield* Effect.fail(
        new ValidationError({
          message: 'This share link has been revoked',
        }),
      );
    }

    // Check expiration
    if (shareLink.expiresAt && new Date(shareLink.expiresAt) < new Date()) {
      // Update status to expired
      yield* shareLinkRepo.updateShareLinkStatus(id, 'expired');

      return yield* Effect.fail(
        new ValidationError({
          message: 'This share link has expired',
        }),
      );
    }

    // Check view limit
    if (shareLink.maxViews && (shareLink.viewCount ?? 0) >= shareLink.maxViews) {
      return yield* Effect.fail(
        new ValidationError({
          message: 'This share link has reached its view limit',
        }),
      );
    }

    // Generate presigned URLs for video and thumbnail
    const storage = yield* Storage;
    let presignedVideoUrl: string | null = null;
    let presignedThumbnailUrl: string | null = null;

    if (shareLink.video.videoUrl) {
      presignedVideoUrl = yield* storage.generatePresignedDownloadUrl(shareLink.video.videoUrl, 3600);
    }

    if (shareLink.video.thumbnailUrl) {
      presignedThumbnailUrl = yield* storage.generatePresignedDownloadUrl(shareLink.video.thumbnailUrl, 3600);
    }

    // Return data with password as boolean (don't expose hash) and presigned URLs
    return {
      id: shareLink.id,
      videoId: shareLink.videoId,
      accessLevel: shareLink.accessLevel,
      status: shareLink.status,
      password: !!shareLink.password,
      expiresAt: shareLink.expiresAt,
      maxViews: shareLink.maxViews,
      viewCount: shareLink.viewCount,
      video: {
        ...shareLink.video,
        videoUrl: presignedVideoUrl,
        thumbnailUrl: presignedThumbnailUrl,
      },
    };
  });

  const exit = await runPublicApiEffect(effect);
  return handleEffectExit(exit);
}

// =============================================================================
// POST /api/share/[id] - Track view on share link (called when accessing)
// =============================================================================

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const { id } = yield* Effect.promise(() => params);
    const shareLinkRepo = yield* VideoShareLinksRepository;

    // Get share link
    const shareLinkOption = yield* shareLinkRepo.getShareLinkOption(id);
    if (Option.isNone(shareLinkOption)) {
      return yield* Effect.fail(
        new NotFoundError({
          message: 'Share link not found',
          entity: 'VideoShareLink',
          id,
        }),
      );
    }

    // Increment view count and update last accessed
    yield* shareLinkRepo.incrementShareLinkView(id);

    return { tracked: true };
  });

  const exit = await runPublicApiEffect(effect);
  return handleEffectExit(exit);
}
