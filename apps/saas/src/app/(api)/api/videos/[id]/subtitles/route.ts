/**
 * Subtitle Languages API Endpoint
 *
 * Returns available subtitle information for a video (English only).
 *
 * GET /api/videos/[id]/subtitles - Get subtitle availability
 */

import { createPublicLayer, handleEffectExit } from '@nuclom/lib/api-handler';
import { db } from '@nuclom/lib/db';
import { videos } from '@nuclom/lib/db/schema';
import { DatabaseError, NotFoundError } from '@nuclom/lib/effect';
import type { ApiResponse } from '@nuclom/lib/types';
import { eq } from 'drizzle-orm';
import { Effect } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// Types
// =============================================================================

interface SubtitleLanguage {
  code: string;
  name: string;
  nativeName: string;
  isOriginal: boolean;
  available: boolean;
  url: string;
}

interface SubtitleLanguagesResponse {
  videoId: string;
  hasTranscript: boolean;
  processingStatus: string;
  languages: SubtitleLanguage[];
}

// =============================================================================
// GET /api/videos/[id]/subtitles - Get Subtitle Availability
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const { id } = yield* Effect.promise(() => params);

    // Fetch video with transcript
    const videoData = yield* Effect.tryPromise({
      try: () =>
        db.query.videos.findFirst({
          where: eq(videos.id, id),
          columns: {
            id: true,
            transcriptSegments: true,
            processingStatus: true,
          },
        }),
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch video',
          operation: 'getSubtitleLanguages',
          cause: error,
        }),
    });

    if (!videoData) {
      return yield* Effect.fail(
        new NotFoundError({
          message: 'Video not found',
          entity: 'Video',
          id,
        }),
      );
    }

    const hasTranscript = !!videoData.transcriptSegments && videoData.transcriptSegments.length > 0;

    // Build language list (English only)
    const baseUrl = `/api/videos/${id}/subtitles`;
    const languages: SubtitleLanguage[] = [
      {
        code: 'en',
        name: 'English',
        nativeName: 'English',
        isOriginal: true,
        available: hasTranscript,
        url: `${baseUrl}/en`,
      },
    ];

    const data: SubtitleLanguagesResponse = {
      videoId: id,
      hasTranscript,
      processingStatus: videoData.processingStatus,
      languages,
    };

    const response: ApiResponse<SubtitleLanguagesResponse> = {
      success: true,
      data,
    };
    return response;
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
