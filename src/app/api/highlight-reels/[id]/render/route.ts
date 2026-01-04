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
    const reel = yield* clipRepo.getHighlightReel(reelId);

    // Note: Full video rendering (combining clips into a single video) is a planned feature.
    // Currently, highlight reels can be previewed by playing clips sequentially.
    // Server-side video rendering will be added in a future release.

    return {
      success: true,
      data: reel,
      message: "Highlight reel preview available. Full video rendering coming soon.",
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}
