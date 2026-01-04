-- Migration: Enable pgvector and add transcript chunks for semantic search
-- This migration adds vector-based semantic search capabilities

-- Enable the pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create transcript_chunks table for storing embeddings of transcript segments
-- Each video's transcript is chunked into ~500 token segments for better semantic search
CREATE TABLE transcript_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  token_count INTEGER,
  timestamp_start INTEGER, -- seconds into video
  timestamp_end INTEGER,   -- seconds into video
  speakers TEXT[],         -- speaker names if available from diarization
  embedding vector(1536),  -- OpenAI text-embedding-3-small dimension
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,

  -- Ensure unique chunk index per video
  CONSTRAINT transcript_chunks_unique_index UNIQUE (video_id, chunk_index)
);

-- Create HNSW index for fast approximate nearest neighbor search
-- HNSW (Hierarchical Navigable Small World) provides excellent performance for high-dimensional vectors
CREATE INDEX transcript_chunks_embedding_idx
  ON transcript_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Create indexes for filtering and lookup
CREATE INDEX transcript_chunks_video_idx ON transcript_chunks(video_id);
CREATE INDEX transcript_chunks_org_idx ON transcript_chunks(organization_id);
CREATE INDEX transcript_chunks_created_idx ON transcript_chunks(created_at);

-- Add vector embedding column to decisions table (migrate from JSONB to vector)
-- First add the new vector column
ALTER TABLE decisions ADD COLUMN embedding_vector vector(1536);

-- Migrate existing JSONB embeddings to vector format
UPDATE decisions
SET embedding_vector = embedding::text::vector
WHERE embedding IS NOT NULL
  AND jsonb_array_length(embedding) = 1536;

-- Add vector embedding column to knowledge_nodes table
ALTER TABLE knowledge_nodes ADD COLUMN embedding_vector vector(1536);

-- Migrate existing JSONB embeddings to vector format
UPDATE knowledge_nodes
SET embedding_vector = embedding::text::vector
WHERE embedding IS NOT NULL
  AND jsonb_array_length(embedding) = 1536;

-- Create HNSW indexes for decisions and knowledge_nodes
CREATE INDEX decisions_embedding_idx
  ON decisions
  USING hnsw (embedding_vector vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX knowledge_nodes_embedding_idx
  ON knowledge_nodes
  USING hnsw (embedding_vector vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Create a helper function for semantic search across all content types
CREATE OR REPLACE FUNCTION semantic_search(
  query_embedding vector(1536),
  org_id TEXT,
  similarity_threshold FLOAT DEFAULT 0.7,
  max_results INTEGER DEFAULT 20
)
RETURNS TABLE (
  content_type TEXT,
  content_id TEXT,
  video_id TEXT,
  similarity FLOAT,
  text_preview TEXT,
  timestamp_start INTEGER,
  timestamp_end INTEGER
) AS $$
BEGIN
  RETURN QUERY
  -- Search transcript chunks
  SELECT
    'transcript_chunk'::TEXT as content_type,
    tc.id::TEXT as content_id,
    tc.video_id::TEXT,
    1 - (tc.embedding <=> query_embedding) as similarity,
    LEFT(tc.text, 500) as text_preview,
    tc.timestamp_start,
    tc.timestamp_end
  FROM transcript_chunks tc
  WHERE tc.organization_id = org_id
    AND tc.embedding IS NOT NULL
    AND 1 - (tc.embedding <=> query_embedding) >= similarity_threshold

  UNION ALL

  -- Search decisions
  SELECT
    'decision'::TEXT as content_type,
    d.id::TEXT as content_id,
    d.video_id::TEXT,
    1 - (d.embedding_vector <=> query_embedding) as similarity,
    LEFT(d.summary, 500) as text_preview,
    d.timestamp_start,
    d.timestamp_end
  FROM decisions d
  WHERE d.organization_id = org_id
    AND d.embedding_vector IS NOT NULL
    AND 1 - (d.embedding_vector <=> query_embedding) >= similarity_threshold

  ORDER BY similarity DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create a function to find similar videos based on transcript embeddings
CREATE OR REPLACE FUNCTION find_similar_videos(
  source_video_id TEXT,
  org_id TEXT,
  max_results INTEGER DEFAULT 5
)
RETURNS TABLE (
  video_id TEXT,
  similarity FLOAT,
  matching_chunks INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH source_embeddings AS (
    SELECT embedding
    FROM transcript_chunks
    WHERE video_id = source_video_id
      AND embedding IS NOT NULL
  ),
  chunk_similarities AS (
    SELECT
      tc.video_id,
      MAX(1 - (tc.embedding <=> se.embedding)) as max_similarity
    FROM transcript_chunks tc
    CROSS JOIN source_embeddings se
    WHERE tc.organization_id = org_id
      AND tc.video_id != source_video_id
      AND tc.embedding IS NOT NULL
    GROUP BY tc.video_id, tc.id
  )
  SELECT
    cs.video_id,
    AVG(cs.max_similarity)::FLOAT as similarity,
    COUNT(*)::INTEGER as matching_chunks
  FROM chunk_similarities cs
  GROUP BY cs.video_id
  HAVING AVG(cs.max_similarity) > 0.7
  ORDER BY similarity DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comment for documentation
COMMENT ON TABLE transcript_chunks IS 'Stores chunked transcript segments with vector embeddings for semantic search';
COMMENT ON FUNCTION semantic_search IS 'Performs semantic similarity search across transcript chunks and decisions';
COMMENT ON FUNCTION find_similar_videos IS 'Finds videos with similar content based on transcript embeddings';
