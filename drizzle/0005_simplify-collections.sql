DO $$ BEGIN
	CREATE TYPE "public"."ChatMessageRole" AS ENUM('user', 'assistant', 'system', 'tool');
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."CollectionType" AS ENUM('folder', 'playlist');
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_context" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"relevance_score" integer,
	"context_snippet" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chat_context_unique" UNIQUE("message_id","source_type","source_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"title" text,
	"video_ids" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"role" "ChatMessageRole" NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1536),
	"tool_calls" jsonb,
	"tool_result" jsonb,
	"usage" jsonb,
	"sources" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collection_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"collection_id" text NOT NULL,
	"last_video_id" text,
	"last_position" integer DEFAULT 0 NOT NULL,
	"completed_video_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "collection_progress_user_id_collection_id_unique" UNIQUE("user_id","collection_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collection_videos" (
	"id" text PRIMARY KEY NOT NULL,
	"collection_id" text NOT NULL,
	"video_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "collection_videos_collection_id_video_id_unique" UNIQUE("collection_id","video_id")
);
--> statement-breakpoint
ALTER TABLE "channels" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "series_progress" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "series_videos" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE IF EXISTS "channels" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "series_progress" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "series_videos" CASCADE;--> statement-breakpoint
ALTER TABLE "videos" DROP CONSTRAINT IF EXISTS "videos_channel_id_channels_id_fk";
--> statement-breakpoint
ALTER TABLE "videos" DROP CONSTRAINT IF EXISTS "videos_collection_id_collections_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "videos_channel_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "videos_collection_id_idx";--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "type" "CollectionType" DEFAULT 'folder' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "chat_context" ADD CONSTRAINT "chat_context_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "collection_progress" ADD CONSTRAINT "collection_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "collection_progress" ADD CONSTRAINT "collection_progress_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "collection_progress" ADD CONSTRAINT "collection_progress_last_video_id_videos_id_fk" FOREIGN KEY ("last_video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "collection_videos" ADD CONSTRAINT "collection_videos_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "collection_videos" ADD CONSTRAINT "collection_videos_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_context_message_idx" ON "chat_context" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_context_source_idx" ON "chat_context" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_conversations_org_idx" ON "chat_conversations" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_conversations_user_idx" ON "chat_conversations" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_messages_conversation_idx" ON "chat_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_messages_role_idx" ON "chat_messages" USING btree ("role");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collection_progress_user_id_idx" ON "collection_progress" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collection_progress_collection_id_idx" ON "collection_progress" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collection_videos_collection_id_idx" ON "collection_videos" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collection_videos_video_id_idx" ON "collection_videos" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collections_type_idx" ON "collections" USING btree ("type");--> statement-breakpoint
ALTER TABLE "videos" DROP COLUMN IF EXISTS "channel_id";--> statement-breakpoint
ALTER TABLE "videos" DROP COLUMN IF EXISTS "collection_id";
