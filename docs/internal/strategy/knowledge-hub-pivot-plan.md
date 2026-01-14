# Knowledge Hub Pivot Plan

## Executive Summary

Transform Nuclom from a video-centric collaboration platform to a **unified knowledge hub** that aggregates, processes, and surfaces insights from multiple organizational knowledge sources:

- **Videos** (existing - meetings, recordings, async updates)
- **Slack Messages** (conversations, threads, announcements)
- **Notion Sites** (documentation, wikis, project notes)
- **GitHub Repositories** (code, PRs, issues, discussions)

The pivot leverages existing infrastructure (knowledge graph, semantic search, AI processing, integration framework) while introducing a **content-agnostic architecture** that treats all knowledge sources as first-class citizens.

---

## Strategic Vision

### Current State: Video Collaboration Platform
```
Videos → Transcription → AI Analysis → Search/Discovery
                              ↓
                    Knowledge Graph (video-centric)
```

### Target State: Unified Knowledge Hub
```
┌─────────────────────────────────────────────────────────────┐
│                     KNOWLEDGE SOURCES                        │
├─────────────┬─────────────┬─────────────┬───────────────────┤
│   Videos    │   Slack     │   Notion    │    GitHub         │
│  Meetings   │  Messages   │   Docs      │   Code/PRs        │
└──────┬──────┴──────┬──────┴──────┬──────┴────────┬──────────┘
       │             │             │               │
       ▼             ▼             ▼               ▼
┌─────────────────────────────────────────────────────────────┐
│              UNIFIED INGESTION LAYER                         │
│  Content normalization, chunking, embedding generation       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              KNOWLEDGE PROCESSING ENGINE                     │
│  Entity extraction, relationship mapping, topic clustering   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              UNIFIED KNOWLEDGE GRAPH                         │
│  Decisions, people, topics, artifacts, cross-source links   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              DISCOVERY & INTELLIGENCE                        │
│  Semantic search, recommendations, insights, Q&A             │
└─────────────────────────────────────────────────────────────┘
```

### Core Value Propositions

1. **Unified Search** - Find any knowledge regardless of where it lives
2. **Cross-Source Insights** - "This Slack discussion relates to this PR which was decided in this meeting"
3. **Decision Intelligence** - Track how decisions flow from discussion to documentation to implementation
4. **Knowledge Discovery** - Surface relevant context you didn't know existed
5. **Organizational Memory** - Build an institutional knowledge base that persists across team changes

---

## Phase 1: Foundation - Content Source Abstraction

**Goal**: Refactor the architecture to support multiple content types with unified processing.

### 1.1 Database Schema Changes

#### New Core Tables

```sql
-- Replace video-centric model with content-source-agnostic model

-- Content sources (the "pipes" bringing content in)
CREATE TABLE content_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  type TEXT NOT NULL, -- 'video', 'slack', 'notion', 'github'
  name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}', -- Source-specific configuration
  sync_status TEXT DEFAULT 'idle', -- 'idle', 'syncing', 'error'
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Unified content items (the "atoms" of knowledge)
CREATE TABLE content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  source_id UUID NOT NULL REFERENCES content_sources(id),
  type TEXT NOT NULL, -- 'video', 'slack_message', 'slack_thread', 'notion_page', 'github_pr', 'github_issue', 'github_discussion'
  external_id TEXT NOT NULL, -- ID in source system

  -- Universal fields
  title TEXT,
  content TEXT, -- Normalized text content (transcript for video, message for slack, markdown for notion/github)
  content_html TEXT, -- Original HTML/rich content if applicable
  author_id UUID REFERENCES users(id), -- Linked user if identifiable
  author_external TEXT, -- External author identifier
  author_name TEXT, -- Display name

  -- Temporal
  created_at_source TIMESTAMP, -- When created in source system
  updated_at_source TIMESTAMP, -- Last modification in source

  -- Metadata
  metadata JSONB DEFAULT '{}', -- Source-specific metadata
  tags TEXT[] DEFAULT '{}',

  -- Processing
  processing_status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  processed_at TIMESTAMP,

  -- AI-generated
  summary TEXT,
  key_points JSONB DEFAULT '[]',
  sentiment TEXT, -- 'positive', 'neutral', 'negative', 'mixed'

  -- Search
  embedding_vector vector(1536),
  search_text TEXT, -- Denormalized searchable text

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(source_id, external_id)
);

-- Content chunks (for long-form content semantic search)
CREATE TABLE content_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding_vector vector(1536),

  -- Context markers
  start_offset INTEGER, -- Character offset in original
  end_offset INTEGER,
  timestamp_start INTEGER, -- For video/audio (milliseconds)
  timestamp_end INTEGER,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Content relationships (explicit links between items)
CREATE TABLE content_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  target_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL, -- 'references', 'replies_to', 'implements', 'documents', 'supersedes', 'related'
  confidence REAL DEFAULT 1.0, -- AI-detected vs explicit
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(source_item_id, target_item_id, relationship_type)
);

-- Content participants (who's involved in content)
CREATE TABLE content_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id), -- Linked if identifiable
  external_id TEXT, -- External user ID
  name TEXT NOT NULL,
  email TEXT,
  role TEXT DEFAULT 'participant', -- 'author', 'participant', 'mentioned', 'reviewer', 'assignee'
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Migration Strategy for Existing Data

```sql
-- Migrate existing videos to content_items
INSERT INTO content_items (
  organization_id, source_id, type, external_id,
  title, content, author_id,
  created_at_source, processing_status, summary,
  embedding_vector, metadata
)
SELECT
  v.organization_id,
  cs.id, -- Default video source for org
  'video',
  v.id::text,
  v.title,
  v.transcript_text,
  v.user_id,
  v.created_at,
  CASE
    WHEN v.status = 'completed' THEN 'completed'
    WHEN v.status = 'failed' THEN 'failed'
    ELSE 'pending'
  END,
  v.summary,
  NULL, -- Re-generate embeddings
  jsonb_build_object(
    'duration', v.duration,
    'storage_key', v.storage_key,
    'thumbnail_key', v.thumbnail_key,
    'transcript_segments', v.transcript_segments
  )
FROM videos v
JOIN content_sources cs ON cs.organization_id = v.organization_id AND cs.type = 'video';
```

### 1.2 Service Layer Abstraction

#### Content Source Interface

```typescript
// src/lib/effect/services/content/content-source.ts

import { Context, Effect, Data } from "effect";

// Universal content item structure
export interface ContentItem {
  id: string;
  sourceId: string;
  type: ContentItemType;
  externalId: string;
  title: string | null;
  content: string | null;
  authorExternalId: string | null;
  authorName: string | null;
  createdAtSource: Date;
  updatedAtSource: Date | null;
  metadata: Record<string, unknown>;
}

export type ContentItemType =
  | "video"
  | "slack_message"
  | "slack_thread"
  | "notion_page"
  | "notion_database"
  | "github_pr"
  | "github_issue"
  | "github_discussion"
  | "github_commit";

