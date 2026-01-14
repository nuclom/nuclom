-- Migration: Simplify Collections UX
-- Consolidates channels, series, and collections into a unified "collections" concept
-- Collections have a "type" field: 'folder' (simple grouping) or 'playlist' (ordered with progress)

-- Step 1: Create the CollectionType enum
CREATE TYPE "public"."CollectionType" AS ENUM('folder', 'playlist');--> statement-breakpoint

-- Step 2: Add type column to collections (existing series become playlists)
ALTER TABLE "collections" ADD COLUMN "type" "CollectionType" DEFAULT 'playlist' NOT NULL;--> statement-breakpoint

-- Step 3: Create collection_videos table (unified junction table)
CREATE TABLE "collection_videos" (
	"id" text PRIMARY KEY NOT NULL,
	"collection_id" text NOT NULL,
	"video_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "collection_videos_collection_id_video_id_unique" UNIQUE("collection_id","video_id")
);--> statement-breakpoint

-- Step 4: Create collection_progress table (for playlist progress tracking)
CREATE TABLE "collection_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"collection_id" text NOT NULL,
	"last_video_id" text,
	"last_position" integer DEFAULT 0 NOT NULL,
	"completed_video_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "collection_progress_user_id_collection_id_unique" UNIQUE("user_id","collection_id")
);--> statement-breakpoint

-- Step 5: Add foreign keys to collection_videos
ALTER TABLE "collection_videos" ADD CONSTRAINT "collection_videos_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_videos" ADD CONSTRAINT "collection_videos_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Step 6: Add foreign keys to collection_progress
ALTER TABLE "collection_progress" ADD CONSTRAINT "collection_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_progress" ADD CONSTRAINT "collection_progress_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_progress" ADD CONSTRAINT "collection_progress_last_video_id_videos_id_fk" FOREIGN KEY ("last_video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- Step 7: Create indexes for collection_videos
CREATE INDEX "collection_videos_collection_id_idx" ON "collection_videos" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "collection_videos_video_id_idx" ON "collection_videos" USING btree ("video_id");--> statement-breakpoint

-- Step 8: Create indexes for collection_progress
CREATE INDEX "collection_progress_user_id_idx" ON "collection_progress" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "collection_progress_collection_id_idx" ON "collection_progress" USING btree ("collection_id");--> statement-breakpoint

-- Step 9: Add index for collection type
CREATE INDEX "collections_type_idx" ON "collections" USING btree ("type");--> statement-breakpoint

-- Step 10: Migrate existing series_videos data to collection_videos
INSERT INTO "collection_videos" ("id", "collection_id", "video_id", "position", "created_at")
SELECT "id", "series_id", "video_id", "position", "created_at"
FROM "series_videos"
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- Step 11: Migrate existing series_progress data to collection_progress
INSERT INTO "collection_progress" ("id", "user_id", "collection_id", "last_video_id", "last_position", "completed_video_ids", "updated_at")
SELECT "id", "user_id", "series_id", "last_video_id", "last_position", "completed_video_ids", "updated_at"
FROM "series_progress"
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- Step 12: Migrate channels to collections as folder type
INSERT INTO "collections" ("id", "name", "description", "organization_id", "type", "is_public", "created_at", "updated_at")
SELECT "id", "name", "description", "organization_id", 'folder'::"CollectionType", false, "created_at", "updated_at"
FROM "channels"
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- Step 13: Migrate videos with channel_id to collection_videos
INSERT INTO "collection_videos" ("id", "collection_id", "video_id", "position", "created_at")
SELECT gen_random_uuid()::text, "channel_id", "id", 0, now()
FROM "videos"
WHERE "channel_id" IS NOT NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- Step 14: Migrate videos with collection_id to collection_videos (if not already there from series_videos)
INSERT INTO "collection_videos" ("id", "collection_id", "video_id", "position", "created_at")
SELECT gen_random_uuid()::text, "collection_id", "id", 0, now()
FROM "videos"
WHERE "collection_id" IS NOT NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- Step 15: Drop old foreign key constraints from videos
ALTER TABLE "videos" DROP CONSTRAINT IF EXISTS "videos_channel_id_channels_id_fk";--> statement-breakpoint
ALTER TABLE "videos" DROP CONSTRAINT IF EXISTS "videos_collection_id_collections_id_fk";--> statement-breakpoint

-- Step 16: Drop old indexes from videos
DROP INDEX IF EXISTS "videos_channel_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "videos_collection_id_idx";--> statement-breakpoint

-- Step 17: Drop old columns from videos
ALTER TABLE "videos" DROP COLUMN IF EXISTS "channel_id";--> statement-breakpoint
ALTER TABLE "videos" DROP COLUMN IF EXISTS "collection_id";--> statement-breakpoint

-- Step 18: Drop old tables
DROP TABLE IF EXISTS "series_videos";--> statement-breakpoint
DROP TABLE IF EXISTS "series_progress";--> statement-breakpoint
DROP TABLE IF EXISTS "channels";
