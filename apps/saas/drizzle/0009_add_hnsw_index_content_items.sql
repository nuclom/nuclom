-- Add HNSW index for efficient vector similarity search on content_items
-- Note: For existing production databases with large datasets, consider running
-- this index creation manually with CONCURRENTLY to avoid table locks

CREATE INDEX "content_items_embedding_hnsw_idx"
  ON "content_items" USING hnsw (embedding_vector vector_cosine_ops);
