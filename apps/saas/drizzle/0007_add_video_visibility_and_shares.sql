-- Add video visibility and sharing support
-- Migration: 0007_add_video_visibility_and_shares

-- Create the VideoVisibility enum
DO $$ BEGIN
    CREATE TYPE "VideoVisibility" AS ENUM('private', 'organization', 'public');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add visibility column to videos table with default 'organization' for backward compatibility
ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "visibility" "VideoVisibility" NOT NULL DEFAULT 'organization';

-- Create indexes for visibility
CREATE INDEX IF NOT EXISTS "videos_visibility_idx" ON "videos" ("visibility");
CREATE INDEX IF NOT EXISTS "videos_org_visibility_idx" ON "videos" ("organization_id", "visibility");

-- Create video_shares table for direct sharing with users/teams
CREATE TABLE IF NOT EXISTS "video_shares" (
    "id" text PRIMARY KEY NOT NULL,
    "video_id" text NOT NULL REFERENCES "videos"("id") ON DELETE CASCADE,
    "user_id" text REFERENCES "users"("id") ON DELETE CASCADE,
    "team_id" text REFERENCES "teams"("id") ON DELETE CASCADE,
    "access_level" "VideoShareLinkAccess" NOT NULL DEFAULT 'view',
    "shared_by" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create indexes for video_shares
CREATE INDEX IF NOT EXISTS "video_shares_video_idx" ON "video_shares" ("video_id");
CREATE INDEX IF NOT EXISTS "video_shares_user_idx" ON "video_shares" ("user_id");
CREATE INDEX IF NOT EXISTS "video_shares_team_idx" ON "video_shares" ("team_id");

-- Unique constraints to prevent duplicate shares
CREATE UNIQUE INDEX IF NOT EXISTS "video_shares_video_user_unique" ON "video_shares" ("video_id", "user_id") WHERE "user_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "video_shares_video_team_unique" ON "video_shares" ("video_id", "team_id") WHERE "team_id" IS NOT NULL;
