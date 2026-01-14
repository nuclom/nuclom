/**
 * AI Chat Knowledge Base Service
 *
 * Provides an AI agent with access to the organization's knowledge base.
 * Uses RAG (Retrieval Augmented Generation) by fetching relevant context
 * from transcripts and decisions before generating responses.
 */

import { gateway } from '@ai-sdk/gateway';
import { generateText, streamText } from 'ai';
import { Context, Effect, Layer } from 'effect';
import { AIServiceError } from '../errors';
import { Embedding } from './embedding';
import { KnowledgeGraphRepository } from './knowledge-graph-repository';
import { SemanticSearchRepository } from './semantic-search-repository';

// =============================================================================
// Types
// =============================================================================

export interface ChatContext {
  readonly organizationId: string;
  readonly videoIds?: readonly string[];
  readonly systemPrompt?: string;
}

export interface ChatMessage {
  readonly role: 'user' | 'assistant' | 'system';
  readonly content: string;
}

export interface ChatResponse {
  readonly response: string;
  readonly sources: readonly SourceReference[];
  readonly usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface SourceReference {
  readonly type: 'decision' | 'transcript_chunk' | 'video';
  readonly id: string;
  readonly relevance: number;
  readonly preview?: string;
  readonly videoId?: string;
  readonly timestamp?: number;
}

export interface StreamCallbacks {
  onChunk?: (chunk: string) => void;
  onSource?: (source: SourceReference) => void;
  onFinish?: (response: ChatResponse) => void;
}

export interface AIChatKBServiceInterface {
  /**
   * Generate a response using the knowledge base with RAG
   */
  readonly generateResponse: (
    messages: readonly ChatMessage[],
    context: ChatContext,
  ) => Effect.Effect<ChatResponse, AIServiceError>;

