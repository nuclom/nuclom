import { auth } from '@nuclom/lib/auth';
import { asc, eq } from 'drizzle-orm';
import { Effect } from 'effect';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { createPublicLayer } from '@/lib/api-handler';
import { db } from '@/lib/db';
import { videoChapters } from '@/lib/db/schema';
import { getCachedVideo, Storage } from '@/lib/effect';
import { VideoContentClient } from './_components/video-content-client';

// =============================================================================
// Loading Skeleton
// =============================================================================

function VideoDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6 lg:gap-8 max-w-6xl mx-auto">
      <div className="aspect-video bg-muted animate-pulse rounded-lg" />
      <div className="space-y-3">
        <div className="h-8 lg:h-10 bg-muted animate-pulse rounded w-3/4" />
        <div className="h-5 bg-muted animate-pulse rounded w-1/3" />
      </div>
      <div className="space-y-6">
        <div className="h-10 bg-muted animate-pulse rounded w-96 max-w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-48 bg-muted animate-pulse rounded-lg" />
          <div className="h-48 bg-muted animate-pulse rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Async Video Loader Component
// =============================================================================

interface VideoLoaderProps {
  params: Promise<{ organization: string; id: string }>;
}

/**
 * Generate presigned URLs for video and thumbnail
 */
async function getPresignedUrls(
  videoUrl: string | null,
  thumbnailUrl: string | null,
): Promise<{ videoUrl: string | null; thumbnailUrl: string | null }> {
  if (!videoUrl) {
    return { videoUrl: null, thumbnailUrl: null };
  }

  const effect = Effect.gen(function* () {
    const storage = yield* Storage;

    // Extract file key (supports both legacy URL and new key format)
    let videoKey: string;
    if (videoUrl.includes('.r2.cloudflarestorage.com/')) {
      const extractedKey = storage.extractKeyFromUrl(videoUrl);
      if (!extractedKey) {
        return { videoUrl: null, thumbnailUrl: null };
      }
      videoKey = extractedKey;
    } else {
      videoKey = videoUrl;
    }

    const presignedVideoUrl = yield* storage.generatePresignedDownloadUrl(videoKey, 3600);

    let presignedThumbnailUrl: string | null = null;
    if (thumbnailUrl) {
      let thumbnailKey: string;
      if (thumbnailUrl.includes('.r2.cloudflarestorage.com/')) {
        const extractedKey = storage.extractKeyFromUrl(thumbnailUrl);
        if (extractedKey) {
          thumbnailKey = extractedKey;
          presignedThumbnailUrl = yield* storage.generatePresignedDownloadUrl(thumbnailKey, 3600);
        }
      } else {
        thumbnailKey = thumbnailUrl;
        presignedThumbnailUrl = yield* storage.generatePresignedDownloadUrl(thumbnailKey, 3600);
      }
    }

    return { videoUrl: presignedVideoUrl, thumbnailUrl: presignedThumbnailUrl };
  });

  try {
    const runnable = Effect.provide(effect, createPublicLayer());
    return await Effect.runPromise(runnable);
  } catch {
    return { videoUrl: null, thumbnailUrl: null };
  }
}

async function VideoLoader({ params }: VideoLoaderProps) {
  const { organization: organizationSlug, id: videoId } = await params;

  // Get current user session (optional - allows anonymous viewing)
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const currentUser = session?.user
    ? {
        id: session.user.id,
        name: session.user.name,
        image: session.user.image,
      }
    : undefined;

  // Fetch video details and chapters in parallel
  const [video, chapters] = await Promise.all([
    getCachedVideo(videoId),
    db.select().from(videoChapters).where(eq(videoChapters.videoId, videoId)).orderBy(asc(videoChapters.startTime)),
  ]);

  if (!video) {
    notFound();
  }

  // Generate presigned URLs
  const presignedUrls = await getPresignedUrls(video.videoUrl, video.thumbnailUrl);

  const videoWithPresignedUrls = {
    ...video,
    videoUrl: presignedUrls.videoUrl,
    thumbnailUrl: presignedUrls.thumbnailUrl,
  };

  return (
    <VideoContentClient
      video={videoWithPresignedUrls}
      chapters={chapters}
      organizationSlug={organizationSlug}
      currentUser={currentUser}
    />
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function VideoPage({ params }: { params: Promise<{ organization: string; id: string }> }) {
  return (
    <Suspense fallback={<VideoDetailSkeleton />}>
      <VideoLoader params={params} />
    </Suspense>
  );
}
