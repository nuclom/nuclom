import { and, eq } from "drizzle-orm";
import { Cause, Effect, Exit, Option } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { createFullLayer, createPublicLayer, handleEffectExit, mapErrorToApiResponse } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { videos, videoViews } from "@/lib/db/schema";
import { DatabaseError, MissingFieldError, NotFoundError, ValidationError } from "@/lib/effect";
import { Auth } from "@/lib/effect/services/auth";
import type { ApiResponse } from "@/lib/types";

// =============================================================================
// POST /api/videos/[id]/views - Track view start
// =============================================================================

interface TrackViewBody {
  sessionId: string;
  source?: "direct" | "share_link" | "embed";
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const videoId = resolvedParams.id;

    // Parse request body
    const body = yield* Effect.tryPromise({
      try: () => request.json() as Promise<TrackViewBody>,
      catch: () =>
        new MissingFieldError({
          field: "body",
          message: "Invalid request body",
        }),
    });

    // Validate sessionId
    if (!body.sessionId || typeof body.sessionId !== "string") {
      return yield* Effect.fail(
        new ValidationError({
          message: "sessionId is required",
        }),
      );
    }

    // Get video to ensure it exists and get organizationId
    const video = yield* Effect.tryPromise({
      try: () =>
        db.query.videos.findFirst({
          where: eq(videos.id, videoId),
        }),
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch video",
          operation: "getVideo",
          cause: error,
        }),
    });

    if (!video) {
      return yield* Effect.fail(
        new NotFoundError({
          message: "Video not found",
          entity: "Video",
          id: videoId,
        }),
      );
    }

    // Try to get user session (optional - anonymous views are allowed)
    const authService = yield* Auth;
    const sessionOption = yield* authService.getSessionOption(request.headers);
    const userId = Option.isSome(sessionOption) ? sessionOption.value.user.id : null;

    // Check if view already exists for this session+video
    const existingView = yield* Effect.tryPromise({
      try: () =>
        db.query.videoViews.findFirst({
          where: and(eq(videoViews.videoId, videoId), eq(videoViews.sessionId, body.sessionId)),
        }),
      catch: (error) =>
        new DatabaseError({
          message: "Failed to check existing view",
          operation: "checkView",
          cause: error,
        }),
    });

    // If view already exists, return success without creating a new one
    if (existingView) {
      return { success: true, viewId: existingView.id, isNewView: false };
    }

    // Determine source from referrer if not provided
    const referrer = request.headers.get("referer") || null;
    const source = body.source || (referrer?.includes("share") ? "share_link" : "direct");

    // Create new view
    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .insert(videoViews)
          .values({
            videoId,
            sessionId: body.sessionId,
            userId,
            organizationId: video.organizationId,
            source,
            referrer,
            userAgent: request.headers.get("user-agent"),
          })
          .returning(),
      catch: (error) =>
        new DatabaseError({
          message: "Failed to track view",
          operation: "createView",
          cause: error,
        }),
    });

    return { success: true, viewId: result[0].id, isNewView: true };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === "Some") {
        return mapErrorToApiResponse(error.value);
      }
      return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    },
    onSuccess: (data) => {
      const response: ApiResponse = {
        success: true,
        data,
      };
      return NextResponse.json(response, { status: 201 });
    },
  });
}

// =============================================================================
// PATCH /api/videos/[id]/views - Update watch progress
// =============================================================================

interface UpdateViewBody {
  sessionId: string;
  watchDuration: number;
  completionPercent: number;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const videoId = resolvedParams.id;

    // Parse request body
    const body = yield* Effect.tryPromise({
      try: () => request.json() as Promise<UpdateViewBody>,
      catch: () =>
        new MissingFieldError({
          field: "body",
          message: "Invalid request body",
        }),
    });

    // Validate fields
    if (!body.sessionId || typeof body.sessionId !== "string") {
      return yield* Effect.fail(
        new ValidationError({
          message: "sessionId is required",
        }),
      );
    }

    if (typeof body.watchDuration !== "number" || body.watchDuration < 0) {
      return yield* Effect.fail(
        new ValidationError({
          message: "watchDuration must be a non-negative number",
        }),
      );
    }

    if (typeof body.completionPercent !== "number" || body.completionPercent < 0 || body.completionPercent > 100) {
      return yield* Effect.fail(
        new ValidationError({
          message: "completionPercent must be between 0 and 100",
        }),
      );
    }

    // Update the view record
    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .update(videoViews)
          .set({
            watchDuration: Math.floor(body.watchDuration),
            completionPercent: Math.floor(body.completionPercent),
            updatedAt: new Date(),
          })
          .where(and(eq(videoViews.videoId, videoId), eq(videoViews.sessionId, body.sessionId)))
          .returning(),
      catch: (error) =>
        new DatabaseError({
          message: "Failed to update view",
          operation: "updateView",
          cause: error,
        }),
    });

    if (result.length === 0) {
      return yield* Effect.fail(
        new NotFoundError({
          message: "View not found for this session",
          entity: "VideoView",
          id: `${videoId}:${body.sessionId}`,
        }),
      );
    }

    return {
      success: true,
      data: { success: true, updated: true },
    };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}

// =============================================================================
// GET /api/videos/[id]/views - Get view count for a video
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const videoId = resolvedParams.id;

    // Get view count and stats
    const views = yield* Effect.tryPromise({
      try: () =>
        db.query.videoViews.findMany({
          where: eq(videoViews.videoId, videoId),
        }),
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch views",
          operation: "getViews",
          cause: error,
        }),
    });

    const viewCount = views.length;
    const uniqueViewers = new Set(views.filter((v) => v.userId).map((v) => v.userId)).size;
    const totalWatchTime = views.reduce((sum, v) => sum + (v.watchDuration || 0), 0);
    const avgCompletionPercent =
      viewCount > 0 ? Math.round(views.reduce((sum, v) => sum + (v.completionPercent || 0), 0) / viewCount) : 0;

    return {
      success: true,
      data: {
        viewCount,
        uniqueViewers,
        totalWatchTime,
        avgCompletionPercent,
      },
    };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}
