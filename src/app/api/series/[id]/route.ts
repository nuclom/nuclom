import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';
import { createFullLayer, handleEffectExit } from '@/lib/api-handler';
import { SeriesRepository } from '@/lib/effect';
import { Auth } from '@/lib/effect/services/auth';
import { validateRequestBody } from '@/lib/validation';

const UpdateSeriesSchema = Schema.Struct({
  name: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  thumbnailUrl: Schema.optional(Schema.String),
  isPublic: Schema.optional(Schema.Boolean),
});

// =============================================================================
// GET /api/series/[id] - Get series with videos
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Fetch series with videos using repository
    const seriesRepo = yield* SeriesRepository;
    return yield* seriesRepo.getSeriesWithVideos(id);
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}

// =============================================================================
// PATCH /api/series/[id] - Update a series
// =============================================================================

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Parse and validate request body
    const { name, description, thumbnailUrl, isPublic } = yield* validateRequestBody(UpdateSeriesSchema, request);

    // Update series using repository
    const seriesRepo = yield* SeriesRepository;
    return yield* seriesRepo.updateSeries(id, {
      name,
      description,
      thumbnailUrl,
      isPublic,
    });
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}

// =============================================================================
// DELETE /api/series/[id] - Delete a series
// =============================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Delete series using repository
    const seriesRepo = yield* SeriesRepository;
    yield* seriesRepo.deleteSeries(id);
    return { success: true };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
