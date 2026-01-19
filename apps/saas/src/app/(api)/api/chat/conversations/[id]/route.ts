import { createFullLayer, handleEffectExit, resolveParams } from '@nuclom/lib/api-handler';
import { NotFoundError } from '@nuclom/lib/effect/errors';
import { Auth } from '@nuclom/lib/effect/services/auth';
import { ChatRepository } from '@nuclom/lib/effect/services/chat-repository';
import { validateRequestBody } from '@nuclom/lib/validation';
import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// Body Schemas
// =============================================================================

const updateConversationSchema = Schema.Struct({
  title: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(200)),
});

// =============================================================================
// GET /api/chat/conversations/[id] - Get a conversation
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Get conversation ID from params
    const { id } = yield* resolveParams(params);

    // Fetch conversation
    const repo = yield* ChatRepository;
    const conversation = yield* repo.getConversation(id);

    if (!conversation) {
      return yield* Effect.fail(
        new NotFoundError({
          message: 'Conversation not found',
          entity: 'ChatConversation',
          id,
        }),
      );
    }

    // Verify user owns this conversation
    if (conversation.userId !== user.id) {
      return yield* Effect.fail(
        new NotFoundError({
          message: 'Conversation not found',
          entity: 'ChatConversation',
          id,
        }),
      );
    }

    // Also fetch messages
    const messages = yield* repo.getMessages(id);

    return {
      ...conversation,
      messages,
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}

// =============================================================================
// PATCH /api/chat/conversations/[id] - Update a conversation title
// =============================================================================

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Get conversation ID from params
    const { id } = yield* resolveParams(params);

    // Validate request body
    const data = yield* validateRequestBody(updateConversationSchema, request);

    // Get current conversation to verify ownership
    const repo = yield* ChatRepository;
    const conversation = yield* repo.getConversation(id);

    if (!conversation || conversation.userId !== user.id) {
      return yield* Effect.fail(
        new NotFoundError({
          message: 'Conversation not found',
          entity: 'ChatConversation',
          id,
        }),
      );
    }

    // Update the conversation
    const updated = yield* repo.updateConversationTitle(id, data.title);

    return updated;
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}

// =============================================================================
// DELETE /api/chat/conversations/[id] - Delete a conversation
// =============================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Get conversation ID from params
    const { id } = yield* resolveParams(params);

    // Get current conversation to verify ownership
    const repo = yield* ChatRepository;
    const conversation = yield* repo.getConversation(id);

    if (!conversation || conversation.userId !== user.id) {
      return yield* Effect.fail(
        new NotFoundError({
          message: 'Conversation not found',
          entity: 'ChatConversation',
          id,
        }),
      );
    }

    // Delete the conversation (cascades to messages and context)
    yield* repo.deleteConversation(id);

    return { success: true };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
