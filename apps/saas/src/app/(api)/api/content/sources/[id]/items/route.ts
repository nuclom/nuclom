/**
 * Content Source Items API Routes
 *
 * GET /api/content/sources/[id]/items - List content items for a source
 */

import { Auth, createFullLayer, handleEffectExit, resolveParams } from '@nuclom/lib/api-handler';
import { OrganizationRepository } from '@nuclom/lib/effect';
import { ContentRepository, getContentSource } from '@nuclom/lib/effect/services/content';
import { validateQueryParams } from '@nuclom/lib/validation';
import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// Schemas
// =============================================================================

const GetItemsQuerySchema = Schema.Struct({
  type: Schema.optional(Schema.String),
  processingStatus: Schema.optional(Schema.String),
  authorId: Schema.optional(Schema.String),
  searchQuery: Schema.optional(Schema.String),
  createdAfter: Schema.optional(Schema.String),
  createdBefore: Schema.optional(Schema.String),
  limit: Schema.optional(Schema.NumberFromString),
  offset: Schema.optional(Schema.NumberFromString),
  sortField: Schema.optional(Schema.String),
  sortDirection: Schema.optional(Schema.String),
});

// =============================================================================
// GET - List Content Items
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Resolve params
    const { id } = yield* resolveParams(params);

    // Validate query params
    const query = yield* validateQueryParams(GetItemsQuerySchema, request.url);

    // Get content source to verify access
    const source = yield* getContentSource(id);

    // Verify user has access to the organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, source.organizationId);

    // Get content items
    const contentRepo = yield* ContentRepository;
    const items = yield* contentRepo.getItems(
      {
        organizationId: source.organizationId,
        sourceId: id,
        type: query.type as
          | 'video'
          | 'message'
          | 'thread'
          | 'document'
          | 'issue'
          | 'pull_request'
          | 'comment'
          | 'file'
          | undefined,
        processingStatus: query.processingStatus as 'pending' | 'processing' | 'completed' | 'failed' | undefined,
        authorId: query.authorId,
        searchQuery: query.searchQuery,
        createdAfter: query.createdAfter ? new Date(query.createdAfter) : undefined,
        createdBefore: query.createdBefore ? new Date(query.createdBefore) : undefined,
      },
      {
        limit: query.limit ?? 50,
        offset: query.offset ?? 0,
      },
      query.sortField && query.sortDirection
        ? {
            field: query.sortField as 'createdAt' | 'createdAtSource' | 'updatedAt' | 'title',
            direction: query.sortDirection as 'asc' | 'desc',
          }
        : undefined,
    );

    return items;
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
