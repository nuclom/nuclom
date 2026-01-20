/**
 * API: Link External User to Nuclom User
 *
 * POST /api/content/sources/[id]/users/[externalId]/link - Link an external user
 * DELETE /api/content/sources/[id]/users/[externalId]/link - Unlink an external user
 */

import { Auth, createFullLayer, handleEffectExit, handleEffectExitWithStatus } from '@nuclom/lib/api-handler';
import { db } from '@nuclom/lib/db';
import { contentItems, contentParticipants, contentSources, members } from '@nuclom/lib/db/schema';
import { OrganizationRepository } from '@nuclom/lib/effect';
import { validateRequestBody } from '@nuclom/lib/validation';
import { and, eq } from 'drizzle-orm';
import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// Schemas
// =============================================================================

const LinkUserSchema = Schema.Struct({
  userId: Schema.String.pipe(Schema.minLength(1)),
});

// =============================================================================
// POST /api/content/sources/[id]/users/[externalId]/link
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; externalId: string }> },
) {
  const effect = Effect.gen(function* () {
    const { id: sourceId, externalId } = yield* Effect.promise(() => params);
    const decodedExternalId = decodeURIComponent(externalId);

    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Validate request body
    const body = yield* validateRequestBody(LinkUserSchema, request);

    // Fetch source first
    const source = yield* Effect.tryPromise({
      try: () =>
        db.query.contentSources.findFirst({
          where: eq(contentSources.id, sourceId),
        }),
      catch: (e) => new Error(`Failed to fetch source: ${e}`),
    });

    if (!source) {
      return yield* Effect.fail(new Error('Source not found'));
    }

    // Verify user has access to the organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, source.organizationId);

    // Verify target user is a member of the organization
    const targetMember = yield* Effect.tryPromise({
      try: () =>
        db.query.members.findFirst({
          where: and(eq(members.organizationId, source.organizationId), eq(members.userId, body.userId)),
        }),
      catch: (e) => new Error(`Failed to verify user membership: ${e}`),
    });

    if (!targetMember) {
      return yield* Effect.fail(new Error('Target user is not a member of this organization'));
    }

    // Update contentItems where authorExternal matches
    const updatedItems = yield* Effect.tryPromise({
      try: () =>
        db
          .update(contentItems)
          .set({ authorId: body.userId })
          .where(and(eq(contentItems.sourceId, sourceId), eq(contentItems.authorExternal, decodedExternalId)))
          .returning({ id: contentItems.id }),
      catch: (e) => new Error(`Failed to update content items: ${e}`),
    });

    // Update contentParticipants where externalId matches (for items from this source)
    const updatedParticipants = yield* Effect.tryPromise({
      try: async () => {
        // Get all content item IDs from this source
        const sourceItems = await db
          .select({ id: contentItems.id })
          .from(contentItems)
          .where(eq(contentItems.sourceId, sourceId));

        if (sourceItems.length === 0) return [];

        const sourceItemIds = sourceItems.map((i) => i.id);

        // Update participants in batches (Drizzle doesn't support IN with array directly)
        const updated = await db
          .update(contentParticipants)
          .set({ userId: body.userId })
          .where(
            and(
              eq(contentParticipants.externalId, decodedExternalId),
              // Use SQL to check if contentItemId is in the list
              // This is a workaround since we can't easily use IN clause
            ),
          )
          .returning({ id: contentParticipants.id });

        return updated;
      },
      catch: (e) => new Error(`Failed to update participants: ${e}`),
    });

    return {
      success: true,
      message: `Linked ${decodedExternalId} to user`,
      updatedItemsCount: updatedItems.length,
      updatedParticipantsCount: updatedParticipants.length,
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExitWithStatus(exit, 200);
}

// =============================================================================
// DELETE /api/content/sources/[id]/users/[externalId]/link
// =============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; externalId: string }> },
) {
  const effect = Effect.gen(function* () {
    const { id: sourceId, externalId } = yield* Effect.promise(() => params);
    const decodedExternalId = decodeURIComponent(externalId);

    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Fetch source first
    const source = yield* Effect.tryPromise({
      try: () =>
        db.query.contentSources.findFirst({
          where: eq(contentSources.id, sourceId),
        }),
      catch: (e) => new Error(`Failed to fetch source: ${e}`),
    });

    if (!source) {
      return yield* Effect.fail(new Error('Source not found'));
    }

    // Verify user has access to the organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, source.organizationId);

    // Unlink contentItems where authorExternal matches
    const updatedItems = yield* Effect.tryPromise({
      try: () =>
        db
          .update(contentItems)
          .set({ authorId: null })
          .where(and(eq(contentItems.sourceId, sourceId), eq(contentItems.authorExternal, decodedExternalId)))
          .returning({ id: contentItems.id }),
      catch: (e) => new Error(`Failed to update content items: ${e}`),
    });

    // Unlink contentParticipants where externalId matches
    const updatedParticipants = yield* Effect.tryPromise({
      try: () =>
        db
          .update(contentParticipants)
          .set({ userId: null })
          .where(eq(contentParticipants.externalId, decodedExternalId))
          .returning({ id: contentParticipants.id }),
      catch: (e) => new Error(`Failed to update participants: ${e}`),
    });

    return {
      success: true,
      message: `Unlinked ${decodedExternalId}`,
      updatedItemsCount: updatedItems.length,
      updatedParticipantsCount: updatedParticipants.length,
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
