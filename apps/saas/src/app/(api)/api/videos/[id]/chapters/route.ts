import { handleEffectExit, runApiEffect } from '@nuclom/lib/api-handler';
import { VideoRepository } from '@nuclom/lib/effect';
import { Effect } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// GET /api/videos/[id]/chapters - Get video chapters
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const videoId = resolvedParams.id;

    // Verify video exists and get chapters using repository
    const videoRepo = yield* VideoRepository;
    yield* videoRepo.getVideo(videoId); // Throws NotFoundError if video doesn't exist

    const chapters = yield* videoRepo.getVideoChapters(videoId);

    return {
      success: true,
      data: {
        videoId,
        chapters,
        count: chapters.length,
      },
    };
  });

  const exit = await runApiEffect(effect);
  return handleEffectExit(exit);
}
