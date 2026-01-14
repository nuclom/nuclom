/**
 * AI Chat Knowledge Base Service
 *
 * Provides an AI agent with access to the organization's knowledge base.
 * Uses a tool-based agent loop pattern with bash-tool for advanced queries.
 */

import { gateway } from '@ai-sdk/gateway';
import { generateText, jsonSchema, stepCountIs, streamText, tool } from 'ai';
import { createBashTool } from 'bash-tool';
import { Context, Effect, JSONSchema, Layer, ParseResult, Schema } from 'effect';
import { AIServiceError } from '../errors';
import { Embedding, type EmbeddingServiceInterface } from './embedding';
import { KnowledgeGraphRepository, type KnowledgeGraphRepositoryInterface } from './knowledge-graph-repository';
import { SemanticSearchRepository, type SemanticSearchRepositoryService } from './semantic-search-repository';

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
  onToolCall?: (toolName: string, args: unknown) => void;
  onFinish?: (response: ChatResponse) => void;
}

export interface AIChatKBServiceInterface {
  /**
   * Generate a response using the knowledge base with tool-based agent
   */
  readonly generateResponse: (
    messages: readonly ChatMessage[],
    context: ChatContext,
  ) => Effect.Effect<ChatResponse, AIServiceError>;

  /**
   * Stream a response using the knowledge base with tool-based agent
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

You have access to the following tools:
1. searchKnowledgeBase - Search through video transcripts and content using semantic search
2. getDecisionDetails - Get detailed information about a specific decision
3. listRecentDecisions - List recent decisions from the organization
4. bash - Execute shell commands for data processing and analysis

Use these tools to find relevant information before answering questions.

Guidelines:
- Always search the knowledge base when answering questions about video content
- Cite your sources by mentioning which videos or decisions you found information from
- If you cannot find relevant information, say so honestly
- Be concise but thorough in your responses
- When referencing timestamps, format them as MM:SS or HH:MM:SS
- You can use bash for text processing, calculations, or data analysis`;

// =============================================================================
// Tool Schemas
// =============================================================================

const searchKnowledgeBaseInput = Schema.Struct({
  query: Schema.String,
  limit: Schema.optional(Schema.Number),
});

const getDecisionDetailsInput = Schema.Struct({
  decisionId: Schema.String,
});

const listRecentDecisionsInput = Schema.Struct({
  videoId: Schema.optional(Schema.String),
  limit: Schema.optional(Schema.Number),
});

const searchKnowledgeBaseSchema = jsonSchema(JSONSchema.make(searchKnowledgeBaseInput));
const getDecisionDetailsSchema = jsonSchema(JSONSchema.make(getDecisionDetailsInput));
const listRecentDecisionsSchema = jsonSchema(JSONSchema.make(listRecentDecisionsInput));

const decodeToolInput = <A, I>(schema: Schema.Schema<A, I>, input: unknown): A => {
  const decoded = Schema.decodeUnknownEither(schema)(input);
  if (decoded._tag === 'Right') {
    return decoded.right;
  }
  const issues = ParseResult.ArrayFormatter.formatErrorSync(decoded.left);
  const message = issues
    .map((issue) => (issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message))
    .join('; ');
  throw new Error(message);
};

// =============================================================================
// Tool Definitions
// =============================================================================

interface ToolDependencies {
  embeddingService: EmbeddingServiceInterface;
  searchRepo: SemanticSearchRepositoryService;
  kgRepo: KnowledgeGraphRepositoryInterface;
  context: ChatContext;
  sources: SourceReference[];
  onSource?: (source: SourceReference) => void;
}

const createKnowledgeBaseTools = (deps: ToolDependencies) => {
  const { embeddingService, searchRepo, kgRepo, context, sources, onSource } = deps;

  return {
    searchKnowledgeBase: tool({
      description:
        'Search through video transcripts and knowledge base content using semantic search. Returns relevant excerpts with timestamps and relevance scores.',
      inputSchema: searchKnowledgeBaseSchema,
      execute: async (input: unknown) => {
        const { query, limit } = decodeToolInput(searchKnowledgeBaseInput, input);
        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const queryEmbedding = yield* embeddingService.generateEmbedding(query);
            const searchResults = yield* searchRepo
              .semanticSearch({
                queryEmbedding: [...queryEmbedding],
                organizationId: context.organizationId,
                videoIds: context.videoIds ? [...context.videoIds] : undefined,
                limit: limit ?? 10,
                threshold: 0.5,
              })
              .pipe(Effect.catchAll(() => Effect.succeed([] as const)));

            return [...searchResults];
          }).pipe(Effect.catchAll(() => Effect.succeed([]))),
        );

        // Add to sources
        for (const r of result) {
          const source: SourceReference = {
            type: r.contentType,
            id: r.contentId,
            relevance: Math.round(r.similarity * 100),
            preview: r.textPreview,
            videoId: r.videoId,
            timestamp: r.timestampStart,
          };
          if (!sources.some((s) => s.id === source.id)) {
            sources.push(source);
            onSource?.(source);
          }
        }

        return result.map((r) => ({
          type: r.contentType,
          id: r.contentId,
          relevance: Math.round(r.similarity * 100),
          preview: r.textPreview,
          videoId: r.videoId,
          timestamp: r.timestampStart,
        }));
      },
    }),

    getDecisionDetails: tool({
      description: 'Get detailed information about a specific decision by its ID.',
      inputSchema: getDecisionDetailsSchema,
      execute: async (input: unknown) => {
        const { decisionId } = decodeToolInput(getDecisionDetailsInput, input);
        const decision = await Effect.runPromise(
          kgRepo.getDecision(decisionId).pipe(Effect.catchAll(() => Effect.succeed(null))),
        );

        if (decision) {
          const source: SourceReference = {
            type: 'decision',
            id: decision.id,
            relevance: decision.confidence ?? 80,
            preview: decision.summary,
            videoId: decision.videoId,
            timestamp: decision.timestampStart ?? undefined,
          };
          if (!sources.some((s) => s.id === source.id)) {
            sources.push(source);
            onSource?.(source);
          }
        }

        return decision ?? { error: 'Decision not found' };
      },
    }),

    listRecentDecisions: tool({
      description: 'List recent decisions from the organization, optionally filtered by video.',
      inputSchema: listRecentDecisionsSchema,
      execute: async (input: unknown) => {
        const { videoId, limit } = decodeToolInput(listRecentDecisionsInput, input);
        const decisions = await Effect.runPromise(
          kgRepo
            .listDecisions({
              organizationId: context.organizationId,
              videoId,
              limit: limit ?? 10,
            })
            .pipe(Effect.catchAll(() => Effect.succeed([] as const))),
        );

        // Add to sources
        for (const d of decisions) {
          const source: SourceReference = {
            type: 'decision',
            id: d.id,
            relevance: d.confidence ?? 80,
            preview: d.summary,
            videoId: d.videoId,
            timestamp: d.timestampStart ?? undefined,
          };
          if (!sources.some((s) => s.id === source.id)) {
            sources.push(source);
            onSource?.(source);
          }
        }

        return [...decisions].map((d) => ({
          id: d.id,
          summary: d.summary,
          status: d.status,
          context: d.context,
          videoId: d.videoId,
          timestamp: d.timestampStart,
        }));
      },
    }),
  };
};

// =============================================================================
// AI Chat KB Service Implementation
// =============================================================================

const makeAIChatKBService = Effect.gen(function* () {
  const embeddingService = yield* Embedding;
  const searchRepo = yield* SemanticSearchRepository;
  const kgRepo = yield* KnowledgeGraphRepository;

  const model = gateway('xai/grok-3');

  const generateResponse = (
    messages: readonly ChatMessage[],
    context: ChatContext,
  ): Effect.Effect<ChatResponse, AIServiceError> =>
    Effect.gen(function* () {
      const sources: SourceReference[] = [];

      // Create knowledge base tools
      const kbTools = createKnowledgeBaseTools({
        embeddingService,
        searchRepo,
        kgRepo,
        context,
        sources,
      });

      // Create bash tool for advanced processing
      const bashToolkit = yield* Effect.tryPromise({
        try: (_signal) => createBashTool({ destination: '/tmp/chat-workspace' }),
        catch: (error: unknown) =>
          new AIServiceError({
            message: 'Failed to create bash toolkit',
            operation: 'createBashTool',
            cause: error,
          }),
      });

      const allTools = {
        ...kbTools,
        bash: bashToolkit.tools.bash,
      };

      const systemPrompt = context.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;

      const allMessages = [
        { role: 'system' as const, content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ];

      const result = yield* Effect.tryPromise({
        try: async () => {
          return await generateText({
            model,
            messages: allMessages,
            tools: allTools,
            stopWhen: stepCountIs(10),
          });
        },
        catch: (error: unknown) =>
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
      const sources: SourceReference[] = [];

      // Create knowledge base tools
      const kbTools = createKnowledgeBaseTools({
        embeddingService,
        searchRepo,
        kgRepo,
        context,
        sources,
        onSource: callbacks?.onSource,
      });

      // Create bash tool for advanced processing
      const bashToolkit = yield* Effect.tryPromise({
        try: (_signal) => createBashTool({ destination: '/tmp/chat-workspace' }),
        catch: (error: unknown) =>
          new AIServiceError({
            message: 'Failed to create bash toolkit',
            operation: 'createBashTool',
            cause: error,
          }),
      });

      const allTools = {
        ...kbTools,
        bash: bashToolkit.tools.bash,
      };

      const systemPrompt = context.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;

      const allMessages = [
        { role: 'system' as const, content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ];

      const result = yield* Effect.tryPromise({
        try: async () => {
          return streamText({
            model,
            messages: allMessages,
            tools: allTools,
            stopWhen: stepCountIs(10),
            onStepFinish: ({ toolCalls }) => {
              if (toolCalls) {
                for (const tc of toolCalls) {
                  callbacks?.onToolCall?.(tc.toolName, tc);
                }
              }
            },
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
        catch: (error: unknown) =>
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
