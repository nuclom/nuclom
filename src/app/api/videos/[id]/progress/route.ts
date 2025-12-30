import { type NextRequest, NextResponse } from "next/server";
import { Effect, Layer, Exit, Cause, Option } from "effect";
import { auth } from "@/lib/auth";
import { AppLive, VideoProgressRepository, MissingFieldError, ValidationError } from "@/lib/effect";
import { makeAuthLayer, Auth } from "@/lib/effect/services/auth";
import type { ApiResponse } from "@/lib/types";

// =============================================================================
// Error Response Handler
// =============================================================================

const mapErrorToResponse = (error: unknown): NextResponse => {
  if (error && typeof error === "object" && "_tag" in error) {
    const taggedError = error as { _tag: string; message: string };

    switch (taggedError._tag) {
      case "UnauthorizedError":
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 401 });
      case "NotFoundError":
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 404 });
      case "MissingFieldError":
      case "ValidationError":
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 400 });
      default:
        console.error(`[${taggedError._tag}]`, taggedError);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
  }
  console.error("[Error]", error);
  return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
};

// =============================================================================
// GET /api/videos/[id]/progress - Get video progress for current user
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const AuthLayer = makeAuthLayer(auth);
  const FullLayer = Layer.merge(AppLive, AuthLayer);

  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const videoId = resolvedParams.id;

    // Try to get session (optional - return null progress if not authenticated)
    const authService = yield* Auth;
    const sessionOption = yield* authService.getSessionOption(request.headers);

    // If not authenticated, return null progress
    if (Option.isNone(sessionOption)) {
      return null;
    }

    const { user } = sessionOption.value;

    // Get progress using repository
    const progressRepo = yield* VideoProgressRepository;
    return yield* progressRepo.getProgress(videoId, user.id);
  });

  const runnable = Effect.provide(effect, FullLayer);
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === "Some") {
        return mapErrorToResponse(error.value);
      }
      return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    },
    onSuccess: (data) => {
      const response: ApiResponse = {
        success: true,
        data,
      };
      return NextResponse.json(response);
    },
  });
}

// =============================================================================
// PATCH /api/videos/[id]/progress - Update video progress for current user
// =============================================================================

interface UpdateProgressBody {
  currentTime: number;
  completed?: boolean;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const AuthLayer = makeAuthLayer(auth);
  const FullLayer = Layer.merge(AppLive, AuthLayer);

  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const videoId = resolvedParams.id;

    // Authenticate - required for saving progress
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Parse request body
    const body = yield* Effect.tryPromise({
      try: () => request.json() as Promise<UpdateProgressBody>,
      catch: () =>
        new MissingFieldError({
          field: "body",
          message: "Invalid request body",
        }),
    });

    // Validate currentTime
    if (typeof body.currentTime !== "number" || body.currentTime < 0) {
      return yield* Effect.fail(
        new ValidationError({
          message: "currentTime must be a non-negative number",
        }),
      );
    }

    // Save progress using repository
    const progressRepo = yield* VideoProgressRepository;
    return yield* progressRepo.saveProgress({
      videoId,
      userId: user.id,
      currentTime: body.currentTime,
      completed: body.completed ?? false,
    });
  });

  const runnable = Effect.provide(effect, FullLayer);
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === "Some") {
        return mapErrorToResponse(error.value);
      }
      return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    },
    onSuccess: (data) => {
      const response: ApiResponse = {
        success: true,
        data,
      };
      return NextResponse.json(response);
    },
  });
}

// =============================================================================
// DELETE /api/videos/[id]/progress - Delete video progress for current user
// =============================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const AuthLayer = makeAuthLayer(auth);
  const FullLayer = Layer.merge(AppLive, AuthLayer);

  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const videoId = resolvedParams.id;

    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Delete progress using repository
    const progressRepo = yield* VideoProgressRepository;
    yield* progressRepo.deleteProgress(videoId, user.id);

    return { message: "Progress deleted successfully" };
  });

  const runnable = Effect.provide(effect, FullLayer);
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === "Some") {
        return mapErrorToResponse(error.value);
      }
      return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    },
    onSuccess: (data) => {
      const response: ApiResponse = {
        success: true,
        data,
      };
      return NextResponse.json(response);
    },
  });
}