// Errors
export class ContentSourceError extends Data.TaggedError("ContentSourceError")<{
  readonly message: string;
  readonly sourceType: string;
  readonly cause?: unknown;
}> {}

export class ContentSyncError extends Data.TaggedError("ContentSyncError")<{
  readonly message: string;
  readonly sourceId: string;
  readonly itemsProcessed: number;
  readonly itemsFailed: number;
}> {}

// Interface all content sources must implement
export interface ContentSourceAdapter {
  readonly type: string;

  // OAuth flow
  getAuthUrl(organizationId: string, redirectUri: string): Effect.Effect<string, ContentSourceError>;
  handleCallback(code: string, state: string): Effect.Effect<ContentSourceCredentials, ContentSourceError>;

  // Sync operations
  sync(sourceId: string, options?: SyncOptions): Effect.Effect<SyncResult, ContentSyncError>;
  syncIncremental(sourceId: string, since: Date): Effect.Effect<SyncResult, ContentSyncError>;

  // Content fetching
  fetchItem(sourceId: string, externalId: string): Effect.Effect<ContentItem, ContentSourceError>;
  fetchItems(sourceId: string, externalIds: string[]): Effect.Effect<ContentItem[], ContentSourceError>;

  // Webhooks
  handleWebhook(payload: unknown, headers: Record<string, string>): Effect.Effect<WebhookResult, ContentSourceError>;
}

export interface SyncOptions {
  fullSync?: boolean;
  since?: Date;
  filters?: {
    channels?: string[];
    spaces?: string[];
    repos?: string[];
  };
}

export interface SyncResult {
  itemsCreated: number;
  itemsUpdated: number;
  itemsDeleted: number;
  errors: Array<{ externalId: string; error: string }>;
}

export interface ContentSourceCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
  metadata?: Record<string, unknown>;
}
```

#### Unified Content Repository

```typescript
// src/lib/effect/services/content/content-repository.ts

import { Context, Effect, Layer } from "effect";
import { Database } from "../database";

export interface ContentRepositoryService {
  // CRUD
  createItem(item: CreateContentItemInput): Effect.Effect<ContentItem, DatabaseError>;
  updateItem(id: string, updates: UpdateContentItemInput): Effect.Effect<ContentItem, DatabaseError | NotFoundError>;
  deleteItem(id: string): Effect.Effect<void, DatabaseError | NotFoundError>;
  getItem(id: string): Effect.Effect<ContentItem, NotFoundError>;

  // Queries
  getItemsBySource(sourceId: string, options?: QueryOptions): Effect.Effect<PaginatedResult<ContentItem>>;
  getItemsByOrganization(orgId: string, options?: QueryOptions): Effect.Effect<PaginatedResult<ContentItem>>;
  getItemsByType(orgId: string, type: ContentItemType, options?: QueryOptions): Effect.Effect<PaginatedResult<ContentItem>>;

  // Search
  searchItems(orgId: string, query: string, options?: SearchOptions): Effect.Effect<SearchResult<ContentItem>>;
  semanticSearch(orgId: string, embedding: number[], options?: SemanticSearchOptions): Effect.Effect<SemanticSearchResult<ContentItem>>;
  hybridSearch(orgId: string, query: string, embedding: number[], options?: HybridSearchOptions): Effect.Effect<SearchResult<ContentItem>>;

  // Relationships
  createRelationship(rel: CreateRelationshipInput): Effect.Effect<ContentRelationship>;
  getRelationships(itemId: string, direction?: "incoming" | "outgoing" | "both"): Effect.Effect<ContentRelationship[]>;
  getRelatedItems(itemId: string, relationshipTypes?: string[]): Effect.Effect<ContentItem[]>;

  // Chunks
  createChunks(itemId: string, chunks: CreateChunkInput[]): Effect.Effect<ContentChunk[]>;
  getChunks(itemId: string): Effect.Effect<ContentChunk[]>;
  searchChunks(orgId: string, embedding: number[], options?: ChunkSearchOptions): Effect.Effect<ChunkSearchResult[]>;

  // Participants
  upsertParticipants(itemId: string, participants: ParticipantInput[]): Effect.Effect<ContentParticipant[]>;
  getParticipants(itemId: string): Effect.Effect<ContentParticipant[]>;
  getItemsByParticipant(orgId: string, userIdOrEmail: string): Effect.Effect<ContentItem[]>;
}

export class ContentRepository extends Context.Tag("ContentRepository")<
  ContentRepository,
  ContentRepositoryService
>() {}
```

### 1.3 Processing Pipeline Abstraction

```typescript
// src/lib/effect/services/content/content-processor.ts

export interface ContentProcessorService {
  // Main processing entry point
  processItem(itemId: string): Effect.Effect<ProcessedContent, ProcessingError>;

  // Individual processing steps (can be called independently)
  extractText(item: ContentItem): Effect.Effect<string, ProcessingError>;
  generateEmbedding(text: string): Effect.Effect<number[], ProcessingError>;
  chunkContent(text: string, options?: ChunkOptions): Effect.Effect<TextChunk[], ProcessingError>;
  extractEntities(text: string): Effect.Effect<ExtractedEntity[], ProcessingError>;
  generateSummary(text: string, context?: SummaryContext): Effect.Effect<string, ProcessingError>;
  extractKeyPoints(text: string): Effect.Effect<KeyPoint[], ProcessingError>;
  extractDecisions(text: string): Effect.Effect<ExtractedDecision[], ProcessingError>;
  extractActionItems(text: string): Effect.Effect<ExtractedActionItem[], ProcessingError>;
  detectRelationships(item: ContentItem, candidates: ContentItem[]): Effect.Effect<DetectedRelationship[], ProcessingError>;

  // Batch processing
  processItems(itemIds: string[], options?: BatchOptions): Effect.Effect<BatchProcessResult, ProcessingError>;
}

// Type-specific processors
export interface VideoProcessor {
  transcribe(videoUrl: string, options?: TranscriptionOptions): Effect.Effect<TranscriptionResult, ProcessingError>;
  extractSpeakers(transcript: TranscriptionResult): Effect.Effect<SpeakerSegment[], ProcessingError>;
  generateThumbnail(videoUrl: string, timestamp?: number): Effect.Effect<string, ProcessingError>;
}

export interface SlackProcessor {
  resolveUserMentions(content: string, sourceId: string): Effect.Effect<string, ProcessingError>;
  resolveChannelMentions(content: string, sourceId: string): Effect.Effect<string, ProcessingError>;
  extractThreadContext(messageId: string, sourceId: string): Effect.Effect<ThreadContext, ProcessingError>;
}

export interface NotionProcessor {
  renderToMarkdown(blocks: NotionBlock[]): Effect.Effect<string, ProcessingError>;
  extractDatabaseEntries(databaseId: string, sourceId: string): Effect.Effect<DatabaseEntry[], ProcessingError>;
  resolvePageReferences(content: string, sourceId: string): Effect.Effect<string, ProcessingError>;
}

