-- Migration: Fix cascade delete constraints for data integrity
-- Description: Ensures proper foreign key behaviors for user and organization deletions

-- ============================================================================
-- Fix videos.author_id constraint
-- When a user is deleted, their videos should be handled appropriately
-- Option: SET NULL (keep videos but remove author reference) instead of leaving orphaned
-- ============================================================================

-- Drop existing constraint
ALTER TABLE "videos" DROP CONSTRAINT IF EXISTS "videos_author_id_users_id_fk";

-- Re-add with SET NULL behavior (videos remain but author reference is cleared)
ALTER TABLE "videos"
ADD CONSTRAINT "videos_author_id_users_id_fk"
FOREIGN KEY ("author_id") REFERENCES "public"."users"("id")
ON DELETE SET NULL ON UPDATE NO ACTION;

-- Make author_id nullable to support SET NULL behavior
ALTER TABLE "videos" ALTER COLUMN "author_id" DROP NOT NULL;

-- ============================================================================
-- Fix videos.channel_id constraint
-- When a channel is deleted, videos should remain but channel reference cleared
-- ============================================================================

ALTER TABLE "videos" DROP CONSTRAINT IF EXISTS "videos_channel_id_channels_id_fk";

ALTER TABLE "videos"
ADD CONSTRAINT "videos_channel_id_channels_id_fk"
FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id")
ON DELETE SET NULL ON UPDATE NO ACTION;

-- ============================================================================
-- Fix videos.collection_id constraint
-- When a collection is deleted, videos should remain but collection reference cleared
-- ============================================================================

ALTER TABLE "videos" DROP CONSTRAINT IF EXISTS "videos_collection_id_collections_id_fk";

ALTER TABLE "videos"
ADD CONSTRAINT "videos_collection_id_collections_id_fk"
FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id")
ON DELETE SET NULL ON UPDATE NO ACTION;

-- ============================================================================
-- Fix collections.created_by_id constraint
-- When creator is deleted, keep collection but clear reference
-- ============================================================================

ALTER TABLE "collections" DROP CONSTRAINT IF EXISTS "collections_created_by_id_users_id_fk";

ALTER TABLE "collections"
ADD CONSTRAINT "collections_created_by_id_users_id_fk"
FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id")
ON DELETE SET NULL ON UPDATE NO ACTION;

-- ============================================================================
-- Fix series_progress.last_video_id constraint
-- When the video is deleted, clear the last_video reference
-- ============================================================================

ALTER TABLE "series_progress" DROP CONSTRAINT IF EXISTS "series_progress_last_video_id_videos_id_fk";

ALTER TABLE "series_progress"
ADD CONSTRAINT "series_progress_last_video_id_videos_id_fk"
FOREIGN KEY ("last_video_id") REFERENCES "public"."videos"("id")
ON DELETE SET NULL ON UPDATE NO ACTION;

-- ============================================================================
-- Fix imported_meetings.video_id constraint (already SET NULL, verify it exists)
-- ============================================================================

-- This is already correctly SET NULL in the original migration

-- ============================================================================
-- Add indexes for foreign key columns to improve cascade delete performance
-- ============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_videos_author_id" ON "videos"("author_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_videos_channel_id" ON "videos"("channel_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_videos_collection_id" ON "videos"("collection_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_collections_created_by_id" ON "collections"("created_by_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_series_progress_last_video_id" ON "series_progress"("last_video_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_comments_parent_id" ON "comments"("parent_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_notifications_actor_id" ON "notifications"("actor_id");
