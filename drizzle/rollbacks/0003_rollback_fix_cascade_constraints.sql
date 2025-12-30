-- Rollback: 0003_fix_cascade_constraints.sql
-- Description: Reverts cascade delete constraint changes

-- Drop new indexes
DROP INDEX CONCURRENTLY IF EXISTS "idx_videos_author_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_videos_channel_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_videos_collection_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_collections_created_by_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_series_progress_last_video_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_comments_parent_id";
DROP INDEX CONCURRENTLY IF EXISTS "idx_notifications_actor_id";

-- Restore videos.author_id constraint (original: NO ACTION, NOT NULL)
ALTER TABLE "videos" DROP CONSTRAINT IF EXISTS "videos_author_id_users_id_fk";
-- Note: Cannot easily restore NOT NULL if data has NULLs - manual data fix required
ALTER TABLE "videos"
ADD CONSTRAINT "videos_author_id_users_id_fk"
FOREIGN KEY ("author_id") REFERENCES "public"."users"("id")
ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Restore videos.channel_id constraint
ALTER TABLE "videos" DROP CONSTRAINT IF EXISTS "videos_channel_id_channels_id_fk";
ALTER TABLE "videos"
ADD CONSTRAINT "videos_channel_id_channels_id_fk"
FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id")
ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Restore videos.collection_id constraint
ALTER TABLE "videos" DROP CONSTRAINT IF EXISTS "videos_collection_id_collections_id_fk";
ALTER TABLE "videos"
ADD CONSTRAINT "videos_collection_id_collections_id_fk"
FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id")
ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Restore collections.created_by_id constraint
ALTER TABLE "collections" DROP CONSTRAINT IF EXISTS "collections_created_by_id_users_id_fk";
ALTER TABLE "collections"
ADD CONSTRAINT "collections_created_by_id_users_id_fk"
FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id")
ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Restore series_progress.last_video_id constraint
ALTER TABLE "series_progress" DROP CONSTRAINT IF EXISTS "series_progress_last_video_id_videos_id_fk";
ALTER TABLE "series_progress"
ADD CONSTRAINT "series_progress_last_video_id_videos_id_fk"
FOREIGN KEY ("last_video_id") REFERENCES "public"."videos"("id")
ON DELETE NO ACTION ON UPDATE NO ACTION;
