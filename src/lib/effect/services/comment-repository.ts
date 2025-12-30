/**
 * Comment Repository Service using Effect-TS
 *
 * Provides type-safe database operations for comments with support for
 * threaded replies, real-time updates, and timestamped comments.
 */

import { asc, eq } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import type { Comment, User } from "@/lib/db/schema";
import { comments, users, videos } from "@/lib/db/schema";
import { DatabaseError, ForbiddenError, NotFoundError } from "../errors";
import { Database } from "./database";

// =============================================================================
// Types
// =============================================================================

export type CommentWithAuthor = Comment & { author: User };

export type CommentWithReplies = CommentWithAuthor & {
  replies: CommentWithAuthor[];
};

export interface CreateCommentInput {
  readonly content: string;
  readonly timestamp?: string;
  readonly authorId: string;
  readonly videoId: string;
  readonly parentId?: string;
}

export interface UpdateCommentInput {
  readonly content: string;
}

export interface CommentEvent {
  readonly type: "created" | "updated" | "deleted";
  readonly comment: CommentWithAuthor;
  readonly videoId: string;
}

export interface CommentRepositoryService {
  /**
   * Get all comments for a video with threaded replies
   */
  readonly getComments: (videoId: string) => Effect.Effect<CommentWithReplies[], DatabaseError>;

  /**
   * Get a single comment
   */
  readonly getComment: (id: string) => Effect.Effect<CommentWithAuthor, DatabaseError | NotFoundError>;

  /**
   * Create a new comment
   */
  readonly createComment: (data: CreateCommentInput) => Effect.Effect<CommentWithAuthor, DatabaseError | NotFoundError>;

  /**
   * Update a comment (only by author)
   */
  readonly updateComment: (
    id: string,
    authorId: string,
    data: UpdateCommentInput,
  ) => Effect.Effect<CommentWithAuthor, DatabaseError | NotFoundError | ForbiddenError>;

  /**
   * Delete a comment (only by author or video owner)
   */
  readonly deleteComment: (
    id: string,
    userId: string,
  ) => Effect.Effect<CommentWithAuthor, DatabaseError | NotFoundError | ForbiddenError>;

  /**
   * Get comments for a video by timestamp range (for video player integration)
   */
  readonly getCommentsByTimestamp: (
    videoId: string,
    startTime: string,
    endTime: string,
  ) => Effect.Effect<CommentWithAuthor[], DatabaseError>;
}

// =============================================================================
// Comment Repository Tag
// =============================================================================

export class CommentRepository extends Context.Tag("CommentRepository")<
  CommentRepository,
  CommentRepositoryService
>() {}

// =============================================================================
// Helper to fetch comment with author
// =============================================================================

const selectCommentWithAuthor = {
  id: comments.id,
  content: comments.content,
  timestamp: comments.timestamp,
  authorId: comments.authorId,
  videoId: comments.videoId,
  parentId: comments.parentId,
  createdAt: comments.createdAt,
  updatedAt: comments.updatedAt,
  author: {
    id: users.id,
    email: users.email,
    name: users.name,
    image: users.image,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt,
    emailVerified: users.emailVerified,
    role: users.role,
    banned: users.banned,
    banReason: users.banReason,
    banExpires: users.banExpires,
  },
};

// =============================================================================
// Comment Repository Implementation
// =============================================================================

