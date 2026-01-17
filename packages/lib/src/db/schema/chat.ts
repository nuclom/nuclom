/**
 * Chat Schema
 *
 * Tables for AI chat knowledge base:
 * - chatConversations: Chat sessions scoped to organizations
 * - chatMessages: Messages in conversations with embeddings for context
 * - chatContext: Links between messages and knowledge sources (decisions, transcript chunks)
 */

import { relations } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp, unique, vector } from 'drizzle-orm/pg-core';
import { organizations, users } from './auth';
import { chatMessageRoleEnum } from './enums';

// =============================================================================
// Chat Conversations
// =============================================================================

export const chatConversations = pgTable(
  'chat_conversations',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title'), // Auto-generated or user-provided title
    // Optional: scope to specific videos
    videoIds: jsonb('video_ids').$type<string[]>().default([]),
    metadata: jsonb('metadata').$type<{
      model?: string;
      systemPrompt?: string;
      temperature?: number;
    }>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index('chat_conversations_org_idx').on(table.organizationId, table.createdAt),
    userIdx: index('chat_conversations_user_idx').on(table.userId, table.createdAt),
  }),
);

// =============================================================================
// Chat Messages
// =============================================================================

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => chatConversations.id, { onDelete: 'cascade' }),
    role: chatMessageRoleEnum('role').notNull(),
    content: text('content').notNull(),
    // Embedding for semantic search across chat history
    embedding: vector('embedding', { dimensions: 1536 }),
    // Tool call information for assistant messages
    toolCalls:
      jsonb('tool_calls').$type<
        Array<{
          id: string;
          name: string;
          arguments: Record<string, unknown>;
        }>
      >(),
    // Tool result for tool messages
    toolResult: jsonb('tool_result').$type<{
      toolCallId: string;
      result: unknown;
    }>(),
    // Usage statistics for assistant responses
    usage: jsonb('usage').$type<{
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    }>(),
    // Sources used to generate this response
    sources:
      jsonb('sources').$type<
        Array<{
          type: 'decision' | 'transcript_chunk' | 'video';
          id: string;
          relevance: number;
          preview?: string;
        }>
      >(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    conversationIdx: index('chat_messages_conversation_idx').on(table.conversationId, table.createdAt),
    roleIdx: index('chat_messages_role_idx').on(table.role),
  }),
);

// =============================================================================
// Chat Context
// =============================================================================

/**
 * Links messages to knowledge sources that were used in context retrieval.
 * This enables tracking which decisions/transcripts influenced responses.
 */
export const chatContext = pgTable(
  'chat_context',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    messageId: text('message_id')
      .notNull()
      .references(() => chatMessages.id, { onDelete: 'cascade' }),
    // Polymorphic reference to knowledge sources
    sourceType: text('source_type').notNull(), // 'decision' | 'transcript_chunk' | 'video'
    sourceId: text('source_id').notNull(),
    // Relevance score from semantic search
    relevanceScore: integer('relevance_score'), // 0-100
    // The text snippet that was used in context
    contextSnippet: text('context_snippet'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    messageIdx: index('chat_context_message_idx').on(table.messageId),
    sourceIdx: index('chat_context_source_idx').on(table.sourceType, table.sourceId),
    uniqueContext: unique('chat_context_unique').on(table.messageId, table.sourceType, table.sourceId),
  }),
);

// =============================================================================
// Type Exports
// =============================================================================

export type ChatConversation = typeof chatConversations.$inferSelect;
export type NewChatConversation = typeof chatConversations.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
export type ChatContext = typeof chatContext.$inferSelect;
export type NewChatContext = typeof chatContext.$inferInsert;

// =============================================================================
// Relations
// =============================================================================

export const chatConversationsRelations = relations(chatConversations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [chatConversations.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [chatConversations.userId],
    references: [users.id],
  }),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one, many }) => ({
  conversation: one(chatConversations, {
    fields: [chatMessages.conversationId],
    references: [chatConversations.id],
  }),
  contexts: many(chatContext),
}));

export const chatContextRelations = relations(chatContext, ({ one }) => ({
  message: one(chatMessages, {
    fields: [chatContext.messageId],
    references: [chatMessages.id],
  }),
}));
