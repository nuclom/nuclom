import { createPublicLayer, handleEffectExit } from '@nuclom/lib/api-handler';
import { VideoRepository } from '@nuclom/lib/effect';
import type { ApiResponse } from '@nuclom/lib/types';
import { Effect } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// POST /api/videos/[id]/restore - Restore a soft-deleted video
// =============================================================================

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);

    const videoRepo = yield* VideoRepository;
    const restoredVideo = yield* videoRepo.restoreVideo(resolvedParams.id);

    const response: ApiResponse = {
      success: true,
      data: {
        message: 'Video restored successfully',
        video: restoredVideo,
      },
    };
    return response;
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
