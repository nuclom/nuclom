import { Effect } from 'effect';
import type { NextRequest } from 'next/server';
import { createFullLayer, createPublicLayer, handleEffectExit, handleEffectExitWithStatus } from '@/lib/api-handler';
import { CommentRepository, NotificationRepository, VideoRepository } from '@/lib/effect';
import { Auth } from '@/lib/effect/services/auth';
import { Database } from '@/lib/effect/services/database';
import { EmailNotifications } from '@/lib/effect/services/email-notifications';
import { getAppUrl } from '@/lib/env/server';
import { CreateCommentSchema, sanitizeComment, validateRequestBody } from '@/lib/validation';

// =============================================================================
// GET /api/videos/[id]/comments - List all comments for a video
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const { id: videoId } = yield* Effect.promise(() => params);

    // Fetch comments using repository
    const commentRepo = yield* CommentRepository;
    const comments = yield* commentRepo.getComments(videoId);

    return {
      success: true,
      data: comments,
    };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}

// =============================================================================
// POST /api/videos/[id]/comments - Create a new comment
// =============================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate user
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const { id: videoId } = yield* Effect.promise(() => params);

    // Validate request body with Zod schema
    const validatedData = yield* validateRequestBody(CreateCommentSchema, request);

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

    // Create notifications and send emails (fire and forget - don't block response)
    const notificationRepo = yield* NotificationRepository;
    const emailService = yield* EmailNotifications;
    const { db } = yield* Database;
    const videoRepo = yield* VideoRepository;

    const baseUrl = getAppUrl();

    if (validatedData.parentId) {
      // Notify parent comment author of reply
      yield* Effect.catchAll(
        notificationRepo.notifyCommentReply(validatedData.parentId, newComment.id, user.id, videoId),
        () => Effect.succeed(null),
      );

      // Send email notification for reply
      yield* Effect.catchAll(
        Effect.gen(function* () {
          // Get parent comment author
          const parentComment = yield* Effect.tryPromise({
            try: () =>
              db.query.comments.findFirst({
                where: (c, { eq }) => eq(c.id, validatedData.parentId as string),
                with: { author: true },
              }),
            catch: () => new Error('Failed to get parent comment'),
          });

          if (!parentComment || parentComment.authorId === user.id) return;

          const parentAuthor = (parentComment as { author: { email: string; name: string } }).author;
          if (!parentAuthor?.email) return;

          // Get video title
          const video = yield* videoRepo.getVideo(videoId);

          yield* emailService.sendCommentNotification({
            recipientEmail: parentAuthor.email,
            recipientName: parentAuthor.name || 'there',
            commenterName: user.name || 'Someone',
            videoTitle: video.title,
            videoUrl: `${baseUrl}/videos/${videoId}`,
            commentPreview: newComment.content.slice(0, 150) + (newComment.content.length > 150 ? '...' : ''),
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
                where: (u, { eq }) => eq(u.id, video.authorId as string),
              }),
            catch: () => new Error('Failed to get video owner'),
          });

          if (!videoOwner?.email) return;

          yield* emailService.sendCommentNotification({
            recipientEmail: videoOwner.email,
            recipientName: videoOwner.name || 'there',
            commenterName: user.name || 'Someone',
            videoTitle: video.title,
            videoUrl: `${baseUrl}/videos/${videoId}`,
            commentPreview: newComment.content.slice(0, 150) + (newComment.content.length > 150 ? '...' : ''),
            isReply: false,
          });
        }),
        () => Effect.succeed(undefined),
      );
    }

    return { success: true, data: newComment };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExitWithStatus(exit, 201);
}
