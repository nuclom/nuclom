/**
 * User Link API Route
 *
 * POST /api/content/sources/[id]/users/[externalId]/link - Link external user to org member
 * DELETE /api/content/sources/[id]/users/[externalId]/link - Unlink external user
 */

import {
  Auth,
  createFullLayer,
  handleEffectExit,
  handleEffectExitWithStatus,
  resolveParams,
} from '@nuclom/lib/api-handler';
import { db } from '@nuclom/lib/db';
import { githubUsers } from '@nuclom/lib/db/schema/github';
import { notionUsers } from '@nuclom/lib/db/schema/notion';
import { slackUsers } from '@nuclom/lib/db/schema/slack';
import { OrganizationRepository } from '@nuclom/lib/effect';
import { getContentSource } from '@nuclom/lib/effect/services/content';
import { validateRequestBody } from '@nuclom/lib/validation';
import { and, eq } from 'drizzle-orm';
import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// Schemas
// =============================================================================

const LinkUserSchema = Schema.Struct({
  userId: Schema.String,
});

// =============================================================================
// POST - Link User
// =============================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; externalId: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Resolve params
    const { id: sourceId, externalId } = yield* resolveParams(params);
    const decodedExternalId = decodeURIComponent(externalId);

    // Validate body
    const data = yield* validateRequestBody(LinkUserSchema, request);

    // Get content source
    const source = yield* getContentSource(sourceId);

    // Verify org membership
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, source.organizationId);

    // Link user based on source type
    if (source.type === 'slack') {
      yield* Effect.tryPromise({
        try: () =>
          db
            .update(slackUsers)
            .set({ userId: data.userId })
            .where(and(eq(slackUsers.sourceId, sourceId), eq(slackUsers.slackUserId, decodedExternalId))),
        catch: (e) => new Error(`Failed to link Slack user: ${e}`),
      });
    } else if (source.type === 'notion') {
      yield* Effect.tryPromise({
        try: () =>
          db
            .update(notionUsers)
            .set({ userId: data.userId })
            .where(and(eq(notionUsers.sourceId, sourceId), eq(notionUsers.notionUserId, decodedExternalId))),
        catch: (e) => new Error(`Failed to link Notion user: ${e}`),
      });
    } else if (source.type === 'github') {
      yield* Effect.tryPromise({
        try: () =>
          db
            .update(githubUsers)
            .set({ userId: data.userId })
            .where(and(eq(githubUsers.sourceId, sourceId), eq(githubUsers.githubLogin, decodedExternalId))),
        catch: (e) => new Error(`Failed to link GitHub user: ${e}`),
      });
    } else {
      return yield* Effect.fail(new Error(`Unsupported source type: ${source.type}`));
    }

    return { success: true, externalId: decodedExternalId, linkedUserId: data.userId };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExitWithStatus(exit, 200);
}

// =============================================================================
// DELETE - Unlink User
// =============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; externalId: string }> },
) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Resolve params
    const { id: sourceId, externalId } = yield* resolveParams(params);
    const decodedExternalId = decodeURIComponent(externalId);

    // Get content source
    const source = yield* getContentSource(sourceId);

    // Verify org membership
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, source.organizationId);

    // Unlink user based on source type
    if (source.type === 'slack') {
      yield* Effect.tryPromise({
        try: () =>
          db
            .update(slackUsers)
            .set({ userId: null })
            .where(and(eq(slackUsers.sourceId, sourceId), eq(slackUsers.slackUserId, decodedExternalId))),
        catch: (e) => new Error(`Failed to unlink Slack user: ${e}`),
      });
    } else if (source.type === 'notion') {
      yield* Effect.tryPromise({
        try: () =>
          db
            .update(notionUsers)
            .set({ userId: null })
            .where(and(eq(notionUsers.sourceId, sourceId), eq(notionUsers.notionUserId, decodedExternalId))),
        catch: (e) => new Error(`Failed to unlink Notion user: ${e}`),
      });
    } else if (source.type === 'github') {
      yield* Effect.tryPromise({
        try: () =>
          db
            .update(githubUsers)
            .set({ userId: null })
            .where(and(eq(githubUsers.sourceId, sourceId), eq(githubUsers.githubLogin, decodedExternalId))),
        catch: (e) => new Error(`Failed to unlink GitHub user: ${e}`),
      });
    } else {
      return yield* Effect.fail(new Error(`Unsupported source type: ${source.type}`));
    }

    return { success: true, externalId: decodedExternalId, linkedUserId: null };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}
