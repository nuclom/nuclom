import { createFullLayer, handleEffectExit, handleEffectExitWithStatus } from '@nuclom/lib/api-handler';
import { Auth } from '@nuclom/lib/effect/services/auth';
import { ChatRepository } from '@nuclom/lib/effect/services/chat-repository';
import { validateQueryParams, validateRequestBody } from '@nuclom/lib/validation';
import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// Query/Body Schemas
// =============================================================================

const listConversationsQuerySchema = Schema.Struct({
  organizationId: Schema.String,
  limit: Schema.optionalWith(
    Schema.NumberFromString.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1), Schema.lessThanOrEqualTo(100)),
    { default: () => 50 },
  ),
  offset: Schema.optionalWith(Schema.NumberFromString.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)), {
    default: () => 0,
  }),
});

const createConversationSchema = Schema.Struct({
  organizationId: Schema.String,
  title: Schema.optional(Schema.String.pipe(Schema.maxLength(200))),
  videoIds: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  systemPrompt: Schema.optional(Schema.String.pipe(Schema.maxLength(4000))),
});

// =============================================================================
// GET /api/chat/conversations - List conversations for a user
// =============================================================================

export async function GET(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Validate query params
    const params = yield* validateQueryParams(listConversationsQuerySchema, request.url);

    // Fetch conversations
    const repo = yield* ChatRepository;
    const conversations = yield* repo.listConversations({
      organizationId: params.organizationId,
      userId: user.id,
      limit: params.limit,
      offset: params.offset,
    });

    return {
      conversations,
      limit: params.limit,
      offset: params.offset,
      hasMore: conversations.length === params.limit,
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}

// =============================================================================
// POST /api/chat/conversations - Create a new conversation
// =============================================================================

export async function POST(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Validate request body
    const data = yield* validateRequestBody(createConversationSchema, request);

    // Create conversation
    const repo = yield* ChatRepository;
    const conversation = yield* repo.createConversation({
      organizationId: data.organizationId,
      userId: user.id,
      title: data.title,
      videoIds: data.videoIds ? [...data.videoIds] : [],
      metadata: data.systemPrompt
        ? {
            systemPrompt: data.systemPrompt,
          }
        : undefined,
    });

    return conversation;
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExitWithStatus(exit, 201);
}
