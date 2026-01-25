import { Auth, generatePresignedThumbnailUrl, handleEffectExit, runApiEffect, Storage } from '@nuclom/lib/api-handler';
import { ActionItemRepository } from '@nuclom/lib/effect/services/action-item-repository';
import { OrganizationRepository } from '@nuclom/lib/effect/services/organization-repository';
import { validateRequestBody } from '@nuclom/lib/validation';
import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// Schemas
// =============================================================================

const updateActionItemSchema = Schema.Struct({
  title: Schema.optional(Schema.String.pipe(Schema.maxLength(500))),
  description: Schema.optional(Schema.String.pipe(Schema.maxLength(2000))),
  assignee: Schema.optional(Schema.NullOr(Schema.String)),
  assigneeUserId: Schema.optional(Schema.NullOr(Schema.String)),
  status: Schema.optional(Schema.Literal('pending', 'in_progress', 'completed', 'cancelled')),
  priority: Schema.optional(Schema.Literal('high', 'medium', 'low')),
  dueDate: Schema.optional(Schema.NullOr(Schema.String)), // ISO date string
});

// =============================================================================
// GET /api/insights/action-items/[id] - Get a single action item
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const actionItemId = resolvedParams.id;

    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Get action item with video info
    const actionItemRepo = yield* ActionItemRepository;
    const { actionItem, video } = yield* actionItemRepo.getActionItem(actionItemId);

    // Verify user belongs to organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, actionItem.organizationId);

    // Generate presigned URL for video thumbnail
    const storage = yield* Storage;
    const presignedThumbnailUrl = video?.thumbnailUrl
      ? yield* generatePresignedThumbnailUrl(storage, video.thumbnailUrl)
      : null;

    return {
      ...actionItem,
      video: video
        ? {
            ...video,
            thumbnailUrl: presignedThumbnailUrl,
          }
        : null,
    };
  });

  const exit = await runApiEffect(effect);
  return handleEffectExit(exit);
}

// =============================================================================
// PATCH /api/insights/action-items/[id] - Update an action item
// =============================================================================

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const actionItemId = resolvedParams.id;

    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Get existing action item to verify ownership
    const actionItemRepo = yield* ActionItemRepository;
    const { actionItem: existingItem } = yield* actionItemRepo.getActionItem(actionItemId);

    // Verify user belongs to organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, existingItem.organizationId);

    // Validate request body
    const data = yield* validateRequestBody(updateActionItemSchema, request);

    // Update action item
    const updatedItem = yield* actionItemRepo.updateActionItem(actionItemId, {
      title: data.title,
      description: data.description ?? undefined,
      assignee: data.assignee ?? undefined,
      assigneeUserId: data.assigneeUserId ?? undefined,
      priority: data.priority,
      status: data.status,
      dueDate: data.dueDate ? new Date(data.dueDate) : data.dueDate === null ? null : undefined,
    });

    return updatedItem;
  });

  const exit = await runApiEffect(effect);
  return handleEffectExit(exit);
}

// =============================================================================
// DELETE /api/insights/action-items/[id] - Delete an action item
// =============================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const actionItemId = resolvedParams.id;

    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Get existing action item to verify ownership
    const actionItemRepo = yield* ActionItemRepository;
    const { actionItem: existingItem } = yield* actionItemRepo.getActionItem(actionItemId);

    // Verify user belongs to organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, existingItem.organizationId);

    // Delete action item
    yield* actionItemRepo.deleteActionItem(actionItemId);

    return { deleted: true };
  });

  const exit = await runApiEffect(effect);
  return handleEffectExit(exit);
}
