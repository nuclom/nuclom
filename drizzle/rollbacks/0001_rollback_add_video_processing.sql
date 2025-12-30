-- Rollback: 0001_add_video_processing.sql
-- Description: Removes video processing fields from videos table

-- Remove columns from videos table
ALTER TABLE "videos" DROP COLUMN IF EXISTS "processed_at";
ALTER TABLE "videos" DROP COLUMN IF EXISTS "workflow_run_id";
ALTER TABLE "videos" DROP COLUMN IF EXISTS "thumbnail_alternates";
ALTER TABLE "videos" DROP COLUMN IF EXISTS "file_size";
ALTER TABLE "videos" DROP COLUMN IF EXISTS "bitrate";
ALTER TABLE "videos" DROP COLUMN IF EXISTS "fps";
ALTER TABLE "videos" DROP COLUMN IF EXISTS "codec";
ALTER TABLE "videos" DROP COLUMN IF EXISTS "height";
ALTER TABLE "videos" DROP COLUMN IF EXISTS "width";
ALTER TABLE "videos" DROP COLUMN IF EXISTS "processing_error";
ALTER TABLE "videos" DROP COLUMN IF EXISTS "processing_progress";
ALTER TABLE "videos" DROP COLUMN IF EXISTS "processing_status";

-- Drop the processing status enum
DROP TYPE IF EXISTS "public"."ProcessingStatus";
