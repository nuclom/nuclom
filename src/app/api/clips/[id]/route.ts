import { Effect } from 'effect';
import type { NextRequest } from 'next/server';
import { createFullLayer, createPublicLayer, handleEffectExit } from '@/lib/api-handler';
import { ClipRepository } from '@/lib/effect';
import { Auth } from '@/lib/effect/services/auth';
import { validateRequestBody } from '@/lib/validation';
import { updateClipSchema } from '@/lib/validation/schemas';

// =============================================================================
// GET /api/clips/[id] - Get a single clip
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const { id: clipId } = yield* Effect.promise(() => params);

    const clipRepo = yield* ClipRepository;
    const clip = yield* clipRepo.getClip(clipId);

    return {
      success: true,
      data: clip,
    };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}

// =============================================================================
// PATCH /api/clips/[id] - Update a clip
// =============================================================================

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate user
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    const { id: clipId } = yield* Effect.promise(() => params);

    // Validate request body
    const validatedData = yield* validateRequestBody(updateClipSchema, request);

    // Update clip
    const clipRepo = yield* ClipRepository;
    const updatedClip = yield* clipRepo.updateClip(clipId, {
      title: validatedData.title,
      description: validatedData.description,
      startTime: validatedData.startTime,
      endTime: validatedData.endTime,
    });

    return {
      success: true,
      data: updatedClip,
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}

// =============================================================================
// DELETE /api/clips/[id] - Delete a clip
// =============================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate user
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    const { id: clipId } = yield* Effect.promise(() => params);

    // Delete clip
    const clipRepo = yield* ClipRepository;
    yield* clipRepo.deleteClip(clipId);

    return {
      success: true,
      message: 'Clip deleted successfully',
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}
