import { handleEffectExitWithOptions, runApiEffect } from '@nuclom/lib/api-handler';
import { CachePresets, getCacheControlHeader } from '@nuclom/lib/api-utils';
import { KnowledgeGraphRepository, VideoRepository } from '@nuclom/lib/effect';
import { Auth } from '@nuclom/lib/effect/services/auth';
import { Effect } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// GET /api/videos/[id]/decisions - Get decisions extracted from this video
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: videoId } = await params;

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // First get the video to verify access and get organization ID
    const videoRepo = yield* VideoRepository;
    const video = yield* videoRepo.getVideo(videoId);

    // Fetch decisions for this video
    const knowledgeRepo = yield* KnowledgeGraphRepository;
    const decisions = yield* knowledgeRepo.listDecisions({
      organizationId: video.organizationId,
      videoId,
      limit: 50,
    });

    return {
      videoId,
      decisions,
      totalDecisions: decisions.length,
    };
  });

  const exit = await runApiEffect(effect);
  return handleEffectExitWithOptions(exit, {
    successHeaders: {
      'Cache-Control': getCacheControlHeader(CachePresets.shortWithSwr()),
    },
  });
}
