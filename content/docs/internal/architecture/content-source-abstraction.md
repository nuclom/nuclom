# Content Source Abstraction Layer

This document describes the unified content source abstraction layer that enables Nuclom to ingest and process content from multiple sources (videos, Slack, Notion, GitHub, etc.) into a unified knowledge base.

## Overview

The content source abstraction layer provides:

1. **Unified content model**: All content from various sources is normalized to a common `ContentItem` structure
2. **Pluggable adapters**: Each content source (Slack, Notion, etc.) implements the `ContentSourceAdapter` interface
3. **Processing pipeline**: Content items flow through a processing pipeline for summarization, embedding generation, and relationship extraction
4. **Relationship tracking**: Content items can be linked with typed relationships (references, replies_to, etc.)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Content Processor                         │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐    │
│  │   Video   │  │   Slack   │  │  Notion   │  │  GitHub   │    │
│  │  Adapter  │  │  Adapter  │  │  Adapter  │  │  Adapter  │    │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘    │
│        │              │              │              │           │
│        └──────────────┴──────────────┴──────────────┘           │
│                              │                                   │
│                    ┌─────────▼─────────┐                        │
│                    │ Content Repository │                        │
│                    └─────────┬─────────┘                        │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │     PostgreSQL      │
                    │  ┌───────────────┐  │
                    │  │content_sources│  │
                    │  │content_items  │  │
                    │  │content_chunks │  │
                    │  │content_rel... │  │
                    │  │content_part...│  │
                    │  └───────────────┘  │
                    └─────────────────────┘
```

## Database Schema

### content_sources

Represents a connection to an external content source.

| Column | Type | Description |
|--------|------|-------------|
| id | text | Primary key |
| organization_id | text | FK to organizations |
| type | ContentSourceType | Source type (video, slack, notion, etc.) |
| name | text | Display name |
| config | jsonb | Configuration (sync settings, filters) |
| credentials | jsonb | Encrypted credentials (OAuth tokens, API keys) |
| sync_status | ContentSourceSyncStatus | idle, syncing, error, disabled |
| last_sync_at | timestamp | Last successful sync |
| error_message | text | Last error message |

### content_items

Unified content atoms from all sources.

| Column | Type | Description |
|--------|------|-------------|
| id | text | Primary key |
| organization_id | text | FK to organizations |
| source_id | text | FK to content_sources |
| type | ContentItemType | Content type (video, message, document, etc.) |
| external_id | text | ID in the source system |
| title | text | Content title |
| content | text | Normalized text content |
| content_html | text | Original rich content |
| author_id | text | FK to users (if linked) |
| author_external | text | External author ID |
| author_name | text | Author display name |
| created_at_source | timestamp | Original creation time |
| metadata | jsonb | Source-specific metadata |
| tags | jsonb | Content tags |
| processing_status | ContentProcessingStatus | pending, processing, completed, failed |
| summary | text | AI-generated summary |
| key_points | jsonb | Extracted key points |
| sentiment | text | Sentiment analysis result |
| embedding_vector | vector(1536) | Embedding for semantic search |
| search_text | text | Concatenated text for full-text search |

### content_chunks

Chunked content for semantic search on long content.

| Column | Type | Description |
|--------|------|-------------|
| id | text | Primary key |
| content_item_id | text | FK to content_items |
| chunk_index | integer | Chunk position |
| content | text | Chunk text |
| embedding_vector | vector(1536) | Chunk embedding |
| start_offset | integer | Character offset in source |
| timestamp_start | integer | Start time (for video/audio) |
| timestamp_end | integer | End time |

### content_relationships

Explicit links between content items.

| Column | Type | Description |
|--------|------|-------------|
| id | text | Primary key |
| source_item_id | text | FK to content_items |
| target_item_id | text | FK to content_items |
| relationship_type | ContentRelationshipType | Type of relationship |
| confidence | real | AI confidence score (0-1) |
| metadata | jsonb | Additional relationship data |

### content_participants

People involved in content.

| Column | Type | Description |
|--------|------|-------------|
| id | text | Primary key |
| content_item_id | text | FK to content_items |
| user_id | text | FK to users (if linked) |
| external_id | text | External user ID |
| name | text | Display name |
| email | text | Email address |
| role | ContentParticipantRole | author, speaker, participant, etc. |

## Content Source Types

| Type | Description |
|------|-------------|
| video | Native video recordings (internal) |
| slack | Slack workspace messages and threads |
| notion | Notion pages and databases |
| github | GitHub issues, PRs, discussions |
| google_drive | Google Drive files |
| confluence | Confluence wiki pages |
| linear | Linear issues and projects |

## Content Item Types

| Type | Description |
|------|-------------|
| video | Video recording |
| message | Chat message |
| thread | Conversation thread |
| document | Document or page |
| issue | Issue or ticket |
| pull_request | Code review / PR |
| comment | Comment on any content |
| file | File attachment |

## Relationship Types

| Type | Description |
|------|-------------|
| references | One item references another |
| replies_to | Reply/response relationship |
| implements | Implementation of a decision/issue |
| supersedes | Replaces a previous item |
| relates_to | Generic relationship |
| mentions | Mentions another item |
| derived_from | Derived/summarized from another item |

## Services

### ContentRepository

Provides CRUD operations for content sources, items, relationships, and participants.

```typescript
import { ContentRepository, createContentSource, getContentItems } from '@nuclom/lib/effect/services/content';

