import { eq } from "drizzle-orm";
import { Cause, Effect, Exit } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { createPublicLayer, mapErrorToApiResponse } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { videoShareLinks } from "@/lib/db/schema";
import { DatabaseError, NotFoundError, ValidationError } from "@/lib/effect";
import type { ApiResponse } from "@/lib/types";

// =============================================================================
// GET /api/share/[id] - Get share link data for public access
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const { id } = yield* Effect.promise(() => params);

    // Get share link with video details
    const shareLink = yield* Effect.tryPromise({
      try: () =>
        db.query.videoShareLinks.findFirst({
          where: eq(videoShareLinks.id, id),
          with: {
            video: {
              with: {
                organization: {
                  columns: { id: true, name: true, slug: true },
                },
              },
            },
          },
        }),
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch share link",
          operation: "getShareLink",
          cause: error,
        }),
    });

    if (!shareLink) {
      return yield* Effect.fail(
        new NotFoundError({
          message: "Share link not found or has been revoked",
          entity: "VideoShareLink",
          id,
        }),
      );
    }

    // Check if link is active
    if (shareLink.status !== "active") {
      return yield* Effect.fail(
        new ValidationError({
          message: "This share link has been revoked",
        }),
      );
    }

    // Check expiration
    if (shareLink.expiresAt && new Date(shareLink.expiresAt) < new Date()) {
      // Update status to expired
      yield* Effect.tryPromise({
        try: () => db.update(videoShareLinks).set({ status: "expired" }).where(eq(videoShareLinks.id, id)),
        catch: () =>
          new DatabaseError({
            message: "Failed to update status",
            operation: "updateStatus",
          }),
      });

      return yield* Effect.fail(
        new ValidationError({
          message: "This share link has expired",
        }),
      );
    }

    // Check view limit
    if (shareLink.maxViews && (shareLink.viewCount ?? 0) >= shareLink.maxViews) {
      return yield* Effect.fail(
        new ValidationError({
          message: "This share link has reached its view limit",
        }),
      );
    }

    // Return data with password as boolean (don't expose hash)
    return {
      id: shareLink.id,
      videoId: shareLink.videoId,
      accessLevel: shareLink.accessLevel,
      status: shareLink.status,
      password: !!shareLink.password,
      expiresAt: shareLink.expiresAt,
      maxViews: shareLink.maxViews,
      viewCount: shareLink.viewCount,
      video: shareLink.video,
    };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === "Some") {
        return mapErrorToApiResponse(error.value);
      }
      return mapErrorToApiResponse(new Error("Internal server error"));
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
// POST /api/share/[id] - Track view on share link (called when accessing)
// =============================================================================

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const { id } = yield* Effect.promise(() => params);

    // Get share link
    const shareLink = yield* Effect.tryPromise({
      try: () =>
        db.query.videoShareLinks.findFirst({
          where: eq(videoShareLinks.id, id),
        }),
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch share link",
          operation: "getShareLink",
          cause: error,
        }),
    });

    if (!shareLink) {
      return yield* Effect.fail(
        new NotFoundError({
          message: "Share link not found",
          entity: "VideoShareLink",
          id,
        }),
      );
    }

    // Increment view count and update last accessed
    const currentViewCount = shareLink.viewCount ?? 0;
    yield* Effect.tryPromise({
      try: () =>
        db
          .update(videoShareLinks)
          .set({
            viewCount: currentViewCount + 1,
            lastAccessedAt: new Date(),
          })
          .where(eq(videoShareLinks.id, id)),
      catch: (error) =>
        new DatabaseError({
          message: "Failed to track view",
          operation: "trackView",
          cause: error,
        }),
    });

    return { tracked: true };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === "Some") {
        return mapErrorToApiResponse(error.value);
      }
      return mapErrorToApiResponse(new Error("Internal server error"));
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
