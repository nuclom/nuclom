import { Effect } from "effect";
import type { NextRequest } from "next/server";
import { createFullLayer, handleEffectExitWithStatus } from "@/lib/api-handler";
import { ClipRepository } from "@/lib/effect";
import { Auth } from "@/lib/effect/services/auth";
import { renderHighlightReelWorkflow } from "@/workflows/highlight-reel-render";

// =============================================================================
// POST /api/highlight-reels/[id]/render - Start rendering a highlight reel
// =============================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate user
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    const { id: reelId } = yield* Effect.promise(() => params);

    // Get highlight reel to verify it exists and get organization ID
    const clipRepo = yield* ClipRepository;
    const reel = yield* clipRepo.getHighlightReel(reelId);

    // Validate that the reel has clips
    if (!reel.clipIds || reel.clipIds.length === 0) {
      return yield* Effect.fail({
        _tag: "ValidationError" as const,
        message: "Highlight reel must have at least one clip",
      });
    }

    // Trigger the rendering workflow
    // This runs durably in the background with automatic retries and checkpointing
    renderHighlightReelWorkflow({
      reelId: reel.id,
      organizationId: reel.organizationId,
    });

    // Return immediately with the updated reel status
    return {
      success: true,
      data: {
        id: reel.id,
        status: "rendering",
        clipCount: reel.clipIds.length,
      },
      message: "Highlight reel rendering started. The video will be ready shortly.",
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExitWithStatus(exit, 202);
}
