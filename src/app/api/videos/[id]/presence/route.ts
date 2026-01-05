import { eq } from "drizzle-orm";
import { Effect, Option } from "effect";
import type { NextRequest } from "next/server";
import { createFullLayer, handleEffectExit, handleEffectExitWithStatus } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { videos } from "@/lib/db/schema";
import { DatabaseError, NotFoundError, ValidationError } from "@/lib/effect";
import { Auth } from "@/lib/effect/services/auth";
import { Presence } from "@/lib/effect/services/presence";

// =============================================================================
// GET /api/videos/[id]/presence - Get all users currently watching a video
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const videoId = resolvedParams.id;

    // Get video presence
    const presenceService = yield* Presence;
    const viewers = yield* presenceService.getVideoPresence(videoId);

    return {
      success: true,
      data: viewers,
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}

// =============================================================================
// POST /api/videos/[id]/presence - Update current user's presence (heartbeat)
// =============================================================================

interface UpdatePresenceBody {
  currentTime?: number;
  status?: "online" | "away" | "busy";
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const videoId = resolvedParams.id;

    // Authenticate user
    const authService = yield* Auth;
    const sessionOption = yield* authService.getSessionOption(request.headers);

    // Allow anonymous users to be tracked (for view counts)
    const userId = Option.isSome(sessionOption) ? sessionOption.value.user.id : null;

    // If no user, skip presence update (require authentication for presence)
    if (!userId) {
      return yield* Effect.fail(
        new ValidationError({
          message: "Authentication required for presence tracking",
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

    // Parse request body (optional)
    const bodyOption = yield* Effect.tryPromise({
      try: async () => {
        try {
          return await request.json();
        } catch {
          return null;
        }
      },
      catch: () => null,
    });

    const body = bodyOption as UpdatePresenceBody | null;

    // Update presence
    const presenceService = yield* Presence;
    yield* presenceService.updatePresence(userId, video.organizationId, {
      videoId,
      status: body?.status || "online",
      currentTime: body?.currentTime,
    });

    return {
      success: true,
      data: { updated: true },
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExitWithStatus(exit, 201);
}
