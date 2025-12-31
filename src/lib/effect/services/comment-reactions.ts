/**
 * Comment Reactions Service using Effect-TS
 *
 * Manages reactions on comments:
 * - Add/remove reactions
 * - Get reaction counts
 * - Get users who reacted
 */

import { and, eq, sql } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import { type CommentReaction, commentReactions, type ReactionType, users } from "@/lib/db/schema";
import { DatabaseError, NotFoundError } from "../errors";
import { Database } from "./database";

// =============================================================================
// Types
// =============================================================================

export interface ReactionCount {
  readonly reactionType: ReactionType;
  readonly count: number;
}

export interface ReactionUser {
  readonly userId: string;
  readonly userName: string;
  readonly userImage: string | null;
  readonly reactionType: ReactionType;
  readonly createdAt: Date;
}

export interface CommentWithReactions {
  readonly commentId: string;
  readonly reactions: ReactionCount[];
  readonly userReactions: ReactionType[];
  readonly totalReactions: number;
}

export interface CommentReactionsServiceInterface {
  /**
   * Add a reaction to a comment
   */
  readonly addReaction: (
    commentId: string,
    userId: string,
    reactionType: ReactionType,
  ) => Effect.Effect<CommentReaction, DatabaseError>;

  /**
   * Remove a reaction from a comment
   */
  readonly removeReaction: (
    commentId: string,
    userId: string,
    reactionType: ReactionType,
  ) => Effect.Effect<void, DatabaseError | NotFoundError>;

  /**
   * Toggle a reaction (add if not exists, remove if exists)
   */
  readonly toggleReaction: (
    commentId: string,
    userId: string,
    reactionType: ReactionType,
  ) => Effect.Effect<{ added: boolean }, DatabaseError>;

  /**
   * Get reaction counts for a comment
   */
  readonly getReactionCounts: (commentId: string) => Effect.Effect<ReactionCount[], DatabaseError>;

  /**
   * Get reactions with counts for multiple comments
   */
  readonly getReactionsForComments: (
    commentIds: string[],
    userId?: string,
  ) => Effect.Effect<Map<string, CommentWithReactions>, DatabaseError>;

  /**
   * Get users who reacted to a comment
   */
  readonly getReactionUsers: (
    commentId: string,
    reactionType?: ReactionType,
    limit?: number,
  ) => Effect.Effect<ReactionUser[], DatabaseError>;

  /**
   * Get user's reactions on a comment
   */
  readonly getUserReactions: (commentId: string, userId: string) => Effect.Effect<ReactionType[], DatabaseError>;

  /**
   * Check if user has reacted with specific type
   */
  readonly hasReacted: (
    commentId: string,
    userId: string,
    reactionType: ReactionType,
  ) => Effect.Effect<boolean, DatabaseError>;
}

// =============================================================================
// Comment Reactions Service Tag
// =============================================================================

export class CommentReactionsService extends Context.Tag("CommentReactionsService")<
  CommentReactionsService,
  CommentReactionsServiceInterface
>() {}

// =============================================================================
// Comment Reactions Service Implementation
// =============================================================================

