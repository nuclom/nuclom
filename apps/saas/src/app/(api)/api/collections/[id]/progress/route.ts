import { createFullLayer, handleEffectExit, handleEffectExitWithStatus } from '@nuclom/lib/api-handler';
import { Auth } from '@nuclom/lib/effect/services/auth';
import { CollectionRepository } from '@nuclom/lib/effect/services/collection-repository';
import { validateRequestBody } from '@nuclom/lib/validation';
import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';

const UpdateProgressSchema = Schema.Struct({
  lastVideoId: Schema.String,
  lastPosition: Schema.Number,
  completed: Schema.optional(Schema.Boolean),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * @summary Get collection progress
 * @description Get the current user's progress through a playlist collection
 * @response 200 CollectionProgressWithDetails - Progress details
 * @response 401 - Unauthorized
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const { id } = params;

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Fetch progress using repository
    const collectionRepo = yield* CollectionRepository;
    const progress = yield* collectionRepo.getCollectionProgress(user.id, id);

    return progress ?? { progress: null };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}

/**
 * @summary Update collection progress
 * @description Update the current user's progress through a playlist collection.
 * Set `completed: true` to mark the current video as completed.
 * @response 201 CollectionProgress - Updated progress
 * @response 400 - Invalid request body
 * @response 401 - Unauthorized
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const { id } = params;

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Parse and validate request body
    const { lastVideoId, lastPosition, completed } = yield* validateRequestBody(UpdateProgressSchema, request);

    const collectionRepo = yield* CollectionRepository;

    // Update progress
    const progress = yield* collectionRepo.updateCollectionProgress(user.id, id, lastVideoId, lastPosition);

    // Mark video as completed if requested
    if (completed) {
      yield* collectionRepo.markVideoCompleted(user.id, id, lastVideoId);
    }

    return progress;
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExitWithStatus(exit, 201);
}
