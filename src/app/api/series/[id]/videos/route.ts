import { Cause, Effect, Exit } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { Auth, createFullLayer, handleEffectExit, mapErrorToApiResponse } from "@/lib/api-handler";
import { MissingFieldError, SeriesRepository } from "@/lib/effect";

// =============================================================================
// GET /api/series/[id]/videos - Get available videos (not in series)
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: seriesId } = await params;
  const FullLayer = createFullLayer();

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Parse query params
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return yield* Effect.fail(
        new MissingFieldError({
          field: "organizationId",
          message: "Organization ID is required",
        }),
      );
    }

    // Get available videos
    const seriesRepo = yield* SeriesRepository;
    return yield* seriesRepo.getAvailableVideos(organizationId, seriesId);
  });

  const runnable = Effect.provide(effect, FullLayer);
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}

// =============================================================================
// POST /api/series/[id]/videos - Add video to series
// =============================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: seriesId } = await params;
  const FullLayer = createFullLayer();

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Parse request body
    const body = yield* Effect.tryPromise({
      try: () => request.json(),
      catch: () =>
        new MissingFieldError({
          field: "body",
          message: "Invalid request body",
        }),
    });

    const { videoId, position } = body;

    if (!videoId) {
      return yield* Effect.fail(new MissingFieldError({ field: "videoId", message: "Video ID is required" }));
    }

    // Add video to series
    const seriesRepo = yield* SeriesRepository;
    return yield* seriesRepo.addVideoToSeries(seriesId, videoId, position);
  });

  const runnable = Effect.provide(effect, FullLayer);
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === "Some") {
        return mapErrorToApiResponse(error.value);
      }
      return mapErrorToApiResponse(new Error("Internal server error"));
    },
    onSuccess: (data) => NextResponse.json(data, { status: 201 }),
  });
}

// =============================================================================
// PATCH /api/series/[id]/videos - Reorder videos in series
// =============================================================================

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: seriesId } = await params;
  const FullLayer = createFullLayer();

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Parse request body
    const body = yield* Effect.tryPromise({
      try: () => request.json(),
      catch: () =>
        new MissingFieldError({
          field: "body",
          message: "Invalid request body",
        }),
    });

    const { videoIds } = body;

    if (!videoIds || !Array.isArray(videoIds)) {
      return yield* Effect.fail(new MissingFieldError({ field: "videoIds", message: "Video IDs array is required" }));
    }

    // Reorder videos
    const seriesRepo = yield* SeriesRepository;
    yield* seriesRepo.reorderVideos(seriesId, videoIds);
    return { success: true };
  });

  const runnable = Effect.provide(effect, FullLayer);
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
