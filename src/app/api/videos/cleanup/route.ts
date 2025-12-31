import process from "node:process";
import { Effect } from "effect";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { createPublicLayer, handleEffectExit } from "@/lib/api-handler";
import { auth } from "@/lib/auth";
import { VideoRepository } from "@/lib/effect";
import type { ApiResponse } from "@/lib/types";

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

    const response: ApiResponse = {
      success: true,
      data: {
        message: `Cleanup completed: ${deletedCount} expired videos permanently deleted`,
        deletedCount,
      },
    };
    return response;
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
