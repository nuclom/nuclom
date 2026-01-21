/**
 * Action Item Repository Service
 *
 * Provides database operations for AI-extracted action items
 * from video transcripts.
 */

import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { Context, Data, Effect, Layer } from 'effect';
import { aiActionItems, videos } from '../../db/schema';
import { NotFoundError } from '../errors';
import { Database } from './database';

// =============================================================================
// Error Types
// =============================================================================

export class ActionItemRepositoryError extends Data.TaggedError('ActionItemRepositoryError')<{
  readonly message: string;
  readonly operation?: string;
  readonly cause?: unknown;
}> {}

// =============================================================================
// Types
// =============================================================================

export type ActionItemStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type ActionItemPriority = 'high' | 'medium' | 'low';

export interface ActionItemWithVideo {
  readonly actionItem: {
    readonly id: string;
    readonly organizationId: string;
    readonly videoId: string;
    readonly title: string;
    readonly description: string | null;
    readonly assignee: string | null;
    readonly assigneeUserId: string | null;
    readonly priority: string;
    readonly status: string;
    readonly dueDate: Date | null;
    readonly timestampStart: number | null;
    readonly timestampEnd: number | null;
    readonly confidence: number | null;
    readonly extractedFrom: string | null;
    readonly createdAt: Date;
    readonly updatedAt: Date;
  };
  readonly video: {
    readonly id: string;
    readonly title: string;
    readonly thumbnailUrl: string | null;
  } | null;
}

export interface ActionItemStats {
  readonly pending: number;
  readonly inProgress: number;
  readonly completed: number;
  readonly cancelled: number;
  readonly total: number;
}

export interface CreateActionItemInput {
  readonly organizationId: string;
  readonly videoId: string;
  readonly title: string;
  readonly description?: string;
  readonly assignee?: string;
  readonly assigneeUserId?: string;
  readonly priority?: ActionItemPriority;
  readonly dueDate?: Date;
  readonly timestampStart?: number;
  readonly timestampEnd?: number;
  readonly confidence?: number;
  readonly extractedFrom?: string;
}

export interface UpdateActionItemInput {
  readonly title?: string;
  readonly description?: string;
  readonly assignee?: string;
  readonly assigneeUserId?: string;
  readonly priority?: ActionItemPriority;
  readonly status?: ActionItemStatus;
  readonly dueDate?: Date | null;
}

export interface GetActionItemsParams {
  readonly organizationId: string;
  readonly startDate: Date;
  readonly status?: ActionItemStatus;
  readonly priority?: ActionItemPriority;
  readonly assigneeUserId?: string;
  readonly videoId?: string;
  readonly page?: number;
  readonly limit?: number;
}

// =============================================================================
// Service Interface
// =============================================================================

export interface ActionItemRepositoryService {
  /**
   * Get action items with pagination and filtering
   */
  readonly getActionItems: (
    params: GetActionItemsParams,
  ) => Effect.Effect<{ items: ActionItemWithVideo[]; totalCount: number }, ActionItemRepositoryError>;

  /**
   * Get action items stats by status
   */
  readonly getActionItemStats: (
    organizationId: string,
    startDate: Date,
  ) => Effect.Effect<ActionItemStats, ActionItemRepositoryError>;

  /**
   * Get a single action item by ID
   */
  readonly getActionItem: (id: string) => Effect.Effect<ActionItemWithVideo, ActionItemRepositoryError | NotFoundError>;

  /**
   * Create a new action item
   */
  readonly createActionItem: (
    input: CreateActionItemInput,
  ) => Effect.Effect<typeof aiActionItems.$inferSelect, ActionItemRepositoryError>;

  /**
   * Update an action item
   */
  readonly updateActionItem: (
    id: string,
    input: UpdateActionItemInput,
  ) => Effect.Effect<typeof aiActionItems.$inferSelect, ActionItemRepositoryError | NotFoundError>;

  /**
   * Delete an action item
   */
  readonly deleteActionItem: (id: string) => Effect.Effect<void, ActionItemRepositoryError | NotFoundError>;
}

// =============================================================================
// Service Tag
// =============================================================================

export class ActionItemRepository extends Context.Tag('ActionItemRepository')<
  ActionItemRepository,
  ActionItemRepositoryService
>() {}

// =============================================================================
// Service Implementation
// =============================================================================

