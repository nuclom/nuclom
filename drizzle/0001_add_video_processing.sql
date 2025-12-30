-- Migration: Add video processing fields
-- Description: Adds processing status, metadata, and workflow tracking to videos table

CREATE TYPE "public"."ProcessingStatus" AS ENUM(
  'pending',
  'uploading',
  'processing',
  'extracting_metadata',
  'generating_thumbnails',
  'transcribing',
  'analyzing',
  'completed',
  'failed'
);

--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "processing_status" "ProcessingStatus" DEFAULT 'pending' NOT NULL;

--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "processing_progress" integer DEFAULT 0 NOT NULL;

--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "processing_error" text;

--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "width" integer;

--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "height" integer;

--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "codec" text;

--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "fps" integer;

--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "bitrate" integer;

--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "file_size" integer;

--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "thumbnail_alternates" text;

--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "workflow_run_id" text;

--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "processed_at" timestamp;