export interface GitHubProcessor {
  extractCodeContext(diff: string): Effect.Effect<CodeContext, ProcessingError>;
  resolveUserMentions(content: string): Effect.Effect<string, ProcessingError>;
  extractLinkedIssues(content: string): Effect.Effect<LinkedIssue[], ProcessingError>;
}
```

---

## Phase 2: Slack Integration

**Goal**: Ingest Slack messages and threads as first-class knowledge items.

### 2.1 Slack OAuth Enhancement

Current Slack integration exists for notifications. Extend for content ingestion:

```typescript
// src/lib/effect/services/integrations/slack-content.ts

export interface SlackContentConfig {
  channels: string[]; // Channels to sync
  syncPrivate: boolean; // Include private channels user has access to
  syncThreads: boolean; // Include thread replies
  syncFiles: boolean; // Include shared files
  excludePatterns: string[]; // Message patterns to exclude (e.g., bot messages)
  lookbackDays: number; // Initial sync lookback period
}

export interface SlackContentAdapterService extends ContentSourceAdapter {
  // Additional Slack-specific methods
  listChannels(sourceId: string): Effect.Effect<SlackChannel[], ContentSourceError>;
  getChannelMembers(sourceId: string, channelId: string): Effect.Effect<SlackUser[], ContentSourceError>;
  syncChannel(sourceId: string, channelId: string, options?: SyncOptions): Effect.Effect<SyncResult, ContentSyncError>;

  // Real-time
  setupEventSubscription(sourceId: string): Effect.Effect<void, ContentSourceError>;
}
```

### 2.2 Slack Data Model

```sql
-- Slack-specific metadata stored in content_items.metadata
-- {
--   "channel_id": "C0123456789",
--   "channel_name": "engineering",
--   "channel_type": "public" | "private" | "dm" | "mpim",
--   "thread_ts": "1234567890.123456", -- If reply
--   "parent_ts": "1234567890.000000", -- Thread parent
--   "reactions": [{"name": "thumbsup", "count": 3}],
--   "files": [{"id": "F123", "name": "doc.pdf", "url": "..."}],
--   "blocks": [...], -- Original Slack blocks
--   "edited": {"user": "U123", "ts": "..."},
--   "reply_count": 5,
--   "reply_users_count": 3
-- }

-- Slack user mapping
CREATE TABLE slack_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES content_sources(id),
  slack_user_id TEXT NOT NULL,
  user_id UUID REFERENCES users(id), -- Linked Nuclom user
  display_name TEXT NOT NULL,
  real_name TEXT,
  email TEXT,
  avatar_url TEXT,
  is_bot BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(source_id, slack_user_id)
);

-- Track sync state per channel
CREATE TABLE slack_channel_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES content_sources(id),
  channel_id TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  channel_type TEXT NOT NULL,
  is_syncing BOOLEAN DEFAULT false,
  last_message_ts TEXT, -- Cursor for incremental sync
  last_sync_at TIMESTAMP,
  member_count INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(source_id, channel_id)
);
```

### 2.3 Slack Processing Pipeline

```typescript
// Thread aggregation - combine thread messages into coherent units
async function processSlackThread(
  parentMessage: SlackMessage,
  replies: SlackMessage[]
): Promise<ContentItem> {
  // Combine into single content item
  const fullContent = [
    `**${parentMessage.authorName}**: ${parentMessage.content}`,
    ...replies.map(r => `**${r.authorName}**: ${r.content}`)
  ].join("\n\n");

  // Extract participants
  const participants = new Set([
    parentMessage.authorId,
    ...replies.map(r => r.authorId)
  ]);

  // AI processing
  const summary = await generateSummary(fullContent);
  const decisions = await extractDecisions(fullContent);
  const actionItems = await extractActionItems(fullContent);

  return {
    type: "slack_thread",
    content: fullContent,
    summary,
    metadata: {
      decisions,
      actionItems,
      participantCount: participants.size,
      messageCount: replies.length + 1
    }
  };
}
```

### 2.4 Slack Webhooks (Real-time Updates)

```typescript
// src/app/api/webhooks/slack/route.ts

export async function POST(request: NextRequest) {
  const effect = Effect.gen(function* () {
    const payload = yield* validateSlackWebhook(request);
    const slackContent = yield* SlackContentAdapter;

    switch (payload.event.type) {
      case "message":
        // New message or thread reply
        yield* slackContent.handleNewMessage(payload);
        break;
      case "message_changed":
        // Message edited
        yield* slackContent.handleMessageUpdate(payload);
        break;
      case "message_deleted":
        // Message deleted
        yield* slackContent.handleMessageDelete(payload);
        break;
      case "reaction_added":
      case "reaction_removed":
        // Reaction changes (useful for identifying important messages)
        yield* slackContent.handleReactionChange(payload);
        break;
      case "channel_created":
      case "channel_archive":
        // Channel lifecycle
        yield* slackContent.handleChannelChange(payload);
        break;
    }
  });

  return handleEffectExit(await runApiEffect(effect));
}
```

---

## Phase 3: Notion Integration

**Goal**: Ingest Notion pages, databases, and wikis as knowledge items.

### 3.1 Notion OAuth Setup

```typescript
// src/lib/effect/services/integrations/notion-content.ts

export interface NotionContentConfig {
  workspaces: string[]; // Workspace IDs to sync
  rootPages: string[]; // Top-level pages to sync (recursively)
  databases: string[]; // Databases to sync
  syncComments: boolean;
  syncHistory: boolean; // Page edit history
  excludePatterns: string[]; // Page title patterns to exclude
}

export interface NotionContentAdapterService extends ContentSourceAdapter {
  // Notion-specific
  listWorkspaces(sourceId: string): Effect.Effect<NotionWorkspace[], ContentSourceError>;
  listPages(sourceId: string, parentId?: string): Effect.Effect<NotionPage[], ContentSourceError>;
  listDatabases(sourceId: string): Effect.Effect<NotionDatabase[], ContentSourceError>;
  getPageContent(sourceId: string, pageId: string): Effect.Effect<NotionPageContent, ContentSourceError>;
  getDatabaseSchema(sourceId: string, databaseId: string): Effect.Effect<NotionDatabaseSchema, ContentSourceError>;
  queryDatabase(sourceId: string, databaseId: string, filter?: NotionFilter): Effect.Effect<NotionDatabaseEntry[], ContentSourceError>;
}
```

### 3.2 Notion Data Model

```sql
-- Notion-specific metadata in content_items.metadata
-- For pages:
-- {
--   "page_id": "abc123...",
--   "workspace_id": "...",
--   "parent_type": "page" | "database" | "workspace",
--   "parent_id": "...",
--   "icon": {"type": "emoji", "emoji": "📝"} | {"type": "external", "url": "..."},
--   "cover": {"type": "external", "url": "..."},
--   "properties": {...}, -- If from database
--   "last_edited_by": {"id": "...", "name": "..."},
--   "created_by": {"id": "...", "name": "..."},
--   "url": "https://notion.so/..."
-- }

