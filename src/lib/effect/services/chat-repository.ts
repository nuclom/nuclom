/**
 * Chat Repository Service using Effect-TS
 *
 * Provides type-safe database operations for the AI chat knowledge base.
 * Supports storing conversations, messages, and linking to knowledge sources.
 */

import { and, desc, eq, sql } from 'drizzle-orm';
import { Context, Effect, Layer } from 'effect';
import {
  type ChatContext,
  type ChatConversation,
  type ChatMessage,
  chatContext,
  chatConversations,
  chatMessages,
  type NewChatContext,
  type NewChatConversation,
  type NewChatMessage,
} from '@/lib/db/schema';
import { DatabaseError } from '../errors';
import { Database } from './database';

// =============================================================================
// Types
// =============================================================================

/**
 * Conversation with message count
 */
export interface ConversationWithCount extends ChatConversation {
  readonly messageCount: number;
}

/**
 * Message with context sources
 */
export interface MessageWithContext extends ChatMessage {
  readonly contexts: readonly ChatContext[];
}

/**
 * Parameters for listing conversations
 */
export interface ListConversationsParams {
  readonly organizationId: string;
  readonly userId: string;
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Parameters for searching messages
 */
export interface SearchMessagesParams {
  readonly organizationId: string;
  readonly queryEmbedding: readonly number[];
  readonly limit?: number;
  readonly threshold?: number;
  readonly conversationIds?: readonly string[];
}

/**
 * Search result with similarity score
 */
export interface MessageSearchResult {
  readonly message: ChatMessage;
  readonly conversationId: string;
  readonly similarity: number;
}

export interface ChatRepositoryService {
  // Conversation operations
  readonly createConversation: (data: NewChatConversation) => Effect.Effect<ChatConversation, DatabaseError>;
  readonly getConversation: (id: string) => Effect.Effect<ChatConversation | null, DatabaseError>;
  readonly listConversations: (
    params: ListConversationsParams,
  ) => Effect.Effect<readonly ConversationWithCount[], DatabaseError>;
  readonly updateConversationTitle: (
    id: string,
    title: string,
  ) => Effect.Effect<ChatConversation | null, DatabaseError>;
  readonly deleteConversation: (id: string) => Effect.Effect<void, DatabaseError>;

  // Message operations
  readonly createMessage: (data: NewChatMessage) => Effect.Effect<ChatMessage, DatabaseError>;
  readonly createMessages: (data: readonly NewChatMessage[]) => Effect.Effect<readonly ChatMessage[], DatabaseError>;
  readonly getMessages: (
    conversationId: string,
    limit?: number,
  ) => Effect.Effect<readonly ChatMessage[], DatabaseError>;
  readonly getMessageWithContext: (messageId: string) => Effect.Effect<MessageWithContext | null, DatabaseError>;
  readonly updateMessageEmbedding: (
    messageId: string,
    embedding: readonly number[],
  ) => Effect.Effect<void, DatabaseError>;

  // Context operations
  readonly addContext: (data: NewChatContext) => Effect.Effect<ChatContext, DatabaseError>;
  readonly addContexts: (data: readonly NewChatContext[]) => Effect.Effect<readonly ChatContext[], DatabaseError>;
  readonly getContextsForMessage: (messageId: string) => Effect.Effect<readonly ChatContext[], DatabaseError>;

