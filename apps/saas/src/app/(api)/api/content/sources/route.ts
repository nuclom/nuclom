/**
 * Content Sources API Routes
 *
 * GET /api/content/sources - List content sources for the organization
 * POST /api/content/sources - Create a new content source
 */

import { Schema } from 'effect';
import { Effect } from 'effect';
import type { NextRequest } from 'next/server';
import { Auth, createFullLayer, handleEffectExit, handleEffectExitWithStatus } from '@nuclom/lib/api-handler';
import { ContentRepository, createContentSource } from '@nuclom/lib/effect/services/content';
import { OrganizationRepository } from '@nuclom/lib/effect';
import { validateQueryParams, validateRequestBody } from '@nuclom/lib/validation';

// =============================================================================
// Schemas
// =============================================================================

const GetSourcesQuerySchema = Schema.Struct({
  organizationId: Schema.String,
  type: Schema.optional(Schema.String),
  syncStatus: Schema.optional(Schema.String),
});

const CreateSourceSchema = Schema.Struct({
  organizationId: Schema.String,
  type: Schema.Literal('slack', 'notion', 'github', 'video', 'confluence', 'google_drive', 'linear'),
  name: Schema.String,
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
// GET - List Content Sources
// =============================================================================

export async function GET(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Validate query params
    const params = yield* validateQueryParams(GetSourcesQuerySchema, request.url);

    // Verify user has access to the organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, params.organizationId);

    // Get content sources with stats
    const contentRepo = yield* ContentRepository;
    const sources = yield* contentRepo.getSourcesWithStats({
      organizationId: params.organizationId,
      type: params.type as 'slack' | 'notion' | 'github' | undefined,
      syncStatus: params.syncStatus as 'idle' | 'syncing' | 'error' | undefined,
    });

    return sources;
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}

// =============================================================================
// POST - Create Content Source
// =============================================================================

export async function POST(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Validate request body
    const data = yield* validateRequestBody(CreateSourceSchema, request);

    // Verify user has access to the organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, data.organizationId);

    // Create the content source
    const source = yield* createContentSource({
      organizationId: data.organizationId,
      type: data.type,
      name: data.name,
      config: data.config,
      credentials: data.credentials,
    });

    return source;
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExitWithStatus(exit, 201);
}
