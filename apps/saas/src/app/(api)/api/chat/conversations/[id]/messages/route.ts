import { createFullLayer, handleEffectExit, resolveParams } from '@nuclom/lib/api-handler';
import { NotFoundError } from '@nuclom/lib/effect/errors';
import { AIChatKB, type SourceReference } from '@nuclom/lib/effect/services/ai-chat-kb';
import { Auth } from '@nuclom/lib/effect/services/auth';
import { ChatRepository } from '@nuclom/lib/effect/services/chat-repository';
import { Embedding } from '@nuclom/lib/effect/services/embedding';
import { validateQueryParams, validateRequestBody } from '@nuclom/lib/validation';
import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';

// Type for the sources stored in the database
type StoredSource = {
  type: 'decision' | 'transcript_chunk' | 'video';
  id: string;
  relevance: number;
  preview?: string;
};

// =============================================================================
// Query/Body Schemas
// =============================================================================

const listMessagesQuerySchema = Schema.Struct({
  limit: Schema.optionalWith(
    Schema.NumberFromString.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1), Schema.lessThanOrEqualTo(200)),
    { default: () => 100 },
  ),
});

const sendMessageSchema = Schema.Struct({
  content: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(10000)),
  stream: Schema.optionalWith(Schema.Boolean, { default: () => true }),
});

// =============================================================================
// GET /api/chat/conversations/[id]/messages - List messages in a conversation
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Get conversation ID from params
    const { id } = yield* resolveParams(params);

    // Validate query params
    const queryParams = yield* validateQueryParams(listMessagesQuerySchema, request.url);

    // Verify conversation exists and user owns it
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

    // Fetch messages
    const messages = yield* repo.getMessages(id, queryParams.limit);

    return {
      messages,
      conversationId: id,
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}

// =============================================================================
// POST /api/chat/conversations/[id]/messages - Send a message and get AI response
// =============================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // For streaming responses, we need to handle the effect differently
  const layer = createFullLayer();

  // First, validate and set up the request
  const setupEffect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Get conversation ID from params
    const { id } = yield* resolveParams(params);

    // Validate request body
    const data = yield* validateRequestBody(sendMessageSchema, request);

    // Verify conversation exists and user owns it
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

    // Get existing messages for context
    const existingMessages = yield* repo.getMessages(id);

    // Save the user message
    const userMessage = yield* repo.createMessage({
      conversationId: id,
      role: 'user',
      content: data.content,
    });

    // Generate embedding for the user message (async, don't block)
    const embeddingService = yield* Embedding;
    Effect.runPromise(
      Effect.gen(function* () {
        const embedding = yield* embeddingService.generateEmbedding(data.content);
        yield* repo.updateMessageEmbedding(userMessage.id, embedding);
      }).pipe(Effect.catchAll(() => Effect.void)),
    );

    return {
      conversation,
      existingMessages,
      userMessage,
      shouldStream: data.stream,
      content: data.content,
    };
  });

  const runnable = Effect.provide(setupEffect, layer);
  const setupResult = await Effect.runPromiseExit(runnable);

  if (setupResult._tag === 'Failure') {
    return handleEffectExit(setupResult);
  }

  const { conversation, existingMessages, userMessage, shouldStream, content } = setupResult.value;

  // Prepare messages for the AI
  const chatMessages = [
    ...existingMessages.map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    })),
    { role: 'user' as const, content },
  ];

  const chatContext = {
    organizationId: conversation.organizationId,
    videoIds: conversation.videoIds ?? undefined,
    systemPrompt: conversation.metadata?.systemPrompt,
  };

  if (shouldStream) {
    // Streaming response
    const encoder = new TextEncoder();
    const collectedSources: SourceReference[] = [];

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const streamEffect = Effect.gen(function* () {
            const chatKB = yield* AIChatKB;
            const repo = yield* ChatRepository;

            const responseStream = yield* chatKB.streamResponse(chatMessages, chatContext, {
              onChunk: (chunk) => {
                // Send as Server-Sent Event format
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`));
              },
              onSource: (source) => {
                collectedSources.push(source);
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'source', source })}\n\n`));
              },
              onFinish: (response) => {
                // Save the assistant message (handled in a separate async context)
                (async () => {
                  const sourcesArray: StoredSource[] = response.sources.map((s) => ({
                    type: s.type,
                    id: s.id,
                    relevance: s.relevance,
                    preview: s.preview,
                  }));

                  const assistantMessage = await Effect.runPromise(
                    Effect.provide(
                      repo.createMessage({
                        conversationId: conversation.id,
                        role: 'assistant',
                        content: response.response,
                        sources: sourcesArray,
                        usage: response.usage,
                      }),
                      layer,
                    ),
                  );

                  // Save context references
                  if (response.sources.length > 0) {
                    await Effect.runPromise(
                      Effect.provide(
                        repo.addContexts(
                          response.sources.map((s) => ({
                            messageId: assistantMessage.id,
                            sourceType: s.type,
                            sourceId: s.id,
                            relevanceScore: Math.round(s.relevance),
                            contextSnippet: s.preview,
                          })),
                        ),
                        layer,
                      ),
                    );
                  }

                  // Generate title for new conversations
                  if (!conversation.title && existingMessages.length === 0) {
                    // Use first ~50 chars of user message as title
                    const autoTitle = content.slice(0, 50) + (content.length > 50 ? '...' : '');
                    await Effect.runPromise(
                      Effect.provide(repo.updateConversationTitle(conversation.id, autoTitle), layer),
                    );
                  }

                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: 'done',
                        messageId: assistantMessage.id,
                        usage: response.usage,
                      })}\n\n`,
                    ),
                  );
                })();
              },
            });

            // Consume the stream
            yield* Effect.promise(async () => {
              const reader = responseStream.getReader();
              while (true) {
                const { done } = await reader.read();
                if (done) break;
              }
            });
          });

          await Effect.runPromise(Effect.provide(streamEffect, layer));
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'error',
                error: error instanceof Error ? error.message : 'An error occurred',
              })}\n\n`,
            ),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } else {
    // Non-streaming response
    const responseEffect = Effect.gen(function* () {
      const chatKB = yield* AIChatKB;
      const repo = yield* ChatRepository;

      const response = yield* chatKB.generateResponse(chatMessages, chatContext);

      // Convert sources to mutable array for storage
      const sourcesArray: StoredSource[] = response.sources.map((s) => ({
        type: s.type,
        id: s.id,
        relevance: s.relevance,
        preview: s.preview,
      }));

      // Save the assistant message
      const assistantMessage = yield* repo.createMessage({
        conversationId: conversation.id,
        role: 'assistant',
        content: response.response,
        sources: sourcesArray,
        usage: response.usage,
      });

      // Save context references
      if (response.sources.length > 0) {
        yield* repo.addContexts(
          response.sources.map((s) => ({
            messageId: assistantMessage.id,
            sourceType: s.type,
            sourceId: s.id,
            relevanceScore: Math.round(s.relevance),
            contextSnippet: s.preview,
          })),
        );
      }

      // Generate title for new conversations
      if (!conversation.title && existingMessages.length === 0) {
        const autoTitle = content.slice(0, 50) + (content.length > 50 ? '...' : '');
        yield* repo.updateConversationTitle(conversation.id, autoTitle);
      }

      return {
        userMessage,
        assistantMessage,
        sources: response.sources,
        usage: response.usage,
      };
    });

    const exit = await Effect.runPromiseExit(Effect.provide(responseEffect, layer));
    return handleEffectExit(exit);
  }
}
