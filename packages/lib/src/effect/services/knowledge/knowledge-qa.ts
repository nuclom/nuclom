/**
 * Knowledge Q&A Service
 *
 * Provides RAG-based question answering over the organization's knowledge base.
 * Uses semantic search to find relevant content and generates answers with source citations.
 */

import { gateway } from '@ai-sdk/gateway';
import { generateText } from 'ai';
import { Context, Effect, Layer } from 'effect';
import { AIServiceError, DatabaseError } from '../../errors';
import { Database } from '../database';
import { Embedding } from '../embedding';
import { SemanticSearchRepository } from '../semantic-search-repository';

// =============================================================================
// Types
// =============================================================================

export interface QuestionSource {
  readonly contentId: string;
  readonly type: 'content_item' | 'decision' | 'transcript_chunk';
  readonly title: string;
  readonly similarity: number;
  readonly excerpt: string;
  readonly sourceType?: string; // e.g., 'slack', 'notion', 'github'
  readonly url?: string;
}

export interface QuestionAnswerResult {
  readonly answer: string;
  readonly confidence: number;
  readonly sources: readonly QuestionSource[];
  readonly followUpQuestions: readonly string[];
}

export interface ChatMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

export interface ChatResponse {
  readonly response: string;
  readonly sources: readonly QuestionSource[];
}

export interface KnowledgeQAServiceInterface {
  /**
   * Answer a question using the organization's knowledge base
   */
  readonly answerQuestion: (
    organizationId: string,
    question: string,
    options?: {
      readonly limit?: number;
      readonly sources?: readonly string[];
    },
  ) => Effect.Effect<QuestionAnswerResult, AIServiceError | DatabaseError>;

  /**
   * Multi-turn chat with context from previous messages
   */
  readonly chat: (
    organizationId: string,
    messages: readonly ChatMessage[],
    context?: {
      readonly topicIds?: readonly string[];
      readonly decisionIds?: readonly string[];
    },
  ) => Effect.Effect<ChatResponse, AIServiceError | DatabaseError>;
}

// =============================================================================
// Service Tag
// =============================================================================

export class KnowledgeQA extends Context.Tag('KnowledgeQA')<KnowledgeQA, KnowledgeQAServiceInterface>() {}

// =============================================================================
// System Prompts
// =============================================================================

const QA_SYSTEM_PROMPT = `You are a knowledge assistant for an organization. Your role is to answer questions based on the organization's documented knowledge, including:
- Slack conversations
- Notion documents
- GitHub pull requests, issues, and discussions
- Video transcripts
- Recorded decisions

Guidelines:
1. Base your answers ONLY on the provided context. If the context doesn't contain relevant information, say so.
2. Cite your sources by referencing the source titles.
3. Be concise but thorough.
4. If you see conflicting information, mention both perspectives.
5. At the end, suggest 2-3 follow-up questions the user might want to ask.

Format your response as:
ANSWER: [Your detailed answer here, citing sources]

FOLLOW_UP_QUESTIONS:
- [Question 1]
- [Question 2]
- [Question 3]`;

const CHAT_SYSTEM_PROMPT = `You are a conversational knowledge assistant for an organization. You have access to the organization's knowledge base including Slack messages, Notion documents, GitHub content, and video transcripts.

Guidelines:
1. Answer based on the provided context and conversation history.
2. Reference specific sources when citing information.
3. If you don't know something, say so honestly.
4. Keep responses conversational but informative.`;

// =============================================================================
// Implementation
// =============================================================================

