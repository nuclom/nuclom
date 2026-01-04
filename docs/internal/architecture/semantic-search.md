# Semantic Search Architecture

This document describes the semantic search capabilities in Nuclom, enabling teams to find content by meaning rather than exact keyword matches.

## Overview

Semantic search uses vector embeddings to find content that is conceptually similar to a query, even when the exact words don't match. For example, searching for "database scaling discussions" will find videos mentioning "PostgreSQL performance", "sharding", "read replicas", etc.

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Search Flow                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  User Query ─────► Embedding ─────► Vector Search           │
│      │             Service          (pgvector)               │
│      │                                  │                    │
│      │                                  ▼                    │
│      └────────────────────────────► Full-text ◄───┐         │
│                                     Search        │         │
│                                        │          │         │
│                                        ▼          │         │
│                                   Hybrid Merge ───┘         │
│                                        │                    │
│                                        ▼                    │
│                                   Ranked Results            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema

#### transcript_chunks Table
Stores chunked transcript segments with vector embeddings:

```sql
CREATE TABLE transcript_chunks (
  id UUID PRIMARY KEY,
  video_id TEXT REFERENCES videos(id),
  organization_id TEXT REFERENCES organizations(id),
  chunk_index INTEGER,
  text TEXT NOT NULL,
  token_count INTEGER,
  timestamp_start INTEGER,  -- seconds into video
  timestamp_end INTEGER,
  speakers TEXT[],
  embedding vector(1536),   -- OpenAI text-embedding-3-small
  created_at TIMESTAMP
);
```

#### Vector Indexes
HNSW indexes for fast approximate nearest neighbor search:

```sql
CREATE INDEX transcript_chunks_embedding_idx
  ON transcript_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

### Embedding Pipeline

1. **Chunking**: Transcripts are split into ~500 token chunks with overlap
2. **Embedding Generation**: OpenAI `text-embedding-3-small` (1536 dimensions)
3. **Storage**: Embeddings stored as `vector(1536)` in PostgreSQL with pgvector
4. **Indexing**: HNSW index for sub-linear search time

## API Endpoints

### Semantic Search
```http
POST /api/search/semantic
{
  "query": "discussions about database scaling",
  "organizationId": "org_123",
  "limit": 20,
  "threshold": 0.7,
  "contentTypes": ["transcript_chunk", "decision"]
}
```

### Hybrid Search
Combines semantic and keyword search with configurable weights:

```http
POST /api/search/hybrid
{
  "query": "PostgreSQL performance",
  "organizationId": "org_123",
  "semanticWeight": 0.5,  // 0-1, default 0.5
  "semanticThreshold": 0.6
}
```

### Similar Videos
Find videos with similar content:

```http
GET /api/videos/{videoId}/similar?limit=5&threshold=0.7
```

### Generate Embeddings
Trigger embedding generation for a video:

```http
POST /api/videos/{videoId}/embeddings
```

## Services

### Embedding Service
`src/lib/effect/services/embedding.ts`

```typescript
interface EmbeddingServiceInterface {
  generateEmbedding(text: string): Effect<readonly number[], AIServiceError>;
  generateEmbeddings(texts: readonly string[]): Effect<readonly number[][], AIServiceError>;
  chunkTranscript(transcript: string, segments?: TranscriptSegment[]): Effect<TextChunk[], never>;
  processTranscript(transcript: string, segments?: TranscriptSegment[]): Effect<ChunkEmbedding[], AIServiceError>;
}
```

### Semantic Search Repository
`src/lib/effect/services/semantic-search-repository.ts`

```typescript
interface SemanticSearchRepositoryService {
  saveTranscriptChunks(videoId: string, organizationId: string, chunks: ChunkEmbedding[]): Effect<TranscriptChunk[], DatabaseError>;
  semanticSearch(params: SemanticSearchParams): Effect<SemanticSearchResult[], DatabaseError>;
  findSimilarVideos(params: SimilarVideosParams): Effect<SimilarVideoResult[], DatabaseError>;
}
```

## Search Types

### Pure Semantic Search
Best for conceptual queries:
- "discussions about authentication"
- "how we handle error handling"
- "performance optimization strategies"

### Pure Keyword Search
Best for exact term searches:
- Specific error messages
- Code snippets
- Exact phrases

### Hybrid Search
Best for most use cases - combines both approaches:
- Natural language questions
- Technical topic exploration
- Documentation search

## Configuration

### Similarity Threshold
Default: 0.7 (70% similarity)
- Higher = More relevant but fewer results
- Lower = More results but less precise

### Semantic Weight (Hybrid Search)
Default: 0.5 (50/50 blend)
- 1.0 = Pure semantic
- 0.0 = Pure keyword

## Chunking Strategy

Transcripts are chunked using an overlapping window approach:
- **Max tokens**: 500 per chunk
- **Overlap**: 50 tokens between chunks
- **Segment-aware**: Uses transcript segments when available for accurate timestamps

## Integration Points

### Video Processing
Embeddings are generated automatically when:
- A video transcript is completed
- Manual trigger via `/api/videos/{videoId}/embeddings`

### Knowledge Graph
Decisions table has embedding fields for semantic search across decisions:
- `decisions.embedding_vector` - vector(1536)
- `knowledge_nodes.embedding_vector` - vector(1536)

### Decision Extraction
When decisions are extracted from videos, embeddings can be generated for semantic retrieval of organizational decisions.

## Performance Considerations

### Index Configuration
HNSW parameters for ~1M vectors:
- `m = 16` - connections per node (balance of recall vs speed)
- `ef_construction = 64` - construction time quality

### Query Optimization
- Vector similarity uses cosine distance
- Combined with filtering on organization_id for multi-tenancy
- Results limited by threshold before final ranking

### Backfill
For existing videos without embeddings:
```bash
# API endpoint to get videos needing embeddings
GET /api/videos/embeddings/pending?organizationId=org_123

# Process each video
POST /api/videos/{videoId}/embeddings
```

## Future Enhancements

1. **Topic Clustering**: Group videos by semantic similarity
2. **Auto-tagging**: Generate tags from embedding clusters
3. **Cross-video Q&A**: Answer questions across all team videos
4. **Timeline Search**: Find specific moments by semantic query