-- Track Notion page hierarchy
CREATE TABLE notion_page_hierarchy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES content_sources(id),
  page_id TEXT NOT NULL,
  parent_id TEXT, -- NULL for root pages
  depth INTEGER NOT NULL DEFAULT 0,
  path TEXT[], -- Breadcrumb path of IDs
  title_path TEXT[], -- Breadcrumb path of titles
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(source_id, page_id)
);

-- Track database schemas for structured queries
CREATE TABLE notion_database_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES content_sources(id),
  database_id TEXT NOT NULL,
  title TEXT NOT NULL,
  schema JSONB NOT NULL, -- Property definitions
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(source_id, database_id)
);
```

### 3.3 Notion Processing

```typescript
// Convert Notion blocks to searchable text
function notionBlocksToText(blocks: NotionBlock[]): string {
  return blocks.map(block => {
    switch (block.type) {
      case "paragraph":
        return richTextToPlain(block.paragraph.rich_text);
      case "heading_1":
      case "heading_2":
      case "heading_3":
        return `# ${richTextToPlain(block[block.type].rich_text)}`;
      case "bulleted_list_item":
      case "numbered_list_item":
        return `• ${richTextToPlain(block[block.type].rich_text)}`;
      case "code":
        return `\`\`\`${block.code.language}\n${richTextToPlain(block.code.rich_text)}\n\`\`\``;
      case "quote":
        return `> ${richTextToPlain(block.quote.rich_text)}`;
      case "callout":
        return `[${block.callout.icon?.emoji || "ℹ️"}] ${richTextToPlain(block.callout.rich_text)}`;
      case "toggle":
        return richTextToPlain(block.toggle.rich_text);
      case "child_page":
        return `[Page: ${block.child_page.title}]`;
      case "child_database":
        return `[Database: ${block.child_database.title}]`;
      // ... handle other block types
      default:
        return "";
    }
  }).filter(Boolean).join("\n\n");
}

// Extract structured data from database entries
function processDatabaseEntry(
  entry: NotionDatabaseEntry,
  schema: NotionDatabaseSchema
): ProcessedDatabaseEntry {
  const properties: Record<string, any> = {};

  for (const [key, prop] of Object.entries(entry.properties)) {
    switch (prop.type) {
      case "title":
        properties[key] = richTextToPlain(prop.title);
        break;
      case "rich_text":
        properties[key] = richTextToPlain(prop.rich_text);
        break;
      case "select":
        properties[key] = prop.select?.name;
        break;
      case "multi_select":
        properties[key] = prop.multi_select.map(s => s.name);
        break;
      case "date":
        properties[key] = prop.date?.start;
        break;
      case "people":
        properties[key] = prop.people.map(p => p.name || p.id);
        break;
      case "relation":
        properties[key] = prop.relation.map(r => r.id);
        break;
      // ... other property types
    }
  }

  return { id: entry.id, properties };
}
```

---

## Phase 4: GitHub Integration

**Goal**: Ingest GitHub PRs, issues, discussions, and key commits as knowledge items.

### 4.1 GitHub OAuth & App Setup

```typescript
// src/lib/effect/services/integrations/github-content.ts

export interface GitHubContentConfig {
  repositories: string[]; // owner/repo format
  syncPRs: boolean;
  syncIssues: boolean;
  syncDiscussions: boolean;
  syncCommits: boolean; // Only significant commits (merges, tagged)
  syncWiki: boolean;
  labelFilters: string[]; // Only sync items with these labels
  excludeLabels: string[]; // Exclude items with these labels
}

export interface GitHubContentAdapterService extends ContentSourceAdapter {
  // GitHub-specific
  listRepositories(sourceId: string): Effect.Effect<GitHubRepo[], ContentSourceError>;
  syncRepository(sourceId: string, repo: string, options?: SyncOptions): Effect.Effect<SyncResult, ContentSyncError>;
  getPR(sourceId: string, repo: string, prNumber: number): Effect.Effect<GitHubPR, ContentSourceError>;
  getIssue(sourceId: string, repo: string, issueNumber: number): Effect.Effect<GitHubIssue, ContentSourceError>;
  getDiscussion(sourceId: string, repo: string, discussionNumber: number): Effect.Effect<GitHubDiscussion, ContentSourceError>;

  // Code context
  getFileDiff(sourceId: string, repo: string, prNumber: number): Effect.Effect<FileDiff[], ContentSourceError>;
  getFileContent(sourceId: string, repo: string, path: string, ref?: string): Effect.Effect<string, ContentSourceError>;
}
```

### 4.2 GitHub Data Model

```sql
-- GitHub-specific metadata in content_items.metadata
-- For PRs:
-- {
--   "repo": "owner/repo",
--   "number": 123,
--   "state": "open" | "closed" | "merged",
--   "draft": false,
--   "base_branch": "main",
--   "head_branch": "feature/xyz",
--   "merge_commit_sha": "...",
--   "labels": ["enhancement", "needs-review"],
--   "assignees": ["user1", "user2"],
--   "reviewers": ["user3"],
--   "review_state": "approved" | "changes_requested" | "pending",
--   "files_changed": 5,
--   "additions": 100,
--   "deletions": 50,
--   "linked_issues": [456, 789],
--   "url": "https://github.com/..."
-- }

-- Track repository sync state
CREATE TABLE github_repo_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES content_sources(id),
  repo TEXT NOT NULL, -- owner/repo
  last_pr_number INTEGER,
  last_issue_number INTEGER,
  last_discussion_number INTEGER,
  last_commit_sha TEXT,
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(source_id, repo)
);

-- Cache file contents for code context
CREATE TABLE github_file_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES content_sources(id),
  repo TEXT NOT NULL,
  path TEXT NOT NULL,
  ref TEXT NOT NULL, -- branch/tag/sha
  content TEXT NOT NULL,
  language TEXT,
  fetched_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(source_id, repo, path, ref)
);
```

### 4.3 GitHub Processing

```typescript
// Process PR with full context
async function processGitHubPR(pr: GitHubPR, diff: FileDiff[]): Promise<ContentItem> {
  // Combine PR description with review comments and code context
  const content = [
    `# ${pr.title}`,
    "",
    pr.body,
    "",
    "## Files Changed",
    ...diff.map(f => `- \`${f.filename}\` (+${f.additions}/-${f.deletions})`),
    "",
    "## Review Comments",
    ...pr.reviewComments.map(c => `**${c.user}** on \`${c.path}\`:\n${c.body}`)
  ].join("\n");

  // Extract linked issues
  const linkedIssues = extractIssueReferences(pr.body);

  // AI processing
  const summary = await generateSummary(content, {
    context: "This is a GitHub pull request",
    extractFor: ["changes", "rationale", "review_feedback"]
  });

  const decisions = await extractDecisions(content);

  return {
    type: "github_pr",
    title: pr.title,
    content,
    summary,
    metadata: {
      ...pr,
      decisions,
      linkedIssues,
      codeContext: extractCodeContext(diff)
    }
  };
}

