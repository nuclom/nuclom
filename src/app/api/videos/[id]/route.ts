import { asc, eq, isNull } from "drizzle-orm";
import { Cause, Effect, Exit } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { NewVideo } from "@/lib/db/schema";
import { comments, videos } from "@/lib/db/schema";
import { AppLive, DatabaseError, NotFoundError, ValidationError, VideoRepository } from "@/lib/effect";
import type { ApiResponse } from "@/lib/types";

// =============================================================================
// Error Response Handler
// =============================================================================

const mapErrorToResponse = (error: unknown): NextResponse => {
  if (error && typeof error === "object" && "_tag" in error) {
    const taggedError = error as { _tag: string; message: string };

    switch (taggedError._tag) {
      case "NotFoundError":
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 404 });
      case "ValidationError":
      case "MissingFieldError":
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
// GET /api/videos/[id] - Get video details
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);

    // Use Drizzle query builder for nested relations
    const videoData = yield* Effect.tryPromise({
      try: () =>
        db.query.videos.findFirst({
          where: eq(videos.id, resolvedParams.id),
          with: {
            author: true,
            organization: true,
            channel: true,
            collection: true,
            comments: {
              with: {
                author: true,
                replies: {
                  with: {
                    author: true,
                  },
                },
              },
              where: isNull(comments.parentId),
              orderBy: asc(comments.createdAt),
            },
          },
        }),
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch video",
          operation: "getVideo",
          cause: error,
        }),
    });

    if (!videoData) {
      return yield* Effect.fail(
        new NotFoundError({
          message: "Video not found",
          entity: "Video",
          id: resolvedParams.id,
        }),
      );
    }

    return videoData;
  });

  const runnable = Effect.provide(effect, AppLive);
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
// PUT /api/videos/[id] - Update video
// =============================================================================

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);

    const body = yield* Effect.tryPromise({
      try: () => request.json() as Promise<Partial<NewVideo>>,
      catch: () =>
        new ValidationError({
          message: "Invalid request body",
        }),
    });

    // Update video using repository
    const videoRepo = yield* VideoRepository;
    yield* videoRepo.updateVideo(resolvedParams.id, body);

    // Fetch updated video with relations
    const videoData = yield* Effect.tryPromise({
      try: () =>
        db.query.videos.findFirst({
          where: eq(videos.id, resolvedParams.id),
          with: {
            author: true,
            organization: true,
            channel: true,
            collection: true,
          },
        }),
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch updated video",
          operation: "updateVideo",
          cause: error,
        }),
    });

    return videoData;
  });

  const runnable = Effect.provide(effect, AppLive);
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
// DELETE /api/videos/[id] - Delete video
// =============================================================================

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);

    // Delete video using repository
    const videoRepo = yield* VideoRepository;
    yield* videoRepo.deleteVideo(resolvedParams.id);

    return { message: "Video deleted successfully" };
  });

  const runnable = Effect.provide(effect, AppLive);
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
