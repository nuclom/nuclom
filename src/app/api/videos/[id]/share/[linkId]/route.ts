import { and, eq } from "drizzle-orm";
import { Effect } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { Auth, createFullLayer, handleEffectExit } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { videoShareLinks } from "@/lib/db/schema";
import { DatabaseError, NotFoundError } from "@/lib/effect";
import type { ApiResponse } from "@/lib/types";

// =============================================================================
// DELETE /api/videos/[id]/share/[linkId] - Revoke share link
// =============================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; linkId: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate user
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    const { id, linkId } = yield* Effect.promise(() => params);

    // Delete the share link
    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .delete(videoShareLinks)
          .where(and(eq(videoShareLinks.id, linkId), eq(videoShareLinks.videoId, id)))
          .returning(),
      catch: (error) =>
        new DatabaseError({
          message: "Failed to revoke share link",
          operation: "revokeShareLink",
          cause: error,
        }),
    });

    if (result.length === 0) {
      return yield* Effect.fail(
        new NotFoundError({
          message: "Share link not found",
          entity: "VideoShareLink",
          id: linkId,
        }),
      );
    }

    const response: ApiResponse = {
      success: true,
      data: { message: "Share link revoked", deleted: true },
    };
    return response;
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
