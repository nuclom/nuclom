/**
 * Content Source by ID API Routes
 *
 * GET /api/content/sources/[id] - Get content source details
 * PATCH /api/content/sources/[id] - Update content source
 * DELETE /api/content/sources/[id] - Delete content source
 */

import {
  Auth,
  createFullLayer,
  handleEffectExit,
  handleEffectExitWithStatus,
  resolveParams,
} from '@nuclom/lib/api-handler';
import {
  ContentRepository,
  deleteContentSource,
  getContentSource,
  updateContentSource,
} from '@nuclom/lib/effect/services/content';
import { OrganizationRepository } from '@nuclom/lib/effect/services/organization-repository';
import { validateRequestBody } from '@nuclom/lib/validation';
import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// Schemas
// =============================================================================

const UpdateSourceSchema = Schema.Struct({
  name: Schema.optional(Schema.String),
  config: Schema.optional(
    Schema.Struct({
      webhookUrl: Schema.optional(Schema.String),
      syncInterval: Schema.optional(Schema.Number),
      filters: Schema.optional(
        Schema.Struct({
          channels: Schema.optional(Schema.mutable(Schema.Array(Schema.String))),
          users: Schema.optional(Schema.mutable(Schema.Array(Schema.String))),
          dateRange: Schema.optional(
            Schema.mutable(
              Schema.Struct({
                from: Schema.optional(Schema.String),
                to: Schema.optional(Schema.String),
              }),
            ),
          ),
        }),
      ),
      settings: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
    }),
  ),
  credentials: Schema.optional(
    Schema.Struct({
      accessToken: Schema.optional(Schema.String),
      refreshToken: Schema.optional(Schema.String),
      expiresAt: Schema.optional(Schema.String),
      apiKey: Schema.optional(Schema.String),
      scope: Schema.optional(Schema.String),
    }),
  ),
});

// =============================================================================
// GET - Get Content Source
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Resolve params
    const { id } = yield* resolveParams(params);

    // Get content source
    const source = yield* getContentSource(id);

    // Verify user has access to the organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, source.organizationId);

    // Get stats for this source
    const contentRepo = yield* ContentRepository;
    const sources = yield* contentRepo.getSourcesWithStats({
      organizationId: source.organizationId,
    });
    const sourceWithStats = sources.find((s) => s.id === id);

    return sourceWithStats ?? source;
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}

// =============================================================================
// PATCH - Update Content Source
// =============================================================================

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Resolve params
    const { id } = yield* resolveParams(params);

    // Validate request body
    const data = yield* validateRequestBody(UpdateSourceSchema, request);

    // Get content source to verify access
    const source = yield* getContentSource(id);

    // Verify user has access to the organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, source.organizationId);

    // Update the content source
    const updated = yield* updateContentSource(id, {
      name: data.name,
      config: data.config,
      credentials: data.credentials,
    });

    return updated;
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}

// =============================================================================
// DELETE - Delete Content Source
// =============================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Resolve params
    const { id } = yield* resolveParams(params);

    // Get content source to verify access
    const source = yield* getContentSource(id);

    // Verify user has access to the organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, source.organizationId);

    // Delete the content source
    yield* deleteContentSource(id);

    return { success: true };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExitWithStatus(exit, 200);
}
