'use server';

import { eq } from 'drizzle-orm';
import { Effect } from 'effect';
import { createPublicLayer } from '@/lib/api-handler';
import { db } from '@/lib/db';
import { videos } from '@/lib/db/schema';
import { Storage } from '@/lib/effect';

/**
 * Server action to refresh a video's signed URL.
 * Used when the signed URL expires during long playback sessions.
 */
export async function refreshVideoUrl(videoId: string): Promise<{ videoUrl: string | null }> {
  // Get the video's storage key from the database
  const video = await db.query.videos.findFirst({
    where: eq(videos.id, videoId),
    columns: { videoUrl: true },
  });

  if (!video?.videoUrl) {
    return { videoUrl: null };
  }

  const storedUrl = video.videoUrl;

  const effect = Effect.gen(function* () {
    const storage = yield* Storage;

    // Extract file key (supports both legacy URL and new key format)
    let videoKey: string;
    if (storedUrl.includes('.r2.cloudflarestorage.com/')) {
      const extractedKey = storage.extractKeyFromUrl(storedUrl);
      if (!extractedKey) {
        return { videoUrl: null };
      }
      videoKey = extractedKey;
    } else {
      videoKey = storedUrl;
    }

    const presignedVideoUrl = yield* storage.generatePresignedDownloadUrl(videoKey, 3600);
    return { videoUrl: presignedVideoUrl };
  });

  try {
    const runnable = Effect.provide(effect, createPublicLayer());
    return await Effect.runPromise(runnable);
  } catch {
    return { videoUrl: null };
  }
}
