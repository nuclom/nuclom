-- Migration: Add integrations and imported meetings
-- Description: Adds tables for Zoom and Google Meet integrations

CREATE TYPE "public"."IntegrationProvider" AS ENUM('zoom', 'google_meet');

--> statement-breakpoint
CREATE TYPE "public"."ImportStatus" AS ENUM('pending', 'downloading', 'processing', 'completed', 'failed');

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "integrations" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "provider" "IntegrationProvider" NOT NULL,
  "access_token" text NOT NULL,
  "refresh_token" text,
  "expires_at" timestamp,
  "scope" text,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "integrations_user_id_provider_unique" UNIQUE("user_id", "provider")
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "imported_meetings" (
  "id" text PRIMARY KEY NOT NULL,
  "integration_id" text NOT NULL REFERENCES "integrations"("id") ON DELETE CASCADE,
  "video_id" text REFERENCES "videos"("id") ON DELETE SET NULL,
  "external_id" text NOT NULL,
  "meeting_title" text,
  "meeting_date" timestamp,
  "duration" integer,
  "participants" jsonb,
  "download_url" text,
  "file_size" integer,
  "import_status" "ImportStatus" DEFAULT 'pending' NOT NULL,
  "import_error" text,
  "imported_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "imported_meetings_integration_id_external_id_unique" UNIQUE("integration_id", "external_id")
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "integrations_user_id_idx" ON "integrations"("user_id");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "integrations_organization_id_idx" ON "integrations"("organization_id");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "imported_meetings_integration_id_idx" ON "imported_meetings"("integration_id");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "imported_meetings_video_id_idx" ON "imported_meetings"("video_id");