  // Search operations
  readonly searchMessages: (
    params: SearchMessagesParams,
  ) => Effect.Effect<readonly MessageSearchResult[], DatabaseError>;
}

// =============================================================================
// Chat Repository Tag
// =============================================================================

export class ChatRepository extends Context.Tag('ChatRepository')<ChatRepository, ChatRepositoryService>() {}

// =============================================================================
// Chat Repository Implementation
// =============================================================================

const makeChatRepositoryService = Effect.gen(function* () {
  const { db } = yield* Database;

  // ---------------------------------------------------------------------------
  // Conversation Operations
  // ---------------------------------------------------------------------------

  const createConversation = (data: NewChatConversation): Effect.Effect<ChatConversation, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const [result] = await db.insert(chatConversations).values(data).returning();
        return result;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to create conversation',
          operation: 'createConversation',
          cause: error,
        }),
    });

  const getConversation = (id: string): Effect.Effect<ChatConversation | null, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const result = await db.query.chatConversations.findFirst({
          where: eq(chatConversations.id, id),
        });
        return result ?? null;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to get conversation',
          operation: 'getConversation',
          cause: error,
        }),
    });

  const listConversations = (
    params: ListConversationsParams,
  ): Effect.Effect<readonly ConversationWithCount[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const { organizationId, userId, limit = 50, offset = 0 } = params;

        const results = await db
          .select({
            id: chatConversations.id,
            organizationId: chatConversations.organizationId,
            userId: chatConversations.userId,
            title: chatConversations.title,
            videoIds: chatConversations.videoIds,
            metadata: chatConversations.metadata,
            createdAt: chatConversations.createdAt,
            updatedAt: chatConversations.updatedAt,
            messageCount: sql<number>`count(${chatMessages.id})::integer`,
          })
          .from(chatConversations)
          .leftJoin(chatMessages, eq(chatConversations.id, chatMessages.conversationId))
          .where(and(eq(chatConversations.organizationId, organizationId), eq(chatConversations.userId, userId)))
          .groupBy(chatConversations.id)
          .orderBy(desc(chatConversations.updatedAt))
          .limit(limit)
          .offset(offset);

        return results as ConversationWithCount[];
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to list conversations',
          operation: 'listConversations',
          cause: error,
        }),
    });

  const updateConversationTitle = (id: string, title: string): Effect.Effect<ChatConversation | null, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const [result] = await db
          .update(chatConversations)
          .set({ title, updatedAt: new Date() })
          .where(eq(chatConversations.id, id))
          .returning();
        return result ?? null;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to update conversation title',
          operation: 'updateConversationTitle',
          cause: error,
        }),
    });

  const deleteConversation = (id: string): Effect.Effect<void, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        await db.delete(chatConversations).where(eq(chatConversations.id, id));
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to delete conversation',
          operation: 'deleteConversation',
          cause: error,
        }),
    });

  // ---------------------------------------------------------------------------
  // Message Operations
  // ---------------------------------------------------------------------------

  const createMessage = (data: NewChatMessage): Effect.Effect<ChatMessage, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const [result] = await db.insert(chatMessages).values(data).returning();
        // Update conversation's updatedAt timestamp
        await db
          .update(chatConversations)
          .set({ updatedAt: new Date() })
          .where(eq(chatConversations.id, data.conversationId));
        return result;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to create message',
          operation: 'createMessage',
          cause: error,
        }),
    });

  const createMessages = (data: readonly NewChatMessage[]): Effect.Effect<readonly ChatMessage[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        if (data.length === 0) return [];
        const results = await db
          .insert(chatMessages)
          .values(data as NewChatMessage[])
          .returning();
        // Update conversation's updatedAt timestamp
        const conversationId = data[0].conversationId;
        await db
          .update(chatConversations)
          .set({ updatedAt: new Date() })
          .where(eq(chatConversations.id, conversationId));
        return results;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to create messages',
          operation: 'createMessages',
          cause: error,
        }),
    });

  const getMessages = (conversationId: string, limit = 100): Effect.Effect<readonly ChatMessage[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        return await db
          .select()
          .from(chatMessages)
          .where(eq(chatMessages.conversationId, conversationId))
          .orderBy(chatMessages.createdAt)
          .limit(limit);
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to get messages',
          operation: 'getMessages',
          cause: error,
        }),
    });

  const getMessageWithContext = (messageId: string): Effect.Effect<MessageWithContext | null, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const message = await db.query.chatMessages.findFirst({
          where: eq(chatMessages.id, messageId),
          with: {
            contexts: true,
          },
        });
        return message ?? null;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to get message with context',
          operation: 'getMessageWithContext',
          cause: error,
        }),
    });

  const updateMessageEmbedding = (
    messageId: string,
    embedding: readonly number[],
  ): Effect.Effect<void, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        await db
          .update(chatMessages)
          .set({ embedding: [...embedding] })
          .where(eq(chatMessages.id, messageId));
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to update message embedding',
          operation: 'updateMessageEmbedding',
          cause: error,
        }),
    });

  // ---------------------------------------------------------------------------
  // Context Operations
  // ---------------------------------------------------------------------------

  const addContext = (data: NewChatContext): Effect.Effect<ChatContext, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const [result] = await db.insert(chatContext).values(data).returning();
        return result;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to add context',
          operation: 'addContext',
          cause: error,
        }),
    });

  const addContexts = (data: readonly NewChatContext[]): Effect.Effect<readonly ChatContext[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        if (data.length === 0) return [];
        return await db
          .insert(chatContext)
          .values(data as NewChatContext[])
          .returning();
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to add contexts',
          operation: 'addContexts',
          cause: error,
        }),
    });

  const getContextsForMessage = (messageId: string): Effect.Effect<readonly ChatContext[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        return await db.select().from(chatContext).where(eq(chatContext.messageId, messageId));
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to get contexts for message',
          operation: 'getContextsForMessage',
          cause: error,
        }),
    });

  // ---------------------------------------------------------------------------
  // Search Operations
  // ---------------------------------------------------------------------------

  const searchMessages = (params: SearchMessagesParams): Effect.Effect<readonly MessageSearchResult[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const { queryEmbedding, limit = 20, threshold = 0.7, conversationIds } = params;

        // Convert embedding array to PostgreSQL vector format
        const embeddingStr = `[${queryEmbedding.join(',')}]`;

        const results = await db.execute<{
          id: string;
          conversation_id: string;
          role: 'user' | 'assistant' | 'system' | 'tool';
          content: string;
          embedding: number[] | null;
          tool_calls: unknown;
          tool_result: unknown;
          usage: unknown;
          sources: unknown;
          created_at: Date;
          similarity: number;
        }>(sql`
          SELECT
            m.*,
            1 - (m.embedding::vector <=> ${embeddingStr}::vector) as similarity
          FROM chat_messages m
          JOIN chat_conversations c ON m.conversation_id = c.id
          WHERE m.embedding IS NOT NULL
            ${conversationIds && conversationIds.length > 0 ? sql`AND c.id = ANY(${conversationIds})` : sql``}
            AND 1 - (m.embedding::vector <=> ${embeddingStr}::vector) >= ${threshold}
          ORDER BY similarity DESC
          LIMIT ${limit}
        `);

        return results.map((row) => ({
          message: {
            id: row.id,
            conversationId: row.conversation_id,
            role: row.role,
            content: row.content,
            embedding: row.embedding,
            toolCalls: row.tool_calls,
            toolResult: row.tool_result,
            usage: row.usage,
            sources: row.sources,
            createdAt: row.created_at,
          } as ChatMessage,
          conversationId: row.conversation_id,
          similarity: row.similarity,
        }));
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to search messages',
          operation: 'searchMessages',
          cause: error,
        }),
    });

  return {
    createConversation,
    getConversation,
    listConversations,
    updateConversationTitle,
    deleteConversation,
    createMessage,
    createMessages,
    getMessages,
    getMessageWithContext,
    updateMessageEmbedding,
    addContext,
    addContexts,
    getContextsForMessage,
    searchMessages,
  } satisfies ChatRepositoryService;
});

