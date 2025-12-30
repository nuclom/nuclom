import { Cause, Effect, Exit, Layer } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AppLive, CommentRepository, NotificationRepository } from "@/lib/effect";
import { Auth, makeAuthLayer } from "@/lib/effect/services/auth";
import { commentEventEmitter } from "@/lib/realtime/comment-events";
import type { ApiResponse } from "@/lib/types";
import { validateRequestBody, createCommentSchema, sanitizeComment } from "@/lib/validation";

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

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    // Validate request body with Zod schema
    const validatedData = yield* validateRequestBody(createCommentSchema, request);

    // Sanitize comment content to prevent XSS
    const sanitizedContent = sanitizeComment(validatedData.content);

    // Create comment using repository
    const commentRepo = yield* CommentRepository;
    const newComment = yield* commentRepo.createComment({
      content: sanitizedContent,
      timestamp: validatedData.timestamp ?? undefined,
      authorId: user.id,
      videoId,
      parentId: validatedData.parentId ?? undefined,
    });

    // Emit real-time event
    commentEventEmitter.emit(videoId, {
      type: "created",
      comment: newComment,
      videoId,
    });

    // Create notifications (fire and forget - don't block response)
    const notificationRepo = yield* NotificationRepository;
    if (validatedData.parentId) {
      // Notify parent comment author of reply
      yield* Effect.catchAll(notificationRepo.notifyCommentReply(validatedData.parentId, newComment.id, user.id, videoId), () =>
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
