import { type NextRequest, NextResponse } from "next/server";
import { Effect, Exit, Cause } from "effect";
import { eq, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { videos, videoCodeSnippets } from "@/lib/db/schema";
import type { ApiResponse } from "@/lib/types";
import { AppLive, NotFoundError, DatabaseError } from "@/lib/effect";

// =============================================================================
// Error Response Handler
// =============================================================================

const mapErrorToResponse = (error: unknown): NextResponse => {
  if (error && typeof error === "object" && "_tag" in error) {
    const taggedError = error as { _tag: string; message: string };

    switch (taggedError._tag) {
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
// GET /api/videos/[id]/code-snippets - Get video code snippets
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const videoId = resolvedParams.id;

    // Check if video exists
    const video = yield* Effect.tryPromise({
      try: () =>
        db.query.videos.findFirst({
          where: eq(videos.id, videoId),
          columns: { id: true },
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

    // Get code snippets
    const codeSnippets = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(videoCodeSnippets)
          .where(eq(videoCodeSnippets.videoId, videoId))
          .orderBy(asc(videoCodeSnippets.timestamp)),
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch code snippets",
          operation: "getCodeSnippets",
          cause: error,
        }),
    });

    return {
      videoId,
      codeSnippets,
      count: codeSnippets.length,
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
