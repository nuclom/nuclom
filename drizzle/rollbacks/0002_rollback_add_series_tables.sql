-- Rollback: 0002_add_series_tables.sql
-- Description: Removes series-related tables and collection fields

-- Drop indexes first
DROP INDEX IF EXISTS "series_progress_series_idx";
DROP INDEX IF EXISTS "series_progress_user_idx";
DROP INDEX IF EXISTS "series_videos_series_position_idx";

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS "series_progress";
DROP TABLE IF EXISTS "series_videos";

-- Remove added columns from collections table
ALTER TABLE "collections" DROP COLUMN IF EXISTS "created_by_id";
ALTER TABLE "collections" DROP COLUMN IF EXISTS "is_public";
ALTER TABLE "collections" DROP COLUMN IF EXISTS "thumbnail_url";
