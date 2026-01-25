'use server';

import { createPublicLayer } from '@nuclom/lib/api-handler';
import { db } from '@nuclom/lib/db';
import { videos } from '@nuclom/lib/db/schema';
import { Storage } from '@nuclom/lib/effect/services/storage';
import { eq } from 'drizzle-orm';
import { Effect } from 'effect';

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
    const presignedVideoUrl = yield* storage.generatePresignedDownloadUrl(storedUrl, 3600);
    return { videoUrl: presignedVideoUrl };
  });

  try {
    const runnable = Effect.provide(effect, createPublicLayer());
    return await Effect.runPromise(runnable);
  } catch {
    return { videoUrl: null };
  }
}
