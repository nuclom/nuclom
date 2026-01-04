import { eq } from "drizzle-orm";
import { Cause, Effect, Exit, Schema } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { Auth, createFullLayer, mapErrorToApiResponse } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { aiActionItems } from "@/lib/db/schema";
import { DatabaseError, NotFoundError, UnauthorizedError } from "@/lib/effect";
import type { ApiResponse } from "@/lib/types";
import { validateRequestBody } from "@/lib/validation";

// =============================================================================
// Schemas
// =============================================================================

const updateActionItemSchema = Schema.Struct({
  title: Schema.optional(Schema.String.pipe(Schema.maxLength(500))),
  description: Schema.optional(Schema.String.pipe(Schema.maxLength(2000))),
  assignee: Schema.optional(Schema.NullOr(Schema.String)),
  assigneeUserId: Schema.optional(Schema.NullOr(Schema.String)),
  status: Schema.optional(Schema.Literal("pending", "in_progress", "completed", "cancelled")),
  priority: Schema.optional(Schema.Literal("high", "medium", "low")),
  dueDate: Schema.optional(Schema.NullOr(Schema.String)), // ISO date string
});

// =============================================================================
// GET /api/insights/action-items/[id] - Get a single action item
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const FullLayer = createFullLayer();

  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const actionItemId = resolvedParams.id;

    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Get action item with video info
    const actionItem = yield* Effect.tryPromise({
      try: () =>
        db.query.aiActionItems.findFirst({
          where: eq(aiActionItems.id, actionItemId),
          with: {
            video: {
              columns: {
                id: true,
                title: true,
                thumbnailUrl: true,
              },
            },
          },
        }),
      catch: () =>
        new DatabaseError({
          message: "Failed to fetch action item",
          operation: "getActionItem",
        }),
    });

    if (!actionItem) {
      return yield* Effect.fail(
        new NotFoundError({
          message: "Action item not found",
          entity: "ActionItem",
          id: actionItemId,
        }),
      );
    }

    // Verify user belongs to organization
    const isMember = yield* Effect.tryPromise({
      try: () =>
        db.query.members.findFirst({
          where: (members, { and, eq }) =>
            and(eq(members.userId, user.id), eq(members.organizationId, actionItem.organizationId)),
        }),
      catch: () =>
        new DatabaseError({
          message: "Failed to verify membership",
          operation: "checkMembership",
        }),
    });

    if (!isMember) {
      return yield* Effect.fail(
        new UnauthorizedError({
          message: "You are not a member of this organization",
        }),
      );
    }

    return actionItem;
  });

  const runnable = Effect.provide(effect, FullLayer);
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
// PATCH /api/insights/action-items/[id] - Update an action item
// =============================================================================

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const FullLayer = createFullLayer();

  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const actionItemId = resolvedParams.id;

    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Get existing action item
    const existingItem = yield* Effect.tryPromise({
      try: () =>
        db.query.aiActionItems.findFirst({
          where: eq(aiActionItems.id, actionItemId),
        }),
      catch: () =>
        new DatabaseError({
          message: "Failed to fetch action item",
          operation: "getActionItem",
        }),
    });

    if (!existingItem) {
      return yield* Effect.fail(
        new NotFoundError({
          message: "Action item not found",
          entity: "ActionItem",
          id: actionItemId,
        }),
      );
    }

    // Verify user belongs to organization
    const isMember = yield* Effect.tryPromise({
      try: () =>
        db.query.members.findFirst({
          where: (members, { and, eq }) =>
            and(eq(members.userId, user.id), eq(members.organizationId, existingItem.organizationId)),
        }),
      catch: () =>
        new DatabaseError({
          message: "Failed to verify membership",
          operation: "checkMembership",
        }),
    });

    if (!isMember) {
      return yield* Effect.fail(
        new UnauthorizedError({
          message: "You are not a member of this organization",
        }),
      );
    }

    // Validate request body
    const data = yield* validateRequestBody(updateActionItemSchema, request);

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.title !== undefined) {
      updateData.title = data.title;
    }
    if (data.description !== undefined) {
      updateData.description = data.description;
    }
    if (data.assignee !== undefined) {
      updateData.assignee = data.assignee;
    }
    if (data.assigneeUserId !== undefined) {
      updateData.assigneeUserId = data.assigneeUserId;
    }
    if (data.priority !== undefined) {
      updateData.priority = data.priority;
    }
    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    }
    if (data.status !== undefined) {
      updateData.status = data.status;

      // If marking as completed, set completion metadata
      if (data.status === "completed") {
        updateData.completedAt = new Date();
        updateData.completedById = user.id;
      } else if (existingItem.status === "completed") {
        // If unmarking from completed, clear completion metadata
        updateData.completedAt = null;
        updateData.completedById = null;
      }
    }

    // Update action item
    const updatedItem = yield* Effect.tryPromise({
      try: () => db.update(aiActionItems).set(updateData).where(eq(aiActionItems.id, actionItemId)).returning(),
      catch: () =>
        new DatabaseError({
          message: "Failed to update action item",
          operation: "updateActionItem",
        }),
    });

    return updatedItem[0];
  });

  const runnable = Effect.provide(effect, FullLayer);
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
// DELETE /api/insights/action-items/[id] - Delete an action item
// =============================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const FullLayer = createFullLayer();

  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const actionItemId = resolvedParams.id;

    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Get existing action item
    const existingItem = yield* Effect.tryPromise({
      try: () =>
        db.query.aiActionItems.findFirst({
          where: eq(aiActionItems.id, actionItemId),
        }),
      catch: () =>
        new DatabaseError({
          message: "Failed to fetch action item",
          operation: "getActionItem",
        }),
    });

    if (!existingItem) {
      return yield* Effect.fail(
        new NotFoundError({
          message: "Action item not found",
          entity: "ActionItem",
          id: actionItemId,
        }),
      );
    }

    // Verify user belongs to organization
    const isMember = yield* Effect.tryPromise({
      try: () =>
        db.query.members.findFirst({
          where: (members, { and, eq }) =>
            and(eq(members.userId, user.id), eq(members.organizationId, existingItem.organizationId)),
        }),
      catch: () =>
        new DatabaseError({
          message: "Failed to verify membership",
          operation: "checkMembership",
        }),
    });

    if (!isMember) {
      return yield* Effect.fail(
        new UnauthorizedError({
          message: "You are not a member of this organization",
        }),
      );
    }

    // Delete action item
    yield* Effect.tryPromise({
      try: () => db.delete(aiActionItems).where(eq(aiActionItems.id, actionItemId)),
      catch: () =>
        new DatabaseError({
          message: "Failed to delete action item",
          operation: "deleteActionItem",
        }),
    });

    return { deleted: true };
  });

  const runnable = Effect.provide(effect, FullLayer);
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
