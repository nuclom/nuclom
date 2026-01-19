import { createFullLayer, handleEffectExit } from '@nuclom/lib/api-handler';
import { Auth } from '@nuclom/lib/effect/services/auth';
import { CollectionRepository } from '@nuclom/lib/effect/services/collection-repository';
import { Effect } from 'effect';
import type { NextRequest } from 'next/server';

interface RouteContext {
  params: Promise<{ id: string; videoId: string }>;
}

/**
 * @summary Remove video from collection
 * @description Remove a video from this collection (the video itself is not deleted)
 * @response 200 - Video removed from collection
 * @response 401 - Unauthorized
 * @response 404 - Video not found in collection
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const { id, videoId } = params;

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Remove video from collection using repository
    const collectionRepo = yield* CollectionRepository;
    yield* collectionRepo.removeVideoFromCollection(id, videoId);

    return { removed: true };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}
