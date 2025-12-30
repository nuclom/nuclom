import { type NextRequest, NextResponse } from "next/server";
import { Effect, Exit, Cause, Layer } from "effect";
import { auth } from "@/lib/auth";
import {
  AppLive,
  CommentRepository,
  NotificationRepository,
  NotFoundError,
  MissingFieldError,
  DatabaseError,
  UnauthorizedError,
} from "@/lib/effect";
import { makeAuthLayer, Auth } from "@/lib/effect/services/auth";
import type { ApiResponse } from "@/lib/types";
import { commentEventEmitter } from "@/lib/realtime/comment-events";

// =============================================================================
// Error Response Handler
// =============================================================================

const mapErrorToResponse = (error: unknown): NextResponse => {
  if (error && typeof error === "object" && "_tag" in error) {
    const taggedError = error as { _tag: string; message: string };

    switch (taggedError._tag) {
      case "UnauthorizedError":
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 401 });
      case "ForbiddenError":
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 403 });
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
// GET /api/videos/[id]/comments - List all comments for a video
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const { id: videoId } = yield* Effect.promise(() => params);

    // Fetch comments using repository
    const commentRepo = yield* CommentRepository;
    return yield* commentRepo.getComments(videoId);
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
// POST /api/videos/[id]/comments - Create a new comment
// =============================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const AuthLayer = makeAuthLayer(auth);
  const FullLayer = Layer.merge(AppLive, AuthLayer);

  const effect = Effect.gen(function* () {
    // Authenticate user
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const { id: videoId } = yield* Effect.promise(() => params);

    // Parse request body
    const body = yield* Effect.tryPromise({
      try: () => request.json() as Promise<{ content: string; timestamp?: string; parentId?: string }>,
      catch: () =>
        new MissingFieldError({
          field: "body",
          message: "Invalid request body",
        }),
    });

    // Validate required fields
    if (!body.content || body.content.trim().length === 0) {
      return yield* Effect.fail(
        new MissingFieldError({
          field: "content",
          message: "Comment content is required",
        }),
      );
    }

    // Create comment using repository
    const commentRepo = yield* CommentRepository;
    const newComment = yield* commentRepo.createComment({
      content: body.content.trim(),
      timestamp: body.timestamp,
      authorId: user.id,
      videoId,
      parentId: body.parentId,
    });

    // Emit real-time event
    commentEventEmitter.emit(videoId, {
      type: "created",
      comment: newComment,
      videoId,
    });

    // Create notifications (fire and forget - don't block response)
    const notificationRepo = yield* NotificationRepository;
    if (body.parentId) {
      // Notify parent comment author of reply
      yield* Effect.catchAll(notificationRepo.notifyCommentReply(body.parentId, newComment.id, user.id, videoId), () =>
        Effect.succeed(null),
      );
    } else {
      // Notify video owner of new comment
      yield* Effect.catchAll(notificationRepo.notifyNewCommentOnVideo(videoId, newComment.id, user.id), () =>
        Effect.succeed(null),
      );
    }

    return newComment;
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
      return NextResponse.json(response, { status: 201 });
    },
  });
}
