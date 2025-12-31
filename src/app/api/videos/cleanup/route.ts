import process from "node:process";
import { Cause, Effect, Exit } from "effect";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AppLive, VideoRepository } from "@/lib/effect";
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
      default:
        console.error(`[${taggedError._tag}]`, taggedError);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
  }
  console.error("[Error]", error);
  return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
};

// =============================================================================
// POST /api/videos/cleanup - Cleanup expired soft-deleted videos
// =============================================================================

/**
 * POST /api/videos/cleanup
 *
 * Permanently deletes all videos past their retention period.
 * This endpoint should be called by a cron job or admin user.
 *
 * Requires admin role or a valid cron secret.
 */
export async function POST(request: NextRequest) {
  // Check for cron secret (for automated cleanup)
  const cronSecret = request.headers.get("x-cron-secret");
  const expectedCronSecret = process.env.CRON_SECRET;

  if (cronSecret && expectedCronSecret && cronSecret === expectedCronSecret) {
    // Valid cron request, proceed with cleanup
  } else {
    // Check for admin user
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "admin") {
      return NextResponse.json({ success: false, error: "Forbidden: Admin access required" }, { status: 403 });
    }
  }

  const effect = Effect.gen(function* () {
    const videoRepo = yield* VideoRepository;
    const deletedCount = yield* videoRepo.cleanupExpiredVideos();

    return {
      message: `Cleanup completed: ${deletedCount} expired videos permanently deleted`,
      deletedCount,
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