const makeCommentRepositoryService = Effect.gen(function* () {
  const { db } = yield* Database;

  const getComments = (videoId: string): Effect.Effect<CommentWithReplies[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        // Get all comments for the video
        const allComments = await db
          .select(selectCommentWithAuthor)
          .from(comments)
          .innerJoin(users, eq(comments.authorId, users.id))
          .where(eq(comments.videoId, videoId))
          .orderBy(asc(comments.createdAt));

        // Build threaded structure
        const topLevelComments: CommentWithReplies[] = [];
        const commentMap = new Map<string, CommentWithReplies>();

        // First pass: create all comment objects with empty replies
        for (const comment of allComments) {
          commentMap.set(comment.id, {
            ...comment,
            replies: [],
          } as CommentWithReplies);
        }

        // Second pass: build the tree structure
        for (const comment of allComments) {
          const commentObj = commentMap.get(comment.id);
          if (!commentObj) continue;
          if (comment.parentId && commentMap.has(comment.parentId)) {
            commentMap.get(comment.parentId)?.replies.push(commentObj);
          } else {
            topLevelComments.push(commentObj);
          }
        }

        return topLevelComments;
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch comments",
          operation: "getComments",
          cause: error,
        }),
    });

  const getComment = (id: string): Effect.Effect<CommentWithAuthor, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          return await db
            .select(selectCommentWithAuthor)
            .from(comments)
            .innerJoin(users, eq(comments.authorId, users.id))
            .where(eq(comments.id, id))
            .limit(1);
        },
        catch: (error) =>
          new DatabaseError({
            message: "Failed to fetch comment",
            operation: "getComment",
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: "Comment not found",
            entity: "Comment",
            id,
          }),
        );
      }

      return result[0] as CommentWithAuthor;
    });

  const createComment = (data: CreateCommentInput): Effect.Effect<CommentWithAuthor, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      // Verify video exists
      const videoExists = yield* Effect.tryPromise({
        try: async () => {
          return await db.select({ id: videos.id }).from(videos).where(eq(videos.id, data.videoId)).limit(1);
        },
        catch: (error) =>
          new DatabaseError({
            message: "Failed to verify video",
            operation: "createComment.verifyVideo",
            cause: error,
          }),
      });

      if (!videoExists.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: "Video not found",
            entity: "Video",
            id: data.videoId,
          }),
        );
      }

      // If parentId is provided, verify it exists
      if (data.parentId) {
        const parentId = data.parentId;
        const parentExists = yield* Effect.tryPromise({
          try: async () => {
            return await db.select({ id: comments.id }).from(comments).where(eq(comments.id, parentId)).limit(1);
          },
          catch: (error) =>
            new DatabaseError({
              message: "Failed to verify parent comment",
              operation: "createComment.verifyParent",
              cause: error,
            }),
        });

        if (!parentExists.length) {
          return yield* Effect.fail(
            new NotFoundError({
              message: "Parent comment not found",
              entity: "Comment",
              id: data.parentId,
            }),
          );
        }
      }

      // Create the comment
      const [newComment] = yield* Effect.tryPromise({
        try: async () => {
          return await db.insert(comments).values(data).returning();
        },
        catch: (error) =>
          new DatabaseError({
            message: "Failed to create comment",
            operation: "createComment",
            cause: error,
          }),
      });

      // Fetch with author
      return yield* getComment(newComment.id);
    });

  const updateComment = (
    id: string,
    authorId: string,
    data: UpdateCommentInput,
  ): Effect.Effect<CommentWithAuthor, DatabaseError | NotFoundError | ForbiddenError> =>
    Effect.gen(function* () {
      // Check if comment exists and belongs to the user
      const existingComment = yield* getComment(id);

      if (existingComment.authorId !== authorId) {
        return yield* Effect.fail(
          new ForbiddenError({
            message: "You can only edit your own comments",
            resource: "Comment",
          }),
        );
      }

      // Update the comment
      yield* Effect.tryPromise({
        try: async () => {
          return await db
            .update(comments)
            .set({ content: data.content, updatedAt: new Date() })
            .where(eq(comments.id, id))
            .returning();
        },
        catch: (error) =>
          new DatabaseError({
            message: "Failed to update comment",
            operation: "updateComment",
            cause: error,
          }),
      });

      // Fetch updated comment with author
      return yield* getComment(id);
    });

  const deleteComment = (
    id: string,
    userId: string,
  ): Effect.Effect<CommentWithAuthor, DatabaseError | NotFoundError | ForbiddenError> =>
    Effect.gen(function* () {
      // Get the comment with author
      const existingComment = yield* getComment(id);

      // Check if user is the author
      if (existingComment.authorId !== userId) {
        // Check if user is the video owner
        const videoData = yield* Effect.tryPromise({
          try: async () => {
            return await db
              .select({ authorId: videos.authorId })
              .from(videos)
              .where(eq(videos.id, existingComment.videoId))
              .limit(1);
          },
          catch: (error) =>
            new DatabaseError({
              message: "Failed to verify video ownership",
              operation: "deleteComment.verifyOwner",
              cause: error,
            }),
        });

        if (!videoData.length || videoData[0].authorId !== userId) {
          return yield* Effect.fail(
            new ForbiddenError({
              message: "You can only delete your own comments or comments on your videos",
              resource: "Comment",
            }),
          );
        }
      }

      // Delete all replies first (cascade not automatic due to self-reference)
      yield* Effect.tryPromise({
        try: async () => {
          return await db.delete(comments).where(eq(comments.parentId, id));
        },
        catch: (error) =>
          new DatabaseError({
            message: "Failed to delete comment replies",
            operation: "deleteComment.deleteReplies",
            cause: error,
          }),
      });

      // Delete the comment
      yield* Effect.tryPromise({
        try: async () => {
          return await db.delete(comments).where(eq(comments.id, id));
        },
        catch: (error) =>
          new DatabaseError({
            message: "Failed to delete comment",
            operation: "deleteComment",
            cause: error,
          }),
      });

      return existingComment;
    });

  const getCommentsByTimestamp = (
    videoId: string,
    startTime: string,
    endTime: string,
  ): Effect.Effect<CommentWithAuthor[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const result = await db
          .select(selectCommentWithAuthor)
          .from(comments)
          .innerJoin(users, eq(comments.authorId, users.id))
          .where(eq(comments.videoId, videoId))
          .orderBy(asc(comments.timestamp));

        // Filter by timestamp range (in-memory since timestamps are strings)
        return result.filter((comment) => {
          if (!comment.timestamp) return false;
          return comment.timestamp >= startTime && comment.timestamp <= endTime;
        }) as CommentWithAuthor[];
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch comments by timestamp",
          operation: "getCommentsByTimestamp",
          cause: error,
        }),
    });

  return {
    getComments,
    getComment,
    createComment,
    updateComment,
    deleteComment,
    getCommentsByTimestamp,
  } satisfies CommentRepositoryService;
});