  /**
   * Stream a response using the knowledge base
   */
  readonly streamResponse: (
    messages: readonly ChatMessage[],
    context: ChatContext,
    callbacks?: StreamCallbacks,
  ) => Effect.Effect<ReadableStream<string>, AIServiceError>;
}

// =============================================================================
// AI Chat KB Service Tag
// =============================================================================

export class AIChatKB extends Context.Tag('AIChatKB')<AIChatKB, AIChatKBServiceInterface>() {}

// =============================================================================
// Default System Prompt
// =============================================================================

const DEFAULT_SYSTEM_PROMPT = `You are an AI assistant with access to your organization's video knowledge base.

Your capabilities:
- Answer questions based on video transcripts and decisions
- Cite sources when referencing specific content
- Provide relevant context from past discussions

Guidelines:
- Use the provided context to answer questions accurately
- Cite your sources by mentioning which videos or decisions you found information from
- If the context doesn't contain relevant information, say so honestly
- Be concise but thorough in your responses
- When referencing timestamps, format them as MM:SS or HH:MM:SS`;

// =============================================================================
// AI Chat KB Service Implementation
// =============================================================================

const makeAIChatKBService = Effect.gen(function* () {
  const embeddingService = yield* Embedding;
  const searchRepo = yield* SemanticSearchRepository;
  const kgRepo = yield* KnowledgeGraphRepository;

  const model = gateway('xai/grok-3');

  /**
   * Retrieve relevant context for a query using semantic search
   */
  const retrieveContext = (
    query: string,
    context: ChatContext,
  ): Effect.Effect<{ sources: SourceReference[]; contextText: string }, AIServiceError> =>
    Effect.gen(function* () {
      // Generate embedding for the query
      const queryEmbedding = yield* embeddingService.generateEmbedding(query);

      // Perform semantic search
      const searchResults = yield* searchRepo
        .semanticSearch({
          queryEmbedding,
          organizationId: context.organizationId,
          videoIds: context.videoIds ? [...context.videoIds] : undefined,
          limit: 10,
          threshold: 0.6,
        })
        .pipe(Effect.catchAll(() => Effect.succeed([])));

      // Also fetch recent decisions
      const decisions = yield* kgRepo
        .listDecisions({
          organizationId: context.organizationId,
          videoId: context.videoIds?.[0],
          limit: 5,
        })
        .pipe(Effect.catchAll(() => Effect.succeed([])));

      // Build sources and context
      const sources: SourceReference[] = [];
      const contextParts: string[] = [];

      // Add search results to context
      for (const result of searchResults) {
        sources.push({
          type: result.contentType,
          id: result.contentId,
          relevance: Math.round(result.similarity * 100),
          preview: result.textPreview,
          videoId: result.videoId,
          timestamp: result.timestampStart,
        });

        if (result.textPreview) {
          const timestamp = result.timestampStart
            ? `[${Math.floor(result.timestampStart / 60)}:${String(Math.floor(result.timestampStart % 60)).padStart(2, '0')}]`
            : '';
          contextParts.push(`[${result.contentType}${timestamp}]: ${result.textPreview}`);
        }
      }

      // Add decisions to context
      for (const decision of decisions) {
        if (!sources.some((s) => s.id === decision.id)) {
          sources.push({
            type: 'decision',
            id: decision.id,
            relevance: decision.confidence ?? 80,
            preview: decision.summary,
            videoId: decision.videoId,
            timestamp: decision.timestampStart ?? undefined,
          });
        }

        contextParts.push(`[Decision - ${decision.status}]: ${decision.summary}`);
        if (decision.context) {
          contextParts.push(`  Context: ${decision.context}`);
        }
      }

      const contextText =
        contextParts.length > 0 ? `\n\n### Relevant Context from Knowledge Base:\n${contextParts.join('\n\n')}` : '';

      return { sources, contextText };
    }).pipe(
      Effect.catchAll((error) =>
        Effect.fail(
          new AIServiceError({
            message: 'Failed to retrieve context',
            operation: 'retrieveContext',
            cause: error,
          }),
        ),
      ),
    );

  const generateResponse = (
    messages: readonly ChatMessage[],
    context: ChatContext,
  ): Effect.Effect<ChatResponse, AIServiceError> =>
    Effect.gen(function* () {
      // Get the last user message for context retrieval
      const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
      const query = lastUserMessage?.content ?? '';

      // Retrieve relevant context
      const { sources, contextText } = yield* retrieveContext(query, context);

      const systemPrompt = (context.systemPrompt ?? DEFAULT_SYSTEM_PROMPT) + contextText;

      const allMessages = [
        { role: 'system' as const, content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ];

      const result = yield* Effect.tryPromise({
        try: async () => {
          return await generateText({
            model,
            messages: allMessages,
          });
        },
        catch: (error) =>
          new AIServiceError({
            message: 'Failed to generate chat response',
            operation: 'generateResponse',
            cause: error,
          }),
      });

      return {
        response: result.text,
        sources,
        usage: result.usage
          ? {
              promptTokens: (result.usage as { promptTokens?: number }).promptTokens ?? 0,
              completionTokens: (result.usage as { completionTokens?: number }).completionTokens ?? 0,
              totalTokens:
                ((result.usage as { promptTokens?: number }).promptTokens ?? 0) +
                ((result.usage as { completionTokens?: number }).completionTokens ?? 0),
            }
          : undefined,
      };
    });

  const streamResponse = (
    messages: readonly ChatMessage[],
    context: ChatContext,
    callbacks?: StreamCallbacks,
  ): Effect.Effect<ReadableStream<string>, AIServiceError> =>
    Effect.gen(function* () {
      // Get the last user message for context retrieval
      const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
      const query = lastUserMessage?.content ?? '';

      // Retrieve relevant context
      const { sources, contextText } = yield* retrieveContext(query, context);

      // Notify about sources
      for (const source of sources) {
        callbacks?.onSource?.(source);
      }

      const systemPrompt = (context.systemPrompt ?? DEFAULT_SYSTEM_PROMPT) + contextText;

      const allMessages = [
        { role: 'system' as const, content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ];

      const result = yield* Effect.tryPromise({
        try: async () => {
          return streamText({
            model,
            messages: allMessages,
            onFinish: ({ text, usage }) => {
              callbacks?.onFinish?.({
                response: text,
                sources,
                usage: usage
                  ? {
                      promptTokens: (usage as { promptTokens?: number }).promptTokens ?? 0,
                      completionTokens: (usage as { completionTokens?: number }).completionTokens ?? 0,
                      totalTokens:
                        ((usage as { promptTokens?: number }).promptTokens ?? 0) +
                        ((usage as { completionTokens?: number }).completionTokens ?? 0),
                    }
                  : undefined,
              });
            },
          });
        },
        catch: (error) =>
          new AIServiceError({
            message: 'Failed to stream chat response',
            operation: 'streamResponse',
            cause: error,
          }),
      });

      // Create a readable stream that forwards text chunks
      const stream = new ReadableStream<string>({
        async start(controller) {
          for await (const chunk of result.textStream) {
            controller.enqueue(chunk);
            callbacks?.onChunk?.(chunk);
          }
          controller.close();
        },
      });

      return stream;
    });

  return {
    generateResponse,
    streamResponse,
  } satisfies AIChatKBServiceInterface;
});

// =============================================================================
// AI Chat KB Layer
// =============================================================================

export const AIChatKBLive = Layer.effect(AIChatKB, makeAIChatKBService);

// =============================================================================
// Helper Functions
// =============================================================================

export const generateChatResponse = (
  messages: readonly ChatMessage[],
  context: ChatContext,
): Effect.Effect<ChatResponse, AIServiceError, AIChatKB> =>
  Effect.gen(function* () {
    const chatKB = yield* AIChatKB;
    return yield* chatKB.generateResponse(messages, context);
  });

export const streamChatResponse = (
  messages: readonly ChatMessage[],
  context: ChatContext,
  callbacks?: StreamCallbacks,
): Effect.Effect<ReadableStream<string>, AIServiceError, AIChatKB> =>
  Effect.gen(function* () {
    const chatKB = yield* AIChatKB;
    return yield* chatKB.streamResponse(messages, context, callbacks);
  });
