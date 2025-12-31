import { and, eq } from "drizzle-orm";
import { Cause, Effect, Exit, Layer } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { videoShareLinks } from "@/lib/db/schema";
import { AppLive, DatabaseError, NotFoundError } from "@/lib/effect";
import { Auth, makeAuthLayer } from "@/lib/effect/services/auth";
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
      default:
        console.error(`[${taggedError._tag}]`, taggedError);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
  }
  console.error("[Error]", error);
  return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
};

// =============================================================================
// DELETE /api/videos/[id]/share/[linkId] - Revoke share link
// =============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const AuthLayer = makeAuthLayer(auth);
  const FullLayer = Layer.merge(AppLive, AuthLayer);

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

    return { message: "Share link revoked", deleted: true };
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
