/**
 * Knowledge Chat API Route
 *
 * POST /api/ai/chat - Multi-turn chat with conversation history
 */

import { Auth, createFullLayer, handleEffectExit } from '@nuclom/lib/api-handler';
import { KnowledgeQA } from '@nuclom/lib/effect/services/knowledge';
import { OrganizationRepository } from '@nuclom/lib/effect/services/organization-repository';
import { validateRequestBody } from '@nuclom/lib/validation';
import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// Schemas
// =============================================================================

const ChatMessageSchema = Schema.Struct({
  role: Schema.Literal('user', 'assistant'),
  content: Schema.String.pipe(Schema.minLength(1)),
});

const ChatRequestSchema = Schema.Struct({
  organizationId: Schema.String,
  messages: Schema.Array(ChatMessageSchema).pipe(Schema.minItems(1)),
  context: Schema.optional(
    Schema.Struct({
      topicIds: Schema.optional(Schema.Array(Schema.String)),
      decisionIds: Schema.optional(Schema.Array(Schema.String)),
    }),
  ),
});

// =============================================================================
// POST - Chat with Knowledge Base
// =============================================================================

export async function POST(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Validate request body
    const body = yield* validateRequestBody(ChatRequestSchema, request);

    // Verify user has access to the organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, body.organizationId);

    // Chat with KnowledgeQA service
    const qaService = yield* KnowledgeQA;
    const result = yield* qaService.chat(body.organizationId, body.messages, body.context);

    return result;
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
