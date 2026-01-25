/**
 * Subtitle Languages API Endpoint
 *
 * Returns available subtitle information for a video (English only).
 *
 * GET /api/videos/[id]/subtitles - Get subtitle availability
 */

import { handleEffectExit, runPublicApiEffect } from '@nuclom/lib/api-handler';
import { VideoRepository } from '@nuclom/lib/effect/services/video-repository';
import type { ApiResponse } from '@nuclom/lib/types';
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

    // Fetch video using repository
    const videoRepo = yield* VideoRepository;
    const videoData = yield* videoRepo.getVideo(id);

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

  const exit = await runPublicApiEffect(effect);
  return handleEffectExit(exit);
}