const makeActionItemRepositoryService = Effect.gen(function* () {
  const database = yield* Database;
  const db = database.db;

  const getActionItems = (
    params: GetActionItemsParams,
  ): Effect.Effect<{ items: ActionItemWithVideo[]; totalCount: number }, ActionItemRepositoryError> =>
    Effect.tryPromise({
      try: async () => {
        const { organizationId, startDate, status, priority, assigneeUserId, videoId, page = 1, limit = 20 } = params;
        const offset = (page - 1) * limit;

        // Build where conditions
        const conditions = [eq(aiActionItems.organizationId, organizationId), gte(aiActionItems.createdAt, startDate)];

        if (status) {
          conditions.push(eq(aiActionItems.status, status));
        }
        if (priority) {
          conditions.push(eq(aiActionItems.priority, priority));
        }
        if (assigneeUserId) {
          conditions.push(eq(aiActionItems.assigneeUserId, assigneeUserId));
        }
        if (videoId) {
          conditions.push(eq(aiActionItems.videoId, videoId));
        }

        // Get action items with video info
        const items = await db
          .select({
            actionItem: aiActionItems,
            video: {
              id: videos.id,
              title: videos.title,
              thumbnailUrl: videos.thumbnailUrl,
            },
          })
          .from(aiActionItems)
          .leftJoin(videos, eq(aiActionItems.videoId, videos.id))
          .where(and(...conditions))
          .orderBy(
            // Sort by priority (high first) then by creation date
            sql`CASE
              WHEN ${aiActionItems.priority} = 'high' THEN 1
              WHEN ${aiActionItems.priority} = 'medium' THEN 2
              ELSE 3
            END`,
            desc(aiActionItems.createdAt),
          )
          .limit(limit)
          .offset(offset);

        // Get total count
        const countResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(aiActionItems)
          .where(and(...conditions));
        const totalCount = Number(countResult[0]?.count) || 0;

        return { items, totalCount };
      },
      catch: (error) =>
        new ActionItemRepositoryError({
          message: 'Failed to fetch action items',
          operation: 'getActionItems',
          cause: error,
        }),
    });

  const getActionItemStats = (
    organizationId: string,
    startDate: Date,
  ): Effect.Effect<ActionItemStats, ActionItemRepositoryError> =>
    Effect.tryPromise({
      try: async () => {
        const statsResult = await db
          .select({
            status: aiActionItems.status,
            count: sql<number>`count(*)`,
          })
          .from(aiActionItems)
          .where(and(eq(aiActionItems.organizationId, organizationId), gte(aiActionItems.createdAt, startDate)))
          .groupBy(aiActionItems.status);

        const statsByStatus = Object.fromEntries(statsResult.map((s) => [s.status, Number(s.count)]));

        return {
          pending: statsByStatus.pending || 0,
          inProgress: statsByStatus.in_progress || 0,
          completed: statsByStatus.completed || 0,
          cancelled: statsByStatus.cancelled || 0,
          total: Object.values(statsByStatus).reduce((a, b) => a + b, 0),
        };
      },
      catch: (error) =>
        new ActionItemRepositoryError({
          message: 'Failed to fetch action item stats',
          operation: 'getActionItemStats',
          cause: error,
        }),
    });

  const getActionItem = (id: string): Effect.Effect<ActionItemWithVideo, ActionItemRepositoryError | NotFoundError> =>
    Effect.tryPromise({
      try: async () => {
        const result = await db
          .select({
            actionItem: aiActionItems,
            video: {
              id: videos.id,
              title: videos.title,
              thumbnailUrl: videos.thumbnailUrl,
            },
          })
          .from(aiActionItems)
          .leftJoin(videos, eq(aiActionItems.videoId, videos.id))
          .where(eq(aiActionItems.id, id));

        if (result.length === 0) {
          throw new NotFoundError({
            message: `Action item not found: ${id}`,
            entity: 'ActionItem',
          });
        }

        return result[0];
      },
      catch: (error) => {
        if (error instanceof NotFoundError) {
          throw error;
        }
        return new ActionItemRepositoryError({
          message: 'Failed to fetch action item',
          operation: 'getActionItem',
          cause: error,
        });
      },
    }).pipe(
      Effect.catchAll((e) => {
        if (e instanceof NotFoundError) {
          return Effect.fail(e);
        }
        return Effect.fail(e as ActionItemRepositoryError);
      }),
    );

  const createActionItem = (
    input: CreateActionItemInput,
  ): Effect.Effect<typeof aiActionItems.$inferSelect, ActionItemRepositoryError> =>
    Effect.tryPromise({
      try: async () => {
        const [actionItem] = await db
          .insert(aiActionItems)
          .values({
            organizationId: input.organizationId,
            videoId: input.videoId,
            title: input.title,
            description: input.description ?? null,
            assignee: input.assignee ?? null,
            assigneeUserId: input.assigneeUserId ?? null,
            priority: input.priority ?? 'medium',
            dueDate: input.dueDate ?? null,
            timestampStart: input.timestampStart ?? null,
            timestampEnd: input.timestampEnd ?? null,
            confidence: input.confidence ?? null,
            extractedFrom: input.extractedFrom ?? null,
          })
          .returning();
        return actionItem;
      },
      catch: (error) =>
        new ActionItemRepositoryError({
          message: 'Failed to create action item',
          operation: 'createActionItem',
          cause: error,
        }),
    });

  const updateActionItem = (
    id: string,
    input: UpdateActionItemInput,
  ): Effect.Effect<typeof aiActionItems.$inferSelect, ActionItemRepositoryError | NotFoundError> =>
    Effect.tryPromise({
      try: async () => {
        const updateData: Record<string, unknown> = {};
        if (input.title !== undefined) updateData.title = input.title;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.assignee !== undefined) updateData.assignee = input.assignee;
        if (input.assigneeUserId !== undefined) updateData.assigneeUserId = input.assigneeUserId;
        if (input.priority !== undefined) updateData.priority = input.priority;
        if (input.status !== undefined) updateData.status = input.status;
        if (input.dueDate !== undefined) updateData.dueDate = input.dueDate;
        updateData.updatedAt = new Date();

        const [actionItem] = await db.update(aiActionItems).set(updateData).where(eq(aiActionItems.id, id)).returning();

        if (!actionItem) {
          throw new NotFoundError({
            message: `Action item not found: ${id}`,
            entity: 'ActionItem',
          });
        }

        return actionItem;
      },
      catch: (error) => {
        if (error instanceof NotFoundError) {
          throw error;
        }
        return new ActionItemRepositoryError({
          message: 'Failed to update action item',
          operation: 'updateActionItem',
          cause: error,
        });
      },
    }).pipe(
      Effect.catchAll((e) => {
        if (e instanceof NotFoundError) {
          return Effect.fail(e);
        }
        return Effect.fail(e as ActionItemRepositoryError);
      }),
    );

  const deleteActionItem = (id: string): Effect.Effect<void, ActionItemRepositoryError | NotFoundError> =>
    Effect.tryPromise({
      try: async () => {
        const result = await db
          .delete(aiActionItems)
          .where(eq(aiActionItems.id, id))
          .returning({ id: aiActionItems.id });

        if (result.length === 0) {
          throw new NotFoundError({
            message: `Action item not found: ${id}`,
            entity: 'ActionItem',
          });
        }
      },
      catch: (error) => {
        if (error instanceof NotFoundError) {
          throw error;
        }
        return new ActionItemRepositoryError({
          message: 'Failed to delete action item',
          operation: 'deleteActionItem',
          cause: error,
        });
      },
    }).pipe(
      Effect.catchAll((e) => {
        if (e instanceof NotFoundError) {
          return Effect.fail(e);
        }
        return Effect.fail(e as ActionItemRepositoryError);
      }),
    );

  return {
    getActionItems,
    getActionItemStats,
    getActionItem,
    createActionItem,
    updateActionItem,
    deleteActionItem,
  } satisfies ActionItemRepositoryService;
});

// =============================================================================
// Service Layer
// =============================================================================

export const ActionItemRepositoryLive = Layer.effect(ActionItemRepository, makeActionItemRepositoryService);

// =============================================================================
// Helper Functions (for convenience)
// =============================================================================

export const getActionItems = (params: GetActionItemsParams) =>
  Effect.flatMap(ActionItemRepository, (repo) => repo.getActionItems(params));

export const getActionItemStats = (organizationId: string, startDate: Date) =>
  Effect.flatMap(ActionItemRepository, (repo) => repo.getActionItemStats(organizationId, startDate));

export const getActionItem = (id: string) => Effect.flatMap(ActionItemRepository, (repo) => repo.getActionItem(id));

export const createActionItem = (input: CreateActionItemInput) =>
  Effect.flatMap(ActionItemRepository, (repo) => repo.createActionItem(input));

export const updateActionItem = (id: string, input: UpdateActionItemInput) =>
  Effect.flatMap(ActionItemRepository, (repo) => repo.updateActionItem(id, input));

export const deleteActionItem = (id: string) =>
  Effect.flatMap(ActionItemRepository, (repo) => repo.deleteActionItem(id));
