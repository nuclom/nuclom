import { asc, eq, isNull } from "drizzle-orm";
import { Cause, Effect, Exit, Option } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { CachePresets, getCacheControlHeader } from "@/lib/api-utils";
import { db } from "@/lib/db";
import type { NewVideo } from "@/lib/db/schema";
import { comments, videos } from "@/lib/db/schema";
import { AppLive, DatabaseError, NotFoundError, ValidationError, VideoRepository } from "@/lib/effect";
import { releaseVideoCount } from "@/lib/effect/services/billing-middleware";
import { BillingRepository } from "@/lib/effect/services/billing-repository";
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
      // Use short cache with stale-while-revalidate for video details
      // AI analysis data is included, so it benefits from caching
      return NextResponse.json(response, {
        headers: {
          "Cache-Control": getCacheControlHeader(CachePresets.shortWithSwr()),
        },
      });
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

/**
 * DELETE /api/videos/[id]
 *
 * By default, performs a soft delete with a 30-day retention period.
 * Query parameters:
 * - permanent=true: Permanently delete the video and clean up R2 storage
 * - retentionDays=N: Override the default retention period (only for soft delete)
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const url = new URL(request.url);
  const permanent = url.searchParams.get("permanent") === "true";
  const retentionDaysParam = url.searchParams.get("retentionDays");
  const retentionDays = retentionDaysParam ? Number.parseInt(retentionDaysParam, 10) : undefined;

  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);

    const videoRepo = yield* VideoRepository;
    const video = yield* videoRepo.getVideo(resolvedParams.id);

    if (permanent) {
      // Permanently delete video and clean up R2 storage
      yield* videoRepo.deleteVideo(resolvedParams.id);

      // Release usage tracking for the organization
      const billingRepo = yield* BillingRepository;
      const subscriptionOption = yield* billingRepo.getSubscriptionOption(video.organizationId);

      if (Option.isSome(subscriptionOption)) {
        yield* releaseVideoCount(video.organizationId).pipe(Effect.catchAll(() => Effect.void));
      }

      return { message: "Video permanently deleted" };
    }
    // Soft delete with retention period
    const deletedVideo = yield* videoRepo.softDeleteVideo(resolvedParams.id, { retentionDays });
    return {
      message: "Video moved to trash",
      deletedAt: deletedVideo.deletedAt,
      retentionUntil: deletedVideo.retentionUntil,
    };
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