// Extract code context from diffs
function extractCodeContext(diffs: FileDiff[]): CodeContext {
  return {
    languages: [...new Set(diffs.map(d => detectLanguage(d.filename)))],
    components: extractComponentNames(diffs),
    functions: extractFunctionNames(diffs),
    imports: extractImports(diffs)
  };
}
```

---

## Phase 5: Unified Knowledge Graph

**Goal**: Build a rich knowledge graph connecting insights across all sources.

### 5.1 Enhanced Knowledge Graph Schema

```sql
-- Extend existing knowledge_nodes table
ALTER TABLE knowledge_nodes ADD COLUMN source_item_id UUID REFERENCES content_items(id);
ALTER TABLE knowledge_nodes ADD COLUMN confidence REAL DEFAULT 1.0;
ALTER TABLE knowledge_nodes ADD COLUMN extraction_method TEXT; -- 'explicit', 'ai_extracted', 'user_created'

-- Add new node types
-- Existing: person, topic, artifact, decision, video
-- New: slack_channel, notion_page, github_repo, code_component, meeting, project

-- Enhanced edges
ALTER TABLE knowledge_edges ADD COLUMN source_item_id UUID REFERENCES content_items(id);
ALTER TABLE knowledge_edges ADD COLUMN evidence JSONB DEFAULT '{}'; -- Supporting context

-- New relationship types
-- Existing: decided, mentioned, references, supersedes, related_to
-- New: discussed_in, documented_in, implemented_in, owned_by, worked_on,
--      derived_from, contributes_to, blocks, depends_on

-- Cross-source decision tracking
CREATE TABLE decision_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES decisions(id),
  content_item_id UUID NOT NULL REFERENCES content_items(id),
  evidence_type TEXT NOT NULL, -- 'origin', 'discussion', 'documentation', 'implementation', 'revision'
  excerpt TEXT, -- Relevant text excerpt
  timestamp_in_source TIMESTAMP,
  confidence REAL DEFAULT 1.0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Topic clusters across sources
CREATE TABLE topic_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  keywords TEXT[] DEFAULT '{}',
  embedding_centroid vector(1536), -- Cluster center
  content_count INTEGER DEFAULT 0,
  last_activity TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE topic_cluster_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID NOT NULL REFERENCES topic_clusters(id),
  content_item_id UUID NOT NULL REFERENCES content_items(id),
  similarity_score REAL NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(cluster_id, content_item_id)
);
```

### 5.2 Cross-Source Relationship Detection

```typescript
// src/lib/effect/services/knowledge/relationship-detector.ts

export interface RelationshipDetectorService {
  // Detect relationships between a new item and existing items
  detectRelationships(
    newItem: ContentItem,
    options?: DetectionOptions
  ): Effect.Effect<DetectedRelationship[], ProcessingError>;

  // Specific relationship types
  detectMentions(item: ContentItem): Effect.Effect<MentionRelationship[], ProcessingError>;
  detectReferences(item: ContentItem): Effect.Effect<ReferenceRelationship[], ProcessingError>;
  detectSemanticSimilarity(item: ContentItem, threshold?: number): Effect.Effect<SimilarityRelationship[], ProcessingError>;
  detectDecisionEvolution(decision: Decision): Effect.Effect<DecisionEvolution[], ProcessingError>;

  // Batch processing
  rebuildRelationships(organizationId: string): Effect.Effect<RebuildResult, ProcessingError>;
}

