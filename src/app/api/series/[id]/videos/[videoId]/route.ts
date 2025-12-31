import { Effect } from "effect";
import type { NextRequest } from "next/server";
import { Auth, createFullLayer, handleEffectExit } from "@/lib/api-handler";
import { SeriesRepository } from "@/lib/effect";

// =============================================================================
// DELETE /api/series/[id]/videos/[videoId] - Remove video from series
// =============================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; videoId: string }> }) {
  const { id: seriesId, videoId } = await params;
  const FullLayer = createFullLayer();

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Remove video from series
    const seriesRepo = yield* SeriesRepository;
    yield* seriesRepo.removeVideoFromSeries(seriesId, videoId);
    return { success: true };
  });

  const runnable = Effect.provide(effect, FullLayer);
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
