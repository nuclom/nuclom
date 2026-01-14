# AI Chat Knowledge Base

The AI Chat Knowledge Base feature provides an intelligent conversational interface that allows users to query their organization's video content using natural language. It uses a tool-based agent loop pattern with the Vercel AI SDK to provide accurate, context-aware responses grounded in the organization's knowledge base.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Chat UI                                  │
│  ┌─────────────────────┐  ┌──────────────────────────────────┐  │
│  │  Conversation List  │  │         Chat Container           │  │
│  │  - List/Create      │  │  - Message History               │  │
│  │  - Delete/Rename    │  │  - Streaming Responses           │  │
│  └─────────────────────┘  │  - Source Citations              │  │
│                           └──────────────────────────────────┘  │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Routes (/api/chat/*)                      │
│  ┌──────────────────┐  ┌──────────────────────────────────────┐ │
│  │  Conversations   │  │            Messages                  │ │
│  │  - GET (list)    │  │  - GET (list messages)               │ │
│  │  - POST (create) │  │  - POST (send + stream response)     │ │
│  │  - PATCH/DELETE  │  └──────────────────────────────────────┘ │
│  └──────────────────┘                                           │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Effect-TS Services                            │
│  ┌──────────────────┐  ┌──────────────────────────────────────┐ │
│  │  ChatRepository  │  │           AIChatKB                   │ │
│  │  - CRUD ops      │  │  - Tool Loop Agent                   │ │
│  │  - Message store │  │  - Knowledge Tools                   │ │
│  │  - Context links │  │  - RAG Generation                    │ │
│  └──────────────────┘  └──────────────────────────────────────┘ │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Knowledge Sources                             │
│  ┌──────────────────┐  ┌──────────────────────────────────────┐ │
│  │  Transcript      │  │           Decisions                  │ │
│  │  Chunks          │  │  - Knowledge Graph                   │ │
│  │  - Vector search │  │  - Context & Reasoning               │ │
│  └──────────────────┘  └──────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Database Schema

### Tables (src/lib/db/schema/chat.ts)

#### chat_conversations
Stores chat sessions scoped to organizations and users.

| Column | Type | Description |
|--------|------|-------------|
| id | text | Primary key (UUID) |
| organization_id | text | FK to organizations |
| user_id | text | FK to users |
| title | text | Auto-generated or user-provided title |
| video_ids | jsonb | Optional: scope to specific videos |
| metadata | jsonb | Model settings, system prompt |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Last update time |

#### chat_messages
Stores messages in conversations with vector embeddings.

| Column | Type | Description |
|--------|------|-------------|
| id | text | Primary key (UUID) |
| conversation_id | text | FK to chat_conversations |
| role | enum | 'user', 'assistant', 'system', 'tool' |
| content | text | Message content |
| embedding | vector(1536) | For semantic search across chat history |
| tool_calls | jsonb | Tool calls for assistant messages |
| tool_result | jsonb | Tool results for tool messages |
| usage | jsonb | Token usage statistics |
| sources | jsonb | Knowledge sources used in response |
| created_at | timestamp | Message timestamp |

#### chat_context
Links messages to knowledge sources.

| Column | Type | Description |
|--------|------|-------------|
| id | text | Primary key (UUID) |
| message_id | text | FK to chat_messages |
| source_type | text | 'decision', 'transcript_chunk', 'video' |
| source_id | text | ID of the source entity |
| relevance_score | integer | 0-100 similarity score |
| context_snippet | text | Text snippet used in context |
| created_at | timestamp | Link creation time |

## Services

### ChatRepository (src/lib/effect/services/chat-repository.ts)

Provides CRUD operations for conversations and messages.

```typescript
// Key operations
createConversation(data: NewChatConversation): Effect<ChatConversation>
getConversation(id: string): Effect<ChatConversation | null>
listConversations(params: ListConversationsParams): Effect<ConversationWithCount[]>
createMessage(data: NewChatMessage): Effect<ChatMessage>
getMessages(conversationId: string, limit?: number): Effect<ChatMessage[]>
searchMessages(params: SearchMessagesParams): Effect<MessageSearchResult[]>
addContexts(data: NewChatContext[]): Effect<ChatContext[]>
```

### AIChatKB (src/lib/effect/services/ai-chat-kb.ts)

AI agent service with tool loop for knowledge-grounded responses.

```typescript
// Key operations
generateResponse(messages: ChatMessage[], context: ChatContext): Effect<ChatResponse>
streamResponse(messages: ChatMessage[], context: ChatContext, callbacks?): Effect<ReadableStream>
```

#### Knowledge Tools

The agent has access to the following tools:

1. **searchKnowledgeBase** - Semantic search across transcripts and decisions using pgvector
2. **getDecisionDetails** - Get detailed information about a specific decision by ID
3. **listRecentDecisions** - List recent decisions with optional filters
4. **bash** - Execute shell commands for data processing and analysis (via bash-tool)

#### Tool Loop Pattern

The service uses AI SDK 6.x with `stopWhen: stepCountIs(10)` to enable multi-step reasoning:

```typescript
const result = await generateText({
  model: gateway('xai/grok-3'),
  messages: allMessages,
  tools: allTools,
  stopWhen: stepCountIs(10), // Allow up to 10 tool invocations
});
```

This allows the AI to:
- Search the knowledge base for relevant content
- Retrieve decision details when needed
- Use bash for text processing or calculations
- Iteratively refine responses based on tool results

## API Routes

### Conversations
- `GET /api/chat/conversations` - List user's conversations
- `POST /api/chat/conversations` - Create new conversation
- `GET /api/chat/conversations/[id]` - Get conversation with messages
- `PATCH /api/chat/conversations/[id]` - Update conversation title
- `DELETE /api/chat/conversations/[id]` - Delete conversation

### Messages
- `GET /api/chat/conversations/[id]/messages` - List messages
- `POST /api/chat/conversations/[id]/messages` - Send message (streaming or non-streaming)

### Streaming Response Format (SSE)

```typescript
// Chunk event
data: { type: 'chunk', content: 'partial response text' }

// Source event
data: { type: 'source', source: { type, id, relevance, preview } }

// Done event
data: { type: 'done', messageId: 'uuid', usage: { promptTokens, completionTokens, totalTokens } }

// Error event
data: { type: 'error', error: 'error message' }
```

## UI Components (src/components/chat/)

### ChatContainer
Main container managing chat state, message streaming, and API interactions.

```typescript
<ChatContainer
  conversationId="uuid"
  organizationId="uuid"
  initialMessages={[]}
  onMessageSent={(message) => {}}
/>
```

### ChatConversationList
Sidebar showing conversation history with create/delete/rename actions.

```typescript
<ChatConversationList
  conversations={conversations}
  selectedId={selectedId}
  onSelect={(id) => {}}
  onNew={() => {}}
  onDelete={(id) => {}}
  onRename={(id, title) => {}}
/>
```

### ChatMessage
Individual message display with markdown rendering and source citations.

### ChatInput
Input component with auto-resize and submit/stop controls.

## Usage

### Page Route

The chat feature is available at `/:organization/chat` for authenticated users.

### Creating a Conversation Programmatically

```typescript
const response = await fetch('/api/chat/conversations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    organizationId: 'org-uuid',
    title: 'Optional title',
    videoIds: ['video-uuid-1', 'video-uuid-2'], // Optional: scope to videos
    systemPrompt: 'Optional custom system prompt',
  }),
});
```

### Sending a Message with Streaming

```typescript
const response = await fetch(`/api/chat/conversations/${id}/messages`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: 'What decisions were made about the database architecture?',
    stream: true,
  }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  // Parse SSE events
  for (const line of chunk.split('\n\n')) {
    if (line.startsWith('data: ')) {
      const event = JSON.parse(line.slice(6));
      // Handle event based on type
    }
  }
}
```

## Configuration

### Environment Variables

No additional environment variables required. The feature uses the existing AI gateway configuration.

### System Prompt Customization

Custom system prompts can be set per conversation:

```typescript
{
  metadata: {
    systemPrompt: `You are a helpful assistant specializing in ${topic}...`,
    model: 'xai/grok-3',
    temperature: 0.7,
  }
}
```

## Performance Considerations

1. **Vector Search**: Uses pgvector for efficient similarity search
2. **Streaming**: Responses are streamed to reduce perceived latency
3. **Context Window**: Tool loop limited to 10 steps to manage token usage
4. **Embedding Generation**: User messages are embedded asynchronously

## Related Documentation

- [Semantic Search](./semantic-search.md) - How vector search works
- [Knowledge Graph](./knowledge-graph.md) - Decision and entity tracking
- [Effect-TS Best Practices](./effect-best-practices.md) - Service patterns