export const KnowledgeQALive = Layer.effect(
  KnowledgeQA,
  Effect.gen(function* () {
    const { db } = yield* Database;
    const embeddingService = yield* Embedding;
    const searchRepo = yield* SemanticSearchRepository;

    /**
     * Search for relevant content in the knowledge base
     */
    const searchKnowledgeBase = (
      organizationId: string,
      queryEmbedding: readonly number[],
      limit: number = 10,
    ): Effect.Effect<readonly QuestionSource[], DatabaseError> =>
      Effect.gen(function* () {
        // Search transcript chunks and decisions
        const semanticResults = yield* searchRepo.semanticSearch({
          queryEmbedding,
          organizationId,
          limit,
          threshold: 0.5,
          contentTypes: ['transcript_chunk', 'decision'],
        });

        // Also search content items directly if available
        const contentResults = yield* Effect.tryPromise({
          try: async () => {
            const results = await db.query.contentItems.findMany({
              where: (items, { eq }) => eq(items.organizationId, organizationId),
              limit: limit,
              orderBy: (items, { desc }) => [desc(items.updatedAt)],
              with: {
                source: true,
              },
            });
            return results;
          },
          catch: (e) => new DatabaseError({ message: `Failed to search content items: ${e}` }),
        });

        // Combine and format results
        const sources: QuestionSource[] = [];

        // Add semantic search results
        for (const result of semanticResults) {
          sources.push({
            contentId: result.contentId,
            type: result.contentType,
            title:
              result.contentType === 'decision'
                ? `Decision - ${result.videoId || result.contentId}`
                : `Content - ${result.videoId || result.contentId}`,
            similarity: result.similarity,
            excerpt: result.textPreview,
          });
        }

        // Add content items
        for (const item of contentResults) {
          sources.push({
            contentId: item.id,
            type: 'content_item',
            title: item.title || 'Untitled content',
            similarity: 0.7, // Default score for non-vector search
            excerpt: item.content?.slice(0, 300) || '',
            sourceType: item.source?.type,
            url: (item.metadata as Record<string, unknown>)?.html_url as string | undefined,
          });
        }

        return sources;
      });

    /**
     * Build context string from sources
     */
    const buildContext = (sources: readonly QuestionSource[]): string => {
      return sources
        .map((source, index) => `[Source ${index + 1}: ${source.title}]\n${source.excerpt}\n---`)
        .join('\n\n');
    };

    /**
     * Parse the AI response to extract answer and follow-up questions
     */
    const parseQAResponse = (response: string): { answer: string; followUpQuestions: string[] } => {
      const answerMatch = response.match(/ANSWER:\s*([\s\S]*?)(?=FOLLOW_UP_QUESTIONS:|$)/i);
      const followUpMatch = response.match(/FOLLOW_UP_QUESTIONS:\s*([\s\S]*?)$/i);

      const answer = answerMatch ? answerMatch[1].trim() : response;
      const followUpQuestions: string[] = [];

      if (followUpMatch) {
        const lines = followUpMatch[1].split('\n');
        for (const line of lines) {
          const cleaned = line.replace(/^-\s*/, '').trim();
          if (cleaned) {
            followUpQuestions.push(cleaned);
          }
        }
      }

      return { answer, followUpQuestions };
    };

    /**
     * Calculate confidence based on source quality
     */
    const calculateConfidence = (sources: readonly QuestionSource[]): number => {
      if (sources.length === 0) return 0;

      const avgSimilarity = sources.reduce((sum, s) => sum + s.similarity, 0) / sources.length;
      const sourceBonus = Math.min(sources.length / 5, 0.2); // Up to 0.2 bonus for multiple sources

      return Math.min(avgSimilarity + sourceBonus, 1);
    };

    return {
      answerQuestion: (organizationId, question, options) =>
        Effect.gen(function* () {
          // Generate embedding for the question
          const queryEmbedding = yield* embeddingService.generateEmbedding(question);

          // Search knowledge base
          const sources = yield* searchKnowledgeBase(organizationId, queryEmbedding, options?.limit || 10);

          if (sources.length === 0) {
            return {
              answer: "I couldn't find relevant information in the knowledge base to answer your question.",
              confidence: 0,
              sources: [],
              followUpQuestions: ['Can you rephrase your question?', 'Would you like to search for a specific topic?'],
            };
          }

          // Build context and generate answer
          const context = buildContext(sources);
          const prompt = `Context from knowledge base:\n${context}\n\nQuestion: ${question}`;

          const result = yield* Effect.tryPromise({
            try: () =>
              generateText({
                model: gateway('anthropic/claude-sonnet-4-20250514'),
                system: QA_SYSTEM_PROMPT,
                prompt,
              }),
            catch: (e) => new AIServiceError({ message: `Failed to generate answer: ${e}` }),
          });

          const { answer, followUpQuestions } = parseQAResponse(result.text);
          const confidence = calculateConfidence(sources);

          return {
            answer,
            confidence,
            sources: sources.slice(0, 5), // Return top 5 sources
            followUpQuestions,
          };
        }),

      chat: (organizationId, messages, _context) =>
        Effect.gen(function* () {
          // Get the last user message for search
          const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
          if (!lastUserMessage) {
            return {
              response: 'Please provide a question or message.',
              sources: [],
            };
          }

          // Generate embedding for the last user message
          const queryEmbedding = yield* embeddingService.generateEmbedding(lastUserMessage.content);

          // Search knowledge base
          const sources = yield* searchKnowledgeBase(organizationId, queryEmbedding, 8);

          // Build context
          const knowledgeContext = buildContext(sources);

          // Format conversation history
          const conversationHistory = messages
            .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
            .join('\n\n');

          const prompt = `Knowledge base context:\n${knowledgeContext}\n\nConversation:\n${conversationHistory}\n\nProvide a helpful response to the user's latest message.`;

          const result = yield* Effect.tryPromise({
            try: () =>
              generateText({
                model: gateway('anthropic/claude-sonnet-4-20250514'),
                system: CHAT_SYSTEM_PROMPT,
                prompt,
              }),
            catch: (e) => new AIServiceError({ message: `Failed to generate chat response: ${e}` }),
          });

          return {
            response: result.text,
            sources: sources.slice(0, 3),
          };
        }),
    };
  }),
);

// =============================================================================
// Convenience Functions
// =============================================================================

export const answerQuestion = (
  organizationId: string,
  question: string,
  options?: { limit?: number; sources?: readonly string[] },
) =>
  Effect.gen(function* () {
    const qa = yield* KnowledgeQA;
    return yield* qa.answerQuestion(organizationId, question, options);
  });

export const chatWithKnowledge = (
  organizationId: string,
  messages: readonly ChatMessage[],
  context?: { topicIds?: readonly string[]; decisionIds?: readonly string[] },
) =>
  Effect.gen(function* () {
    const qa = yield* KnowledgeQA;
    return yield* qa.chat(organizationId, messages, context);
  });
