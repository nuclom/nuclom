/**
 * Organization Vocabulary API
 *
 * Endpoints for managing custom vocabulary terms to improve transcription accuracy.
 */

import { auth } from '@nuclom/lib/auth';
import { Cause, Effect, Exit, Schema } from 'effect';
import { headers } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { createPublicLayer, mapErrorToApiResponse } from '@/lib/api-handler';
import { OrganizationRepository } from '@/lib/effect/services/organization-repository';
import { VocabularyRepository } from '@/lib/effect/services/vocabulary-repository';
import type { ApiResponse } from '@/lib/types';
import { safeParse } from '@/lib/validation';

// =============================================================================
// Schemas
// =============================================================================

const VocabularyCategorySchema = Schema.Literal('product', 'person', 'technical', 'acronym', 'company');

const CreateVocabularySchema = Schema.Struct({
  term: Schema.String,
  variations: Schema.optional(Schema.Array(Schema.String)),
  category: VocabularyCategorySchema,
  pronunciation: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
});

const BulkCreateVocabularySchema = Schema.Struct({
  items: Schema.Array(CreateVocabularySchema),
});

const UpdateVocabularySchema = Schema.Struct({
  term: Schema.optional(Schema.String),
  variations: Schema.optional(Schema.Array(Schema.String)),
  category: Schema.optional(VocabularyCategorySchema),
  pronunciation: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
});

// =============================================================================
// GET /api/organizations/[id]/vocabulary
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const orgRepo = yield* OrganizationRepository;
    const vocabRepo = yield* VocabularyRepository;

    // Check if user is a member
    const isMemberResult = yield* orgRepo.isMember(session.user.id, resolvedParams.id);
    if (!isMemberResult) {
      return yield* Effect.fail({ _tag: 'ForbiddenError' as const, message: 'Access denied' });
    }

    // Get vocabulary with creators
    const vocabulary = yield* vocabRepo.getOrganizationVocabularyWithCreators(resolvedParams.id);
    return vocabulary;
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === 'Some') {
        return mapErrorToApiResponse(error.value);
      }
      return mapErrorToApiResponse(new Error('Internal server error'));
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
// POST /api/organizations/[id]/vocabulary
// =============================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const rawBody = await request.json();

  // Check if it's a bulk create request
  const isBulkCreate = rawBody.items && Array.isArray(rawBody.items);

  if (isBulkCreate) {
    const result = safeParse(BulkCreateVocabularySchema, rawBody);
    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Invalid request format' }, { status: 400 });
    }

    const effect = Effect.gen(function* () {
      const resolvedParams = yield* Effect.promise(() => params);
      const orgRepo = yield* OrganizationRepository;
      const vocabRepo = yield* VocabularyRepository;

      // Check if user has permissions (member or higher)
      const isMemberResult = yield* orgRepo.isMember(session.user.id, resolvedParams.id);
      if (!isMemberResult) {
        return yield* Effect.fail({ _tag: 'ForbiddenError' as const, message: 'Access denied' });
      }

      // Create vocabulary entries in bulk
      const vocabulary = yield* vocabRepo.bulkCreateVocabulary(
        result.data.items.map((item) => ({
          organizationId: resolvedParams.id,
          term: item.term,
          variations: item.variations,
          category: item.category,
          pronunciation: item.pronunciation,
          description: item.description,
          createdBy: session.user.id,
        })),
      );

      return vocabulary;
    });

    const runnable = Effect.provide(effect, createPublicLayer());
    const exit = await Effect.runPromiseExit(runnable);

    return Exit.match(exit, {
      onFailure: (cause) => {
        const error = Cause.failureOption(cause);
        if (error._tag === 'Some') {
          return mapErrorToApiResponse(error.value);
        }
        return mapErrorToApiResponse(new Error('Internal server error'));
      },
      onSuccess: (data) => {
        const response: ApiResponse = {
          success: true,
          data,
        };
        return NextResponse.json(response, { status: 201 });
      },
    });
  }

  // Single vocabulary creation
  const result = safeParse(CreateVocabularySchema, rawBody);
  if (!result.success) {
    return NextResponse.json({ success: false, error: 'Invalid request format' }, { status: 400 });
  }

  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const orgRepo = yield* OrganizationRepository;
    const vocabRepo = yield* VocabularyRepository;

    // Check if user has permissions
    const isMemberResult = yield* orgRepo.isMember(session.user.id, resolvedParams.id);
    if (!isMemberResult) {
      return yield* Effect.fail({ _tag: 'ForbiddenError' as const, message: 'Access denied' });
    }

    // Create vocabulary entry
    const vocabulary = yield* vocabRepo.createVocabulary({
      organizationId: resolvedParams.id,
      term: result.data.term,
      variations: result.data.variations,
      category: result.data.category,
      pronunciation: result.data.pronunciation,
      description: result.data.description,
      createdBy: session.user.id,
    });

    return vocabulary;
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === 'Some') {
        return mapErrorToApiResponse(error.value);
      }
      return mapErrorToApiResponse(new Error('Internal server error'));
    },
    onSuccess: (data) => {
      const response: ApiResponse = {
        success: true,
        data,
      };
      return NextResponse.json(response, { status: 201 });
    },
  });
}

// =============================================================================
// DELETE /api/organizations/[id]/vocabulary?vocabularyId=xxx
// =============================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const vocabularyId = searchParams.get('vocabularyId');

  if (!vocabularyId) {
    return NextResponse.json({ success: false, error: 'vocabularyId is required' }, { status: 400 });
  }

  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const orgRepo = yield* OrganizationRepository;
    const vocabRepo = yield* VocabularyRepository;

    // Check if user has permissions
    const isMemberResult = yield* orgRepo.isMember(session.user.id, resolvedParams.id);
    if (!isMemberResult) {
      return yield* Effect.fail({ _tag: 'ForbiddenError' as const, message: 'Access denied' });
    }

    // Delete vocabulary entry
    yield* vocabRepo.deleteVocabulary(vocabularyId);

    return { deleted: true };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === 'Some') {
        return mapErrorToApiResponse(error.value);
      }
      return mapErrorToApiResponse(new Error('Internal server error'));
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
// PATCH /api/organizations/[id]/vocabulary?vocabularyId=xxx
// =============================================================================

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const vocabularyId = searchParams.get('vocabularyId');

  if (!vocabularyId) {
    return NextResponse.json({ success: false, error: 'vocabularyId is required' }, { status: 400 });
  }

  const rawBody = await request.json();
  const result = safeParse(UpdateVocabularySchema, rawBody);
  if (!result.success) {
    return NextResponse.json({ success: false, error: 'Invalid request format' }, { status: 400 });
  }

  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const orgRepo = yield* OrganizationRepository;
    const vocabRepo = yield* VocabularyRepository;

    // Check if user has permissions
    const isMemberResult = yield* orgRepo.isMember(session.user.id, resolvedParams.id);
    if (!isMemberResult) {
      return yield* Effect.fail({ _tag: 'ForbiddenError' as const, message: 'Access denied' });
    }

    // Update vocabulary entry
    const vocabulary = yield* vocabRepo.updateVocabulary(vocabularyId, result.data);

    return vocabulary;
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === 'Some') {
        return mapErrorToApiResponse(error.value);
      }
      return mapErrorToApiResponse(new Error('Internal server error'));
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
