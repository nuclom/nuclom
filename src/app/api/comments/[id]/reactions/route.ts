import { and, eq } from 'drizzle-orm';
import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';
import { createFullLayer, createPublicLayer, handleEffectExit } from '@/lib/api-handler';
import { db } from '@/lib/db';
import { commentReactions, comments, type ReactionType } from '@/lib/db/schema';
import { DatabaseError, NotFoundError, ValidationError } from '@/lib/effect';
import { Auth } from '@/lib/effect/services/auth';
import { validateRequestBody } from '@/lib/validation';

// Valid reaction types
const VALID_REACTIONS: ReactionType[] = ['like', 'love', 'laugh', 'surprised', 'sad', 'angry', 'thinking', 'celebrate'];

// =============================================================================
// GET /api/comments/[id]/reactions - Get reactions for a comment
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const { id } = yield* Effect.promise(() => params);

    // Verify comment exists
    const comment = yield* Effect.tryPromise({
      try: () => db.query.comments.findFirst({ where: eq(comments.id, id) }),
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch comment',
          operation: 'getComment',
          cause: error,
        }),
    });

    if (!comment) {
      return yield* Effect.fail(
        new NotFoundError({
          message: 'Comment not found',
          entity: 'Comment',
          id,
        }),
      );
    }

    // Get reactions with user info
    const reactions = yield* Effect.tryPromise({
      try: () =>
        db.query.commentReactions.findMany({
          where: eq(commentReactions.commentId, id),
          with: {
            user: {
              columns: { id: true, name: true, image: true },
            },
          },
        }),
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch reactions',
          operation: 'getReactions',
          cause: error,
        }),
    });

    return reactions;
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}

// =============================================================================
// POST /api/comments/[id]/reactions - Add or update reaction
// =============================================================================

const AddReactionBodySchema = Schema.Struct({
  reactionType: Schema.Literal('like', 'love', 'laugh', 'surprised', 'sad', 'angry', 'thinking', 'celebrate'),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate user
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const { id } = yield* Effect.promise(() => params);

    // Parse request body
    const body = yield* validateRequestBody(AddReactionBodySchema, request);

    // Validate reaction type
    if (!VALID_REACTIONS.includes(body.reactionType)) {
      return yield* Effect.fail(
        new ValidationError({
          message: `Invalid reaction type. Valid types: ${VALID_REACTIONS.join(', ')}`,
        }),
      );
    }

    // Verify comment exists
    const comment = yield* Effect.tryPromise({
      try: () => db.query.comments.findFirst({ where: eq(comments.id, id) }),
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch comment',
          operation: 'getComment',
          cause: error,
        }),
    });

    if (!comment) {
      return yield* Effect.fail(
        new NotFoundError({
          message: 'Comment not found',
          entity: 'Comment',
          id,
        }),
      );
    }

    // Check for existing reaction from this user on this comment
    const existingReaction = yield* Effect.tryPromise({
      try: () =>
        db.query.commentReactions.findFirst({
          where: and(eq(commentReactions.commentId, id), eq(commentReactions.userId, user.id)),
        }),
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to check existing reaction',
          operation: 'checkReaction',
          cause: error,
        }),
    });

    if (existingReaction) {
      // Update existing reaction
      const result = yield* Effect.tryPromise({
        try: () =>
          db
            .update(commentReactions)
            .set({ reactionType: body.reactionType })
            .where(eq(commentReactions.id, existingReaction.id))
            .returning(),
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to update reaction',
            operation: 'updateReaction',
            cause: error,
          }),
      });

      return { reaction: result[0], updated: true };
    }

    // Create new reaction
    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .insert(commentReactions)
          .values({
            commentId: id,
            userId: user.id,
            reactionType: body.reactionType,
          })
          .returning(),
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to add reaction',
          operation: 'addReaction',
          cause: error,
        }),
    });

    return { reaction: result[0], created: true };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}

// =============================================================================
// DELETE /api/comments/[id]/reactions - Remove user's reaction
// =============================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate user
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const { id } = yield* Effect.promise(() => params);

    // Delete user's reaction on this comment
    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .delete(commentReactions)
          .where(and(eq(commentReactions.commentId, id), eq(commentReactions.userId, user.id)))
          .returning(),
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to remove reaction',
          operation: 'removeReaction',
          cause: error,
        }),
    });

    if (result.length === 0) {
      return yield* Effect.fail(
        new NotFoundError({
          message: 'Reaction not found',
          entity: 'CommentReaction',
          id: `${id}:${user.id}`,
        }),
      );
    }

    return { message: 'Reaction removed', deleted: true };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}