// =============================================================================
// Chat Repository Layer
// =============================================================================

export const ChatRepositoryLive = Layer.effect(ChatRepository, makeChatRepositoryService);

// =============================================================================
// Helper Functions
// =============================================================================

export const createConversation = (
  data: NewChatConversation,
): Effect.Effect<ChatConversation, DatabaseError, ChatRepository> =>
  Effect.gen(function* () {
    const repo = yield* ChatRepository;
    return yield* repo.createConversation(data);
  });

export const getConversation = (id: string): Effect.Effect<ChatConversation | null, DatabaseError, ChatRepository> =>
  Effect.gen(function* () {
    const repo = yield* ChatRepository;
    return yield* repo.getConversation(id);
  });

export const listConversations = (
  params: ListConversationsParams,
): Effect.Effect<readonly ConversationWithCount[], DatabaseError, ChatRepository> =>
  Effect.gen(function* () {
    const repo = yield* ChatRepository;
    return yield* repo.listConversations(params);
  });

export const createMessage = (data: NewChatMessage): Effect.Effect<ChatMessage, DatabaseError, ChatRepository> =>
  Effect.gen(function* () {
    const repo = yield* ChatRepository;
    return yield* repo.createMessage(data);
  });

export const getMessages = (
  conversationId: string,
  limit?: number,
): Effect.Effect<readonly ChatMessage[], DatabaseError, ChatRepository> =>
  Effect.gen(function* () {
    const repo = yield* ChatRepository;
    return yield* repo.getMessages(conversationId, limit);
  });
