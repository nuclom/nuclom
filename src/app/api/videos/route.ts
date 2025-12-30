import { Cause, Effect, Exit, Layer } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { CachePresets, getCacheControlHeader, parsePaginationParams } from "@/lib/api-utils";
import { auth } from "@/lib/auth";
import { mapErrorToApiResponse } from "@/lib/api-errors";
import { AppLive, MissingFieldError, VideoRepository } from "@/lib/effect";
import { Auth, makeAuthLayer } from "@/lib/effect/services/auth";

// =============================================================================
// GET /api/videos - Fetch paginated videos for an organization
// =============================================================================

export async function GET(request: NextRequest) {
  const AuthLayer = makeAuthLayer(auth);
  const FullLayer = Layer.merge(AppLive, AuthLayer);

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Parse query params with validation
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    const { page, limit } = parsePaginationParams(searchParams);

    if (!organizationId) {
      return yield* Effect.fail(
        new MissingFieldError({
          field: "organizationId",
          message: "Organization ID is required",
        }),
      );
    }

    // Fetch videos using repository
    const videoRepo = yield* VideoRepository;
    return yield* videoRepo.getVideos(organizationId, page, limit);
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
    onSuccess: (data) =>
      NextResponse.json(data, {
        headers: {
          "Cache-Control": getCacheControlHeader(CachePresets.shortWithSwr()),
        },
      }),
  });
}

// =============================================================================
// POST /api/videos - Create a new video
// =============================================================================

export async function POST(request: NextRequest) {
  const AuthLayer = makeAuthLayer(auth);
  const FullLayer = Layer.merge(AppLive, AuthLayer);

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Parse request body
    const body = yield* Effect.tryPromise({
      try: () => request.json(),
      catch: () =>
        new MissingFieldError({
          field: "body",
          message: "Invalid request body",
        }),
    });

    const {
      title,
      description,
      duration,
      thumbnailUrl,
      videoUrl,
      organizationId,
      channelId,
      collectionId,
      transcript,
      aiSummary,
    } = body;

    // Validate required fields
    if (!title) {
      return yield* Effect.fail(new MissingFieldError({ field: "title", message: "Title is required" }));
    }

    if (!duration) {
      return yield* Effect.fail(new MissingFieldError({ field: "duration", message: "Duration is required" }));
    }

    if (!organizationId) {
      return yield* Effect.fail(
        new MissingFieldError({ field: "organizationId", message: "Organization ID is required" }),
      );
    }

    // Create video using repository
    const videoRepo = yield* VideoRepository;
    return yield* videoRepo.createVideo({
      title,
      description,
      duration,
      thumbnailUrl,
      videoUrl,
      authorId: user.id,
      organizationId,
      channelId,
      collectionId,
      transcript,
      aiSummary,
    });
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