const makeCommentReactionsService = Effect.gen(function* () {
  const { db } = yield* Database;

  const addReaction = (
    commentId: string,
    userId: string,
    reactionType: ReactionType,
  ): Effect.Effect<CommentReaction, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const [reaction] = await db
          .insert(commentReactions)
          .values({
            commentId,
            userId,
            reactionType,
            createdAt: new Date(),
          })
          .onConflictDoNothing()
          .returning();

        // If conflict (already exists), fetch the existing one
        if (!reaction) {
          const existing = await db
            .select()
            .from(commentReactions)
            .where(
              and(
                eq(commentReactions.commentId, commentId),
                eq(commentReactions.userId, userId),
                eq(commentReactions.reactionType, reactionType),
              ),
            )
            .limit(1);

          return existing[0];
        }

        return reaction;
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to add reaction",
          operation: "addReaction",
          cause: error,
        }),
    });

  const removeReaction = (
    commentId: string,
    userId: string,
    reactionType: ReactionType,
  ): Effect.Effect<void, DatabaseError | NotFoundError> =>
    Effect.tryPromise({
      try: async () => {
        const result = await db
          .delete(commentReactions)
          .where(
            and(
              eq(commentReactions.commentId, commentId),
              eq(commentReactions.userId, userId),
              eq(commentReactions.reactionType, reactionType),
            ),
          )
          .returning({ id: commentReactions.id });

        if (result.length === 0) {
          throw new NotFoundError({
            message: "Reaction not found",
            entity: "CommentReaction",
          });
        }
      },
      catch: (error) => {
        if (error instanceof NotFoundError) {
          return error;
        }
        return new DatabaseError({
          message: "Failed to remove reaction",
          operation: "removeReaction",
          cause: error,
        });
      },
    });

  const toggleReaction = (
    commentId: string,
    userId: string,
    reactionType: ReactionType,
  ): Effect.Effect<{ added: boolean }, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        // Check if reaction exists
        const existing = await db
          .select({ id: commentReactions.id })
          .from(commentReactions)
          .where(
            and(
              eq(commentReactions.commentId, commentId),
              eq(commentReactions.userId, userId),
              eq(commentReactions.reactionType, reactionType),
            ),
          )
          .limit(1);

        if (existing.length > 0) {
          // Remove the reaction
          await db.delete(commentReactions).where(eq(commentReactions.id, existing[0].id));
          return { added: false };
        } else {
          // Add the reaction
          await db.insert(commentReactions).values({
            commentId,
            userId,
            reactionType,
            createdAt: new Date(),
          });
          return { added: true };
        }
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to toggle reaction",
          operation: "toggleReaction",
          cause: error,
        }),
    });

  const getReactionCounts = (commentId: string): Effect.Effect<ReactionCount[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const counts = await db
          .select({
            reactionType: commentReactions.reactionType,
            count: sql<number>`count(*)::int`,
          })
          .from(commentReactions)
          .where(eq(commentReactions.commentId, commentId))
          .groupBy(commentReactions.reactionType);

        return counts.map((c) => ({
          reactionType: c.reactionType,
          count: c.count,
        }));
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to get reaction counts",
          operation: "getReactionCounts",
          cause: error,
        }),
    });

  const getReactionsForComments = (
    commentIds: string[],
    userId?: string,
  ): Effect.Effect<Map<string, CommentWithReactions>, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        if (commentIds.length === 0) {
          return new Map();
        }

        // Get all reaction counts grouped by comment
        const counts = await db
          .select({
            commentId: commentReactions.commentId,
            reactionType: commentReactions.reactionType,
            count: sql<number>`count(*)::int`,
          })
          .from(commentReactions)
          .where(sql`${commentReactions.commentId} = ANY(${commentIds})`)
          .groupBy(commentReactions.commentId, commentReactions.reactionType);

        // Get user's reactions if userId provided
        const userReactionsMap = new Map<string, ReactionType[]>();
        if (userId) {
          const userReactions = await db
            .select({
              commentId: commentReactions.commentId,
              reactionType: commentReactions.reactionType,
            })
            .from(commentReactions)
            .where(and(sql`${commentReactions.commentId} = ANY(${commentIds})`, eq(commentReactions.userId, userId)));

          for (const ur of userReactions) {
            const existing = userReactionsMap.get(ur.commentId) || [];
            existing.push(ur.reactionType);
            userReactionsMap.set(ur.commentId, existing);
          }
        }

        // Build result map
        const result = new Map<string, CommentWithReactions>();

        for (const commentId of commentIds) {
          const commentCounts = counts.filter((c) => c.commentId === commentId);
          const reactions = commentCounts.map((c) => ({
            reactionType: c.reactionType,
            count: c.count,
          }));
          const totalReactions = reactions.reduce((sum, r) => sum + r.count, 0);

          result.set(commentId, {
            commentId,
            reactions,
            userReactions: userReactionsMap.get(commentId) || [],
            totalReactions,
          });
        }

        return result;
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to get reactions for comments",
          operation: "getReactionsForComments",
          cause: error,
        }),
    });

  const getReactionUsers = (
    commentId: string,
    reactionType?: ReactionType,
    limit = 50,
  ): Effect.Effect<ReactionUser[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const conditions = [eq(commentReactions.commentId, commentId)];

        if (reactionType) {
          conditions.push(eq(commentReactions.reactionType, reactionType));
        }

        const reactionUsers = await db
          .select({
            userId: commentReactions.userId,
            userName: users.name,
            userImage: users.image,
            reactionType: commentReactions.reactionType,
            createdAt: commentReactions.createdAt,
          })
          .from(commentReactions)
          .innerJoin(users, eq(commentReactions.userId, users.id))
          .where(and(...conditions))
          .limit(limit);

        return reactionUsers.map((r) => ({
          userId: r.userId,
          userName: r.userName,
          userImage: r.userImage,
          reactionType: r.reactionType,
          createdAt: r.createdAt,
        }));
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to get reaction users",
          operation: "getReactionUsers",
          cause: error,
        }),
    });

  const getUserReactions = (commentId: string, userId: string): Effect.Effect<ReactionType[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const reactions = await db
          .select({ reactionType: commentReactions.reactionType })
          .from(commentReactions)
          .where(and(eq(commentReactions.commentId, commentId), eq(commentReactions.userId, userId)));

        return reactions.map((r) => r.reactionType);
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to get user reactions",
          operation: "getUserReactions",
          cause: error,
        }),
    });

  const hasReacted = (
    commentId: string,
    userId: string,
    reactionType: ReactionType,
  ): Effect.Effect<boolean, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const result = await db
          .select({ id: commentReactions.id })
          .from(commentReactions)
          .where(
            and(
              eq(commentReactions.commentId, commentId),
              eq(commentReactions.userId, userId),
              eq(commentReactions.reactionType, reactionType),
            ),
          )
          .limit(1);

        return result.length > 0;
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to check reaction",
          operation: "hasReacted",
          cause: error,
        }),
    });

  return {
    addReaction,
    removeReaction,
    toggleReaction,
    getReactionCounts,
    getReactionsForComments,
    getReactionUsers,
    getUserReactions,
    hasReacted,
  } satisfies CommentReactionsServiceInterface;
});

// =============================================================================
// Comment Reactions Layer
// =============================================================================

export const CommentReactionsServiceLive = Layer.effect(CommentReactionsService, makeCommentReactionsService);

// =============================================================================
// Helper Functions
// =============================================================================

export const toggleReaction = (
  commentId: string,
  userId: string,
  reactionType: ReactionType,
): Effect.Effect<{ added: boolean }, DatabaseError, CommentReactionsService> =>
  Effect.gen(function* () {
    const service = yield* CommentReactionsService;
    return yield* service.toggleReaction(commentId, userId, reactionType);
  });

export const getReactionCounts = (
  commentId: string,
): Effect.Effect<ReactionCount[], DatabaseError, CommentReactionsService> =>
  Effect.gen(function* () {
    const service = yield* CommentReactionsService;
    return yield* service.getReactionCounts(commentId);
  });

export const getReactionsForComments = (
  commentIds: string[],
  userId?: string,
): Effect.Effect<Map<string, CommentWithReactions>, DatabaseError, CommentReactionsService> =>
  Effect.gen(function* () {
    const service = yield* CommentReactionsService;
    return yield* service.getReactionsForComments(commentIds, userId);
  });
