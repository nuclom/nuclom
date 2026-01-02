import { Effect } from "effect";
import type { NextRequest } from "next/server";
import { createFullLayer, createPublicLayer, handleEffectExit } from "@/lib/api-handler";
import { ClipRepository } from "@/lib/effect";
import { Auth } from "@/lib/effect/services/auth";
import { validateRequestBody } from "@/lib/validation";
import { updateHighlightReelSchema } from "@/lib/validation/schemas";

// =============================================================================
// GET /api/highlight-reels/[id] - Get a single highlight reel
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const { id: reelId } = yield* Effect.promise(() => params);

    const clipRepo = yield* ClipRepository;
    const reel = yield* clipRepo.getHighlightReel(reelId);

    return {
      success: true,
      data: reel,
    };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}

// =============================================================================
// PATCH /api/highlight-reels/[id] - Update a highlight reel
// =============================================================================

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate user
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    const { id: reelId } = yield* Effect.promise(() => params);

    // Validate request body
    const validatedData = yield* validateRequestBody(updateHighlightReelSchema, request);

    // Update highlight reel
    const clipRepo = yield* ClipRepository;
    const updatedReel = yield* clipRepo.updateHighlightReel(reelId, {
      title: validatedData.title,
      description: validatedData.description,
      clipIds: validatedData.clipIds ? [...validatedData.clipIds] : undefined,
    });

    return {
      success: true,
      data: updatedReel,
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}

// =============================================================================
// DELETE /api/highlight-reels/[id] - Delete a highlight reel
// =============================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate user
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    const { id: reelId } = yield* Effect.promise(() => params);

    // Delete highlight reel
    const clipRepo = yield* ClipRepository;
    yield* clipRepo.deleteHighlightReel(reelId);

    return {
      success: true,
      message: "Highlight reel deleted successfully",
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}
