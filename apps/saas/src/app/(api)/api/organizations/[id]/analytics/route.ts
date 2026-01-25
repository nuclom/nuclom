import { Auth, generatePresignedThumbnailUrl, handleEffectExit, runApiEffect, Storage } from '@nuclom/lib/api-handler';
import { OrganizationRepository } from '@nuclom/lib/effect/services/organization-repository';
import { VideoAnalyticsRepository } from '@nuclom/lib/effect/services/video-analytics-repository';
import { Effect } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// GET /api/organizations/[id]/analytics - Get organization analytics
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const url = new URL(request.url);
  const period = url.searchParams.get('period') || '30d';

  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const organizationId = resolvedParams.id;

    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Verify user belongs to organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, organizationId);

    // Calculate date ranges
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0); // All time
    }

    const analyticsParams = { organizationId, startDate };

    // Get analytics using the repository
    const analyticsRepo = yield* VideoAnalyticsRepository;

    // Get overview and other data in parallel
    const [overview, topVideos, viewsByDay] = yield* Effect.all(
      [
        analyticsRepo.getAnalyticsOverview(analyticsParams),
        analyticsRepo.getTopVideos({ ...analyticsParams, limit: 10 }),
        analyticsRepo.getViewsByDay(analyticsParams),
      ],
      { concurrency: 3 },
    );

    // Get video details for top videos
    const topVideoIds = topVideos.map((v) => v.videoId);
    const videoDetails = yield* analyticsRepo.getVideoDetailsByIds(topVideoIds);

    // Generate presigned URLs for video thumbnails
    const storage = yield* Storage;
    const videoDetailsWithPresignedUrls = yield* Effect.all(
      videoDetails.map((v) =>
        Effect.gen(function* () {
          const presignedThumbnailUrl = yield* generatePresignedThumbnailUrl(storage, v.thumbnailUrl);
          return {
            ...v,
            thumbnailUrl: presignedThumbnailUrl,
          };
        }),
      ),
      { concurrency: 10 },
    );

    const videoDetailsMap = new Map(videoDetailsWithPresignedUrls.map((v) => [v.id, v]));

    return {
      overview,
      topVideos: topVideos.map((v) => ({
        ...v,
        video: videoDetailsMap.get(v.videoId),
      })),
      viewsByDay,
      period,
    };
  });

  const exit = await runApiEffect(effect);
  return handleEffectExit(exit);
}
