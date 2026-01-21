/**
 * Knowledge Q&A API Route
 *
 * POST /api/ai/qa - Ask a question and get an answer with sources
 */

import { Auth, createFullLayer, handleEffectExit } from '@nuclom/lib/api-handler';
import { OrganizationRepository } from '@nuclom/lib/effect';
import { KnowledgeQA } from '@nuclom/lib/effect/services/knowledge';
import { validateRequestBody } from '@nuclom/lib/validation';
import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// Schemas
// =============================================================================

const AskQuestionSchema = Schema.Struct({
  organizationId: Schema.String,
  question: Schema.String.pipe(Schema.minLength(1)),
  options: Schema.optional(
    Schema.Struct({
      limit: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
      sources: Schema.optional(Schema.Array(Schema.String)),
    }),
  ),
});

// =============================================================================
// POST - Ask a Question
// =============================================================================

export async function POST(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Validate request body
    const body = yield* validateRequestBody(AskQuestionSchema, request);

    // Verify user has access to the organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, body.organizationId);

    // Get answer from KnowledgeQA service
    const qaService = yield* KnowledgeQA;
    const result = yield* qaService.answerQuestion(body.organizationId, body.question, body.options);

    return result;
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
