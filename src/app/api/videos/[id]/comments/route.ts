import { Cause, Effect, Exit, Layer } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AppLive, CommentRepository, NotificationRepository, VideoRepository } from "@/lib/effect";
import { Auth, makeAuthLayer } from "@/lib/effect/services/auth";
import { EmailNotifications } from "@/lib/effect/services/email-notifications";
import { Database } from "@/lib/effect/services/database";
import { commentEventEmitter } from "@/lib/realtime/comment-events";
import { env } from "@/lib/env/client";
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

    // Create notifications and send emails (fire and forget - don't block response)
    const notificationRepo = yield* NotificationRepository;
    const emailService = yield* EmailNotifications;
    const { db } = yield* Database;
    const videoRepo = yield* VideoRepository;

    const baseUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    if (validatedData.parentId) {
      // Notify parent comment author of reply
      yield* Effect.catchAll(notificationRepo.notifyCommentReply(validatedData.parentId, newComment.id, user.id, videoId), () =>
        Effect.succeed(null),
      );

      // Send email notification for reply
      yield* Effect.catchAll(
        Effect.gen(function* () {
          // Get parent comment author
          const parentComment = yield* Effect.tryPromise({
            try: () =>
              db.query.comments.findFirst({
                where: (c, { eq }) => eq(c.id, validatedData.parentId!),
                with: { author: true },
              }),
            catch: () => new Error("Failed to get parent comment"),
          });

          if (!parentComment || parentComment.authorId === user.id) return;

          const parentAuthor = (parentComment as { author: { email: string; name: string } }).author;
          if (!parentAuthor?.email) return;

          // Get video title
          const video = yield* videoRepo.getVideo(videoId);

          yield* emailService.sendCommentNotification({
            recipientEmail: parentAuthor.email,
            recipientName: parentAuthor.name || "there",
            commenterName: user.name || "Someone",
            videoTitle: video.title,
            videoUrl: `${baseUrl}/videos/${videoId}`,
            commentPreview: newComment.content.slice(0, 150) + (newComment.content.length > 150 ? "..." : ""),
            isReply: true,
          });
        }),
        () => Effect.succeed(undefined),
      );
    } else {
      // Notify video owner of new comment
      yield* Effect.catchAll(notificationRepo.notifyNewCommentOnVideo(videoId, newComment.id, user.id), () =>
        Effect.succeed(null),
      );

      // Send email notification for new comment on video
      yield* Effect.catchAll(
        Effect.gen(function* () {
          const video = yield* videoRepo.getVideo(videoId);

          // Don't send if commenter is video owner or video has no author
          if (!video.authorId || video.authorId === user.id) return;

          // Get video owner email
          const videoOwner = yield* Effect.tryPromise({
            try: () =>
              db.query.users.findFirst({
                where: (u, { eq }) => eq(u.id, video.authorId!),
              }),
            catch: () => new Error("Failed to get video owner"),
          });

          if (!videoOwner?.email) return;

          yield* emailService.sendCommentNotification({
            recipientEmail: videoOwner.email,
            recipientName: videoOwner.name || "there",
            commenterName: user.name || "Someone",
            videoTitle: video.title,
            videoUrl: `${baseUrl}/videos/${videoId}`,
            commentPreview: newComment.content.slice(0, 150) + (newComment.content.length > 150 ? "..." : ""),
            isReply: false,
          });
        }),
        () => Effect.succeed(undefined),
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
