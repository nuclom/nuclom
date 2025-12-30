-- Migration: Add full-text search support
-- Description: Adds PostgreSQL full-text search capabilities for videos

-- Add tsvector column for full-text search on videos
ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;

--> statement-breakpoint
-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS "videos_search_vector_idx" ON "videos" USING GIN("search_vector");

--> statement-breakpoint
-- Create function to update search vector
CREATE OR REPLACE FUNCTION update_videos_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.transcript, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.ai_summary, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

--> statement-breakpoint
-- Create trigger to auto-update search vector on insert/update
DROP TRIGGER IF EXISTS videos_search_vector_trigger ON "videos";
CREATE TRIGGER videos_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, description, transcript, ai_summary
  ON "videos"
  FOR EACH ROW
  EXECUTE FUNCTION update_videos_search_vector();

--> statement-breakpoint
-- Update existing videos with search vectors
UPDATE "videos" SET
  search_vector =
    setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(transcript, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(ai_summary, '')), 'D')
WHERE search_vector IS NULL;

--> statement-breakpoint
-- Create search history table
CREATE TABLE IF NOT EXISTS "search_history" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "query" text NOT NULL,
  "filters" jsonb,
  "results_count" integer DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
-- Create index on search history for fast lookups
CREATE INDEX IF NOT EXISTS "search_history_user_org_idx" ON "search_history"("user_id", "organization_id", "created_at" DESC);

--> statement-breakpoint
-- Create saved searches table
CREATE TABLE IF NOT EXISTS "saved_searches" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "query" text NOT NULL,
  "filters" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "saved_searches_user_name_unique" UNIQUE("user_id", "organization_id", "name")
);

--> statement-breakpoint
-- Create index on saved searches
CREATE INDEX IF NOT EXISTS "saved_searches_user_org_idx" ON "saved_searches"("user_id", "organization_id");

--> statement-breakpoint
-- Add indexes for common search filters on videos
CREATE INDEX IF NOT EXISTS "videos_organization_created_idx" ON "videos"("organization_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "videos_author_id_idx" ON "videos"("author_id");
CREATE INDEX IF NOT EXISTS "videos_channel_id_idx" ON "videos"("channel_id");
CREATE INDEX IF NOT EXISTS "videos_collection_id_idx" ON "videos"("collection_id");
CREATE INDEX IF NOT EXISTS "videos_processing_status_idx" ON "videos"("processing_status");
