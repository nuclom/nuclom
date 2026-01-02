import { Effect } from "effect";
import type { NextRequest } from "next/server";
import { createFullLayer, handleEffectExit } from "@/lib/api-handler";
import { ClipRepository } from "@/lib/effect";
import { Auth } from "@/lib/effect/services/auth";

// =============================================================================
// POST /api/highlight-reels/[id]/render - Start rendering a highlight reel
// =============================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate user
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    const { id: reelId } = yield* Effect.promise(() => params);

    // Get highlight reel to verify it exists and get clipIds
    const clipRepo = yield* ClipRepository;
    yield* clipRepo.getHighlightReel(reelId);

    // Update status to rendering
    const updatedReel = yield* clipRepo.updateHighlightReel(reelId, {
      status: "rendering",
    });

    // TODO: Trigger async workflow to render the highlight reel
    // This would typically be handled by a background job/workflow
    // using FFmpeg or a video processing service like Replicate

    return {
      success: true,
      data: updatedReel,
      message: "Highlight reel rendering started",
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}