// =============================================================================
// Comment Repository Layer
// =============================================================================

export const CommentRepositoryLive = Layer.effect(CommentRepository, makeCommentRepositoryService);

// =============================================================================
// Comment Repository Helper Functions
// =============================================================================

export const getComments = (videoId: string): Effect.Effect<CommentWithReplies[], DatabaseError, CommentRepository> =>
  Effect.gen(function* () {
    const repo = yield* CommentRepository;
    return yield* repo.getComments(videoId);
  });

export const getComment = (
  id: string,
): Effect.Effect<CommentWithAuthor, DatabaseError | NotFoundError, CommentRepository> =>
  Effect.gen(function* () {
    const repo = yield* CommentRepository;
    return yield* repo.getComment(id);
  });

export const createComment = (
  data: CreateCommentInput,
): Effect.Effect<CommentWithAuthor, DatabaseError | NotFoundError, CommentRepository> =>
  Effect.gen(function* () {
    const repo = yield* CommentRepository;
    return yield* repo.createComment(data);
  });

export const updateComment = (
  id: string,
  authorId: string,
  data: UpdateCommentInput,
): Effect.Effect<CommentWithAuthor, DatabaseError | NotFoundError | ForbiddenError, CommentRepository> =>
  Effect.gen(function* () {
    const repo = yield* CommentRepository;
    return yield* repo.updateComment(id, authorId, data);
  });

export const deleteComment = (
  id: string,
  userId: string,
): Effect.Effect<CommentWithAuthor, DatabaseError | NotFoundError | ForbiddenError, CommentRepository> =>
  Effect.gen(function* () {
    const repo = yield* CommentRepository;
    return yield* repo.deleteComment(id, userId);
  });

export const getCommentsByTimestamp = (
  videoId: string,
  startTime: string,
  endTime: string,
): Effect.Effect<CommentWithAuthor[], DatabaseError, CommentRepository> =>
  Effect.gen(function* () {
    const repo = yield* CommentRepository;
    return yield* repo.getCommentsByTimestamp(videoId, startTime, endTime);
  });
