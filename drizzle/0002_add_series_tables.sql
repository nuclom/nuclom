-- Add new fields to collections table for series functionality
ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "thumbnail_url" text;
ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "is_public" boolean DEFAULT false NOT NULL;
ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "created_by_id" text REFERENCES "users"("id");

-- Junction table for videos in series with ordering
CREATE TABLE IF NOT EXISTS "series_videos" (
  "id" text PRIMARY KEY NOT NULL,
  "series_id" text NOT NULL REFERENCES "collections"("id") ON DELETE CASCADE,
  "video_id" text NOT NULL REFERENCES "videos"("id") ON DELETE CASCADE,
  "position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "series_videos_series_id_video_id_unique" UNIQUE("series_id", "video_id")
);

-- Create index for efficient ordering queries
CREATE INDEX IF NOT EXISTS "series_videos_series_position_idx" ON "series_videos"("series_id", "position");

-- Track user progress through series
CREATE TABLE IF NOT EXISTS "series_progress" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "series_id" text NOT NULL REFERENCES "collections"("id") ON DELETE CASCADE,
  "last_video_id" text REFERENCES "videos"("id"),
  "last_position" integer DEFAULT 0 NOT NULL,
  "completed_video_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "series_progress_user_id_series_id_unique" UNIQUE("user_id", "series_id")
);

-- Create index for user progress queries
CREATE INDEX IF NOT EXISTS "series_progress_user_idx" ON "series_progress"("user_id");
CREATE INDEX IF NOT EXISTS "series_progress_series_idx" ON "series_progress"("series_id");