// Detection strategies
const relationshipStrategies = {
  // Explicit references (URLs, IDs, @mentions)
  explicit: async (item: ContentItem) => {
    const references = [];

    // GitHub PR/Issue references
    const githubRefs = item.content?.match(/(#\d+|https:\/\/github\.com\/[\w-]+\/[\w-]+\/(pull|issues)\/\d+)/g) || [];

    // Slack message links
    const slackRefs = item.content?.match(/https:\/\/[\w-]+\.slack\.com\/archives\/\w+\/p\d+/g) || [];

    // Notion page links
    const notionRefs = item.content?.match(/https:\/\/(www\.)?notion\.so\/[\w-]+/g) || [];

    // @user mentions
    const userMentions = item.content?.match(/@[\w-]+/g) || [];

    return references;
  },

  // Semantic similarity (embedding distance)
  semantic: async (item: ContentItem, candidates: ContentItem[]) => {
    if (!item.embeddingVector) return [];

    const similarities = await Promise.all(
      candidates.map(async (candidate) => ({
        candidate,
        similarity: cosineSimilarity(item.embeddingVector!, candidate.embeddingVector!)
      }))
    );

    return similarities
      .filter(s => s.similarity > 0.8) // High similarity threshold
      .map(s => ({
        targetId: s.candidate.id,
        type: "related",
        confidence: s.similarity
      }));
  },

  // Temporal proximity (items close in time are likely related)
  temporal: async (item: ContentItem, candidates: ContentItem[]) => {
    const itemTime = item.createdAtSource.getTime();
    const window = 24 * 60 * 60 * 1000; // 24 hours

    return candidates
      .filter(c => Math.abs(c.createdAtSource.getTime() - itemTime) < window)
      .map(c => ({
        targetId: c.id,
        type: "temporally_related",
        confidence: 1 - (Math.abs(c.createdAtSource.getTime() - itemTime) / window)
      }));
  },

  // Entity co-occurrence (same people, topics, projects)
  entityBased: async (item: ContentItem, candidates: ContentItem[]) => {
    const itemEntities = await extractEntities(item.content || "");

    return candidates
      .filter(async (c) => {
        const candidateEntities = await extractEntities(c.content || "");
        const overlap = intersection(itemEntities, candidateEntities);
        return overlap.length > 0;
      })
      .map(c => ({
        targetId: c.id,
        type: "shares_entities",
        confidence: 0.7
      }));
  }
};
```

### 5.3 Decision Lifecycle Tracking

```typescript
// Track how decisions evolve across sources
interface DecisionLifecycle {
  decision: Decision;
  stages: DecisionStage[];
  currentStatus: DecisionStatus;
  participants: Participant[];
  relatedContent: ContentItem[];
}

interface DecisionStage {
  stage: "proposed" | "discussed" | "decided" | "documented" | "implemented" | "revised";
  contentItem: ContentItem;
  timestamp: Date;
  excerpt: string;
  participants: string[];
}

// Example decision lifecycle:
// 1. Proposed in Slack: "Should we switch to PostgreSQL?"
// 2. Discussed in Meeting: [video timestamp 12:34]
// 3. Decided in Meeting: "We're going with PostgreSQL" [video timestamp 45:23]
// 4. Documented in Notion: "Database Migration Plan" page
// 5. Implemented in GitHub: PR #123 "Migrate to PostgreSQL"
// 6. Revised in Slack: "Rollback to MySQL for now due to X"
```

---

## Phase 6: Unified Search & Discovery

**Goal**: Enable powerful cross-source search and intelligent discovery.

### 6.1 Enhanced Search API

```typescript
// src/app/api/search/unified/route.ts

export async function POST(request: NextRequest) {
  const effect = Effect.gen(function* () {
    const auth = yield* Auth;
    const { user, organization } = yield* auth.getSession(request.headers);

    const body = yield* validateRequestBody(UnifiedSearchSchema, request);
    const search = yield* UnifiedSearchService;

    const results = yield* search.search({
      organizationId: organization.id,
      query: body.query,

      // Source filters
      sources: body.sources, // ['video', 'slack', 'notion', 'github']
      sourceIds: body.sourceIds, // Specific source instances

      // Content type filters
      contentTypes: body.contentTypes, // ['slack_thread', 'github_pr', ...]

      // Temporal filters
      dateRange: body.dateRange,

      // Entity filters
      participants: body.participants, // User IDs or names
      topics: body.topics, // Topic cluster IDs or names

      // Search mode
      mode: body.mode, // 'keyword', 'semantic', 'hybrid'

      // Grouping
      groupBy: body.groupBy, // 'source', 'topic', 'date', 'participant'

      // Pagination
      limit: body.limit,
      offset: body.offset
    });

    return results;
  });

  return handleEffectExit(await runApiEffect(effect));
}

// Response structure
interface UnifiedSearchResponse {
  results: SearchResult[];
  facets: {
    sources: { source: string; count: number }[];
    contentTypes: { type: string; count: number }[];
    participants: { name: string; userId?: string; count: number }[];
    topics: { name: string; clusterId: string; count: number }[];
    dateHistogram: { date: string; count: number }[];
  };
  relatedSearches: string[];
  totalCount: number;
  hasMore: boolean;
}

interface SearchResult {
  item: ContentItem;
  score: number;
  highlights: {
    field: string;
    snippet: string;
    positions: { start: number; end: number }[];
  }[];
  context: {
    relatedItems: ContentItem[]; // Nearby items in thread/page
    decisionContext?: Decision; // If part of decision lifecycle
    topicCluster?: TopicCluster;
  };
}
```

### 6.2 Intelligent Discovery Features

```typescript
// src/lib/effect/services/discovery/discovery-service.ts

export interface DiscoveryService {
  // "You might have missed" - recent relevant content
  getRecommendations(userId: string, options?: RecommendationOptions): Effect.Effect<Recommendation[]>;

  // Related content across sources
  getRelatedContent(itemId: string, options?: RelatedOptions): Effect.Effect<RelatedContent[]>;

  // Topic exploration
  getTopicOverview(topicClusterId: string): Effect.Effect<TopicOverview>;
  getTrendingTopics(orgId: string, timeRange?: TimeRange): Effect.Effect<TrendingTopic[]>;

  // Person-centric view
  getPersonActivity(orgId: string, personId: string): Effect.Effect<PersonActivity>;
  getPersonExpertise(orgId: string, personId: string): Effect.Effect<ExpertiseProfile>;

  // Decision tracking
  getActiveDecisions(orgId: string): Effect.Effect<ActiveDecision[]>;
  getDecisionTimeline(decisionId: string): Effect.Effect<DecisionTimeline>;

  // Knowledge gaps
  identifyGaps(orgId: string): Effect.Effect<KnowledgeGap[]>;

  // AI-powered Q&A
  askQuestion(orgId: string, question: string): Effect.Effect<AnswerWithSources>;
}

interface AnswerWithSources {
  answer: string;
  confidence: number;
  sources: {
    item: ContentItem;
    relevance: number;
    excerpt: string;
  }[];
  relatedQuestions: string[];
}
```

### 6.3 Real-time Knowledge Feed

```typescript
// src/app/api/feed/route.ts

// Real-time feed of knowledge activity
interface FeedItem {
  id: string;
  type: FeedItemType;
  timestamp: Date;

  // Content
  contentItem?: ContentItem;
  decision?: Decision;
  topicCluster?: TopicCluster;

  // Context
  reason: string; // "New discussion in #engineering", "Decision updated", etc.
  relatedTo?: {
    type: "topic" | "person" | "decision" | "project";
    id: string;
    name: string;
  };

  // Engagement
  participants: Participant[];
  activityLevel: "high" | "medium" | "low";
}

type FeedItemType =
  | "new_content"
  | "decision_proposed"
  | "decision_made"
  | "decision_revised"
  | "active_discussion"
  | "documentation_updated"
  | "implementation_merged"
  | "trending_topic";
```

---

## Phase 7: UI/UX Redesign

**Goal**: Transform the interface from video-centric to knowledge-hub-centric.

### 7.1 Navigation Restructure

```
Current:
┌─────────────────────────────────────┐
│ Logo  │ Videos │ Channels │ Profile │
└─────────────────────────────────────┘

Proposed:
┌──────────────────────────────────────────────────────────────┐
│ Logo  │ Feed │ Search │ Sources │ Topics │ Decisions │ ⚙️   │
└──────────────────────────────────────────────────────────────┘
         ↓      ↓         ↓          ↓         ↓
         │      │         │          │         └─ Decision tracking dashboard
         │      │         │          └─ Topic cluster exploration
         │      │         └─ Source management (Video, Slack, Notion, GitHub)
         │      └─ Unified search with filters
         └─ Personalized knowledge feed
```

### 7.2 Core Views

#### Knowledge Feed (Home)
```
┌─────────────────────────────────────────────────────────────┐
│ Knowledge Feed                              [Filter] [View] │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🔵 Active Discussion in #engineering                    │ │
│ │ "Database migration strategy"                           │ │
│ │ 12 messages • 5 participants • High activity           │ │
│ │ Related: PR #234, Meeting recording                    │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ✅ Decision Made                                        │ │
│ │ "Switching to PostgreSQL for analytics"                │ │
│ │ Decided in: Engineering Standup (video)                │ │
│ │ Documented in: Notion > Tech Decisions                 │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📝 New Documentation                                    │ │
│ │ "API Authentication Guide" updated                     │ │
│ │ Author: Jane Smith • 15 min ago                        │ │
│ │ Related topics: Authentication, API, Security          │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### Unified Search
```
┌─────────────────────────────────────────────────────────────┐
│ 🔍 [authentication flow implementation____________] [Search]│
├─────────────────────────────────────────────────────────────┤
│ Sources: [All ▼] [✓] Video [✓] Slack [✓] Notion [✓] GitHub │
│ Time: [Any time ▼]  People: [Anyone ▼]  Topics: [All ▼]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 📹 Meeting: Auth Implementation Discussion                  │
│    "We decided to use JWT with refresh tokens..."          │
│    Timestamp: 23:45 • 3 participants • Nov 15              │
│    [Decision] [3 related items]                            │
│                                                             │
│ 💬 Slack Thread: #backend                                   │
│    "Here's the auth flow diagram I mentioned..."           │
│    15 messages • Nov 14                                    │
│    [Implements decision from meeting]                      │
│                                                             │
│ 📄 Notion: Authentication Architecture                      │
│    "JWT-based authentication with rotating refresh..."     │
│    Last edited: Nov 16 by Jane                             │
│    [Official documentation]                                │
│                                                             │
│ 🔀 GitHub PR #234: Implement JWT Auth                       │
│    "Implements the auth flow as discussed..."              │
│    Merged Nov 18 • 12 files changed                        │
│    [Implementation complete]                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Content Source Management
```
┌─────────────────────────────────────────────────────────────┐
│ Knowledge Sources                          [+ Add Source]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 📹 Video Recordings                                         │
│    Status: Active • 234 videos • Last sync: Live           │
│    [Configure] [Sync Now]                                  │
│                                                             │
│ 💬 Slack - Acme Workspace                                   │
│    Status: Active • 12 channels • 5,432 messages          │
│    Syncing: #engineering, #product, #general...           │
│    Last sync: 2 min ago                                    │
│    [Configure] [Sync Now]                                  │
│                                                             │
│ 📄 Notion - Team Wiki                                       │
│    Status: Active • 156 pages • 3 databases               │
│    Syncing: Engineering/, Product/, Company/               │
│    Last sync: 15 min ago                                   │
│    [Configure] [Sync Now]                                  │
│                                                             │
│ 🐙 GitHub - acme/backend                                    │
│    Status: Active • 89 PRs • 234 issues                   │
│    Syncing: PRs, Issues, Discussions                      │
│    Last sync: 5 min ago                                    │
│    [Configure] [Sync Now]                                  │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ + Connect New Source                                    │ │
│ │   [Slack] [Notion] [GitHub] [Linear] [Confluence]      │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### Topic Explorer
```
┌─────────────────────────────────────────────────────────────┐
│ Topic: Authentication                              [Follow] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Overview                                                    │
│ ───────                                                     │
│ 45 knowledge items • 12 participants • Active this week   │
│                                                             │
│ Key Decisions                                               │
│ ─────────────                                               │
│ ✅ Use JWT with refresh tokens (Nov 15)                     │
│ ✅ 15-minute access token expiry (Nov 15)                   │
│ 🔄 Consider OAuth2 for third-party apps (Proposed Nov 20) │
│                                                             │
│ Recent Activity                                             │
│ ───────────────                                             │
│ 📹 Auth discussion in Engineering Standup                   │
│ 💬 Implementation questions in #backend                     │
│ 🔀 PR #234 merged: JWT implementation                       │
│ 📄 Auth Architecture doc updated                           │
│                                                             │
│ Key People                                                  │
│ ──────────                                                  │
│ 👤 Jane Smith (12 contributions) - Primary expert          │
│ 👤 Bob Jones (8 contributions)                             │
│ 👤 Alice Chen (5 contributions)                            │
│                                                             │
│ Related Topics                                              │
│ ──────────────                                              │
│ [Security] [API Design] [User Management] [OAuth]          │
└─────────────────────────────────────────────────────────────┘
```

#### Decision Dashboard
```
┌─────────────────────────────────────────────────────────────┐
│ Decision Tracker                      [+ Log Decision]     │
├─────────────────────────────────────────────────────────────┤
│ Filter: [All ▼] [Active] [Proposed] [Implemented]          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 🟡 PROPOSED                                                 │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Migrate to Kubernetes                                   │ │
│ │ Proposed: Nov 18 in #infrastructure                     │ │
│ │ Participants: DevOps team                               │ │
│ │ Next: Scheduled for discussion in Infra Standup        │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ 🟢 DECIDED - Pending Implementation                         │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Switch to PostgreSQL                                    │ │
│ │ Decided: Nov 15 in Engineering Standup                  │ │
│ │ Owner: Jane Smith                                       │ │
│ │ Progress: PR #234 in review                            │ │
│ │ [View full timeline]                                    │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ✅ IMPLEMENTED                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ JWT Authentication                                      │ │
│ │ Decided: Nov 10 • Implemented: Nov 18                   │ │
│ │ PR #220 merged • Documented in Notion                   │ │
│ │ [View full timeline]                                    │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 7.3 Component Updates

```
New Components Needed:
├── ContentSourceCard - Display source status and controls
├── UnifiedSearchBar - Multi-source search with filters
├── KnowledgeFeedItem - Polymorphic feed item display
├── TopicClusterCard - Topic overview and navigation
├── DecisionTimelineView - Visual decision lifecycle
├── CrossSourceRelationship - Show item relationships
├── SourceTypeIcon - Consistent iconography per source
├── ContentItemPreview - Quick preview modal
└── KnowledgeGraphVisualization - Interactive graph view

Modified Components:
├── VideoCard → ContentCard (generalized)
├── VideoPlayer → ContentViewer (supports multiple types)
├── TranscriptView → ContentDetailView (type-aware)
├── ChannelList → SourceList (all sources)
└── SearchResults → UnifiedSearchResults
```

---

## Phase 8: AI Capabilities Enhancement

**Goal**: Leverage multi-source data for advanced AI features.

### 8.1 Cross-Source Q&A

```typescript
// AI-powered question answering across all sources
interface KnowledgeQA {
  askQuestion(
    orgId: string,
    question: string,
    options?: QAOptions
  ): Effect.Effect<QAResponse>;
}

interface QAResponse {
  answer: string;
  confidence: number;
  reasoning: string;
  sources: {
    item: ContentItem;
    excerpt: string;
    relevance: number;
  }[];
  followUpQuestions: string[];
  uncertainties: string[]; // Areas where knowledge is incomplete
}

// Example usage:
// Q: "What was decided about the database migration?"
// A: "The team decided to migrate from MySQL to PostgreSQL on Nov 15.
//     The decision was made during the Engineering Standup meeting,
//     documented in the 'Database Migration Plan' Notion page, and
//     implementation began with PR #234. Jane Smith is leading the effort."
//
// Sources:
// - [Video] Engineering Standup Nov 15 @ 23:45
// - [Slack] #backend thread on Nov 14
// - [Notion] Database Migration Plan
// - [GitHub] PR #234
```

### 8.2 Knowledge Gap Detection

```typescript
interface KnowledgeGapDetector {
  // Find topics that are discussed but not documented
  findUndocumentedTopics(orgId: string): Effect.Effect<UndocumentedTopic[]>;

  // Find decisions that lack implementation evidence
  findUnimplementedDecisions(orgId: string): Effect.Effect<UnimplementedDecision[]>;

  // Find outdated documentation
  findStaleDocumentation(orgId: string): Effect.Effect<StaleDoc[]>;

  // Find knowledge silos (info only one person has)
  findKnowledgeSilos(orgId: string): Effect.Effect<KnowledgeSilo[]>;
}

// Proactive notifications:
// "The 'Authentication' topic has 15 Slack discussions but no Notion documentation"
// "Decision 'Migrate to K8s' was made 30 days ago but has no implementation PRs"
// "The API Guide was last updated 90 days ago but there have been 12 related PRs since"
// "Only Jane has contributed to 'Payment Processing' - consider knowledge sharing"
```

### 8.3 Smart Summaries

```typescript
// Generate contextual summaries across sources
interface SmartSummaryService {
  // Daily/weekly digest
  generateDigest(
    orgId: string,
    userId: string,
    period: "daily" | "weekly"
  ): Effect.Effect<Digest>;

  // Topic summary
  summarizeTopic(
    orgId: string,
    topicId: string,
    options?: SummaryOptions
  ): Effect.Effect<TopicSummary>;

  // Meeting prep
  generateMeetingPrep(
    orgId: string,
    participants: string[],
    topics: string[]
  ): Effect.Effect<MeetingPrep>;

  // Onboarding summary
  generateOnboardingSummary(
    orgId: string,
    role: string,
    team: string
  ): Effect.Effect<OnboardingSummary>;
}
```

---

## Implementation Roadmap

### Milestone 1: Foundation (4-6 weeks)
- [ ] Design and implement content source abstraction layer
- [ ] Create `content_items`, `content_sources`, `content_chunks` tables
- [ ] Migrate existing videos to new schema
- [ ] Build unified `ContentRepository` service
- [ ] Create content processing pipeline abstraction
- [ ] Update existing video processing to use new pipeline

### Milestone 2: Slack Integration (3-4 weeks)
- [ ] Extend Slack OAuth for content access scopes
- [ ] Build `SlackContentAdapter` implementing `ContentSourceAdapter`
- [ ] Implement channel sync and incremental updates
- [ ] Set up Slack event webhooks for real-time updates
- [ ] Build thread aggregation logic
- [ ] Create Slack-specific UI components

### Milestone 3: Notion Integration (3-4 weeks)
- [ ] Implement Notion OAuth flow
- [ ] Build `NotionContentAdapter`
- [ ] Implement page/database sync with hierarchy tracking
- [ ] Build Notion block-to-text conversion
- [ ] Set up Notion webhooks (if available) or polling
- [ ] Create Notion-specific UI components

### Milestone 4: GitHub Integration (3-4 weeks)
- [ ] Implement GitHub OAuth/App setup
- [ ] Build `GitHubContentAdapter`
- [ ] Implement PR/Issue/Discussion sync
- [ ] Build code context extraction
- [ ] Set up GitHub webhooks
- [ ] Create GitHub-specific UI components

### Milestone 5: Knowledge Graph Enhancement (3-4 weeks)
- [ ] Enhance knowledge graph schema for multi-source
- [ ] Build cross-source relationship detection
- [ ] Implement decision lifecycle tracking
- [ ] Create topic clustering algorithm
- [ ] Build knowledge graph visualization

### Milestone 6: Unified Search & Discovery (3-4 weeks)
- [ ] Build unified search API with facets
- [ ] Implement hybrid search across all content
- [ ] Build knowledge feed service
- [ ] Create recommendation engine
- [ ] Implement Q&A system

### Milestone 7: UI Redesign (4-6 weeks)
- [ ] Redesign navigation structure
- [ ] Build Knowledge Feed view
- [ ] Build unified Search view
- [ ] Build Source Management view
- [ ] Build Topic Explorer view
- [ ] Build Decision Dashboard view
- [ ] Update all existing components

### Milestone 8: AI Enhancement (2-3 weeks)
- [ ] Build cross-source Q&A system
- [ ] Implement knowledge gap detection
- [ ] Create smart summary generation
- [ ] Build digest system

---

## Technical Considerations

### Performance

1. **Embedding Storage**: pgvector with HNSW indexing handles similarity search efficiently up to ~10M vectors. Beyond that, consider dedicated vector DB (Pinecone, Weaviate).

2. **Incremental Sync**: All sources use cursor-based incremental sync to avoid re-processing entire history.

3. **Background Processing**: Leverage existing Vercel Workflow infrastructure for durable async processing.

4. **Caching**: Add Redis/Upstash for:
   - Search result caching
   - Topic cluster caching
   - User feed caching

### Scalability

1. **Content Volume Projections**:
   - Videos: ~100/month/org (existing)
   - Slack: ~10,000 messages/month/org
   - Notion: ~500 pages/org
   - GitHub: ~200 PRs/month/org
   - Total chunks: ~500,000/year/org

2. **Database Partitioning**: Consider partitioning `content_items` by `organization_id` and `created_at` for large orgs.

3. **Queue Management**: May need dedicated queue (BullMQ, Inngest) for sync operations at scale.

### Security & Privacy

1. **OAuth Scope Management**: Request minimal scopes, document clearly what data is accessed.

2. **Data Retention**: Allow per-source retention policies.

3. **Access Control**: Inherit permissions from source systems where possible.

4. **Audit Trail**: Log all sync operations and data access.

### Billing Implications

1. **New Usage Metrics**:
   - Content items synced
   - Knowledge sources connected
   - AI queries/month
   - Search queries/month

2. **Plan Differentiation**:
   - Free: Video only, limited sources
   - Pro: All sources, 3 integrations
   - Enterprise: Unlimited sources, advanced AI

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| API rate limits (Slack/Notion/GitHub) | High | Medium | Implement backoff, caching, batch operations |
| OAuth token management complexity | Medium | High | Robust token refresh, monitoring, user alerts |
| Data volume overwhelms processing | Medium | High | Prioritization, sampling for large histories |
| Cross-source relationship accuracy | Medium | Medium | Confidence scoring, user feedback loop |
| User adoption of new paradigm | Medium | High | Gradual rollout, clear onboarding, quick wins |
| Competitive pressure | Medium | Medium | Focus on unique cross-source intelligence |

---

## Success Metrics

### Adoption Metrics
- Connected sources per organization
- Content items ingested
- Daily active users
- Search queries per user

### Engagement Metrics
- Cross-source searches (queries touching 2+ sources)
- Decision tracking usage
- Topic exploration depth
- AI Q&A usage

### Value Metrics
- Time to find information (survey)
- Knowledge discovery rate (found something didn't know existed)
- Decision lifecycle completeness
- Documentation coverage improvement

---

## Competitive Positioning

### Direct Competitors
- **Guru**: Knowledge management, but manual curation
- **Tettra**: Wiki + Slack integration, but not video
- **Notion**: Great for docs, but not multi-source aggregation
- **Loom**: Video-focused, limited integrations

### Unique Value Proposition
"Nuclom is the only platform that automatically connects your meeting discussions, team chats, documentation, and code changes into a unified, searchable knowledge graph - so decisions never get lost and context is always at your fingertips."

---

## Next Steps

1. **Validate Strategy**: Review this plan with stakeholders
2. **Technical Spike**: Prototype content abstraction layer
3. **User Research**: Interview users about knowledge management pain points
4. **Prioritization**: Determine which source to add first (recommend Slack)
5. **Resource Planning**: Assess team capacity for parallel workstreams