// Create a content source
const source = yield* createContentSource({
  organizationId: 'org-123',
  type: 'slack',
  name: 'Engineering Slack',
  credentials: { accessToken: '...' },
});

// Query content items
const items = yield* getContentItems({
  organizationId: 'org-123',
  type: 'message',
  processingStatus: 'completed',
}, { limit: 50 });
```

### ContentProcessor

Orchestrates content ingestion and processing.

```typescript
import { ContentProcessor, syncContentSource, registerContentAdapter } from '@nuclom/lib/effect/services/content';

// Register an adapter
yield* registerContentAdapter(slackAdapter);

// Sync content from a source
const progress = yield* syncContentSource(source.id, {
  since: new Date('2024-01-01'),
});
```

### ContentSourceAdapter Interface

Each content source implements this interface:

```typescript
interface ContentSourceAdapter {
  readonly sourceType: ContentSourceType;

  validateCredentials(source: ContentSource): Effect.Effect<boolean, ContentSourceAuthError>;

  fetchContent(
    source: ContentSource,
    options?: AdapterFetchOptions,
  ): Effect.Effect<AdapterFetchResult, ContentSourceSyncError>;

  fetchItem(
    source: ContentSource,
    externalId: string,
  ): Effect.Effect<RawContentItem | null, ContentSourceSyncError>;

  refreshAuth?(source: ContentSource): Effect.Effect<TokenResponse, ContentSourceAuthError>;
}
```

## Video Content Adapter

The video content adapter is the "internal" adapter that exposes existing Nuclom videos as content items. Unlike external adapters, it reads directly from the videos table.

```typescript
import {
  createVideoContentAdapter,
  ensureVideoContentSource,
  migrateOrganizationVideos,
} from '@nuclom/lib/effect/services/content';

// Ensure a video source exists for the org
const source = yield* ensureVideoContentSource(organizationId);

// Migrate existing videos
const result = yield* migrateOrganizationVideos(organizationId);
```

## Processing Pipeline

1. **Sync**: Adapter fetches content from source
2. **Normalize**: Raw content is converted to `ContentItem` format
3. **Store**: Items are upserted to the database
4. **Process** (async):
   - Generate summary
   - Extract key points
   - Analyze sentiment
   - Generate embedding
   - Extract relationships

## Error Handling

The content services use Effect-TS tagged errors:

| Error | Description |
|-------|-------------|
| ContentSourceNotFoundError | Source with given ID not found |
| ContentSourceSyncError | Sync operation failed |
| ContentSourceAuthError | Authentication failed |
| ContentItemNotFoundError | Item with given ID not found |
| ContentProcessingError | Processing pipeline failed |
| ContentAdapterNotFoundError | No adapter for source type |

## Migration Guide

To migrate existing videos to the content system:

```typescript
import { migrateAllVideos } from '@nuclom/lib/effect/services/content';

// Migrate all organizations
const result = await Effect.runPromise(
  Effect.provide(migrateAllVideos(), AppLive)
);

console.log(`Migrated ${result.totalVideosProcessed} videos`);
```

## Adding a New Adapter

1. Create a new adapter file in `packages/lib/src/effect/services/content/`
2. Implement the `ContentSourceAdapter` interface
3. Register the adapter with the `ContentProcessor`
4. Add any necessary OAuth/webhook handling

Example adapter skeleton:

```typescript
export const createSlackAdapter = (): ContentSourceAdapter => ({
  sourceType: 'slack',

  validateCredentials: (source) =>
    Effect.gen(function* () {
      // Validate OAuth token
      return true;
    }),

  fetchContent: (source, options) =>
    Effect.gen(function* () {
      // Fetch messages from Slack API
      return { items: [], hasMore: false };
    }),

  fetchItem: (source, externalId) =>
    Effect.gen(function* () {
      // Fetch single message
      return null;
    }),

  refreshAuth: (source) =>
    Effect.gen(function* () {
      // Refresh OAuth token
      return { accessToken: '...', refreshToken: '...' };
    }),
});
```
