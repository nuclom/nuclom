import { Cause, Effect, Exit } from 'effect';
import { type NextRequest, NextResponse } from 'next/server';
import { mapErrorToApiResponse } from '@/lib/api-errors';
import { createFullLayer } from '@/lib/api-handler';
import { CachePresets, getCacheControlHeader } from '@/lib/api-utils';
import { KnowledgeGraphRepository, VideoRepository } from '@/lib/effect';
import { Auth } from '@/lib/effect/services/auth';

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

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  // Custom handling for cache headers
  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === 'Some') {
        return mapErrorToApiResponse(error.value);
      }
      return mapErrorToApiResponse(new Error('Internal server error'));
    },
    onSuccess: (data) =>
      NextResponse.json(data, {
        headers: {
          'Cache-Control': getCacheControlHeader(CachePresets.shortWithSwr()),
        },
      }),
  });
}
