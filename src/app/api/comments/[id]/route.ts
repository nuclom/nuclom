import { Effect, Schema } from "effect";
import type { NextRequest } from "next/server";
import { createFullLayer, createPublicLayer, handleEffectExit } from "@/lib/api-handler";
import { CommentRepository, MissingFieldError } from "@/lib/effect";
import { Auth } from "@/lib/effect/services/auth";
import { validateRequestBody } from "@/lib/validation";

// =============================================================================
// GET /api/comments/[id] - Get a single comment
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const { id } = yield* Effect.promise(() => params);
    const commentRepo = yield* CommentRepository;
    return yield* commentRepo.getComment(id);
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}

// =============================================================================
// PATCH /api/comments/[id] - Update a comment
// =============================================================================

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate user
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const { id } = yield* Effect.promise(() => params);

    // Parse request body
    const body = yield* validateRequestBody(
      Schema.Struct({
        content: Schema.String,
      }),
      request,
    );

    // Validate required fields
    if (!body.content || body.content.trim().length === 0) {
      return yield* Effect.fail(
        new MissingFieldError({
          field: "content",
          message: "Comment content is required",
        }),
      );
    }

    // Update comment using repository
    const commentRepo = yield* CommentRepository;
    const updatedComment = yield* commentRepo.updateComment(id, user.id, {
      content: body.content.trim(),
    });

    return updatedComment;
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}

// =============================================================================
// DELETE /api/comments/[id] - Delete a comment
// =============================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate user
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const { id } = yield* Effect.promise(() => params);

    // Delete comment using repository
    const commentRepo = yield* CommentRepository;
    const deletedComment = yield* commentRepo.deleteComment(id, user.id);

    return { message: "Comment deleted successfully", id: deletedComment.id };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}
