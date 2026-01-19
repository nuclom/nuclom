CREATE TYPE "public"."ContentItemType" AS ENUM('video', 'message', 'thread', 'document', 'issue', 'pull_request', 'comment', 'file');--> statement-breakpoint
CREATE TYPE "public"."ContentParticipantRole" AS ENUM('author', 'speaker', 'participant', 'mentioned', 'assignee', 'reviewer');--> statement-breakpoint
CREATE TYPE "public"."ContentProcessingStatus" AS ENUM('pending', 'processing', 'completed', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."ContentRelationshipType" AS ENUM('references', 'replies_to', 'implements', 'supersedes', 'relates_to', 'mentions', 'derived_from');--> statement-breakpoint
CREATE TYPE "public"."ContentSourceSyncStatus" AS ENUM('idle', 'syncing', 'error', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."ContentSourceType" AS ENUM('video', 'slack', 'notion', 'github', 'google_drive', 'confluence', 'linear');--> statement-breakpoint
ALTER TYPE "public"."NotificationType" ADD VALUE 'usage_alert';--> statement-breakpoint
CREATE TABLE "content_chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"content_item_id" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"embedding_vector" vector(1536),
	"start_offset" integer,
	"end_offset" integer,
	"timestamp_start" integer,
	"timestamp_end" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "content_chunks_item_chunk_unique" UNIQUE("content_item_id","chunk_index")
);
--> statement-breakpoint
CREATE TABLE "content_items" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"source_id" text NOT NULL,
	"type" "ContentItemType" NOT NULL,
	"external_id" text NOT NULL,
	"title" text,
	"content" text,
	"content_html" text,
	"author_id" text,
	"author_external" text,
	"author_name" text,
	"created_at_source" timestamp,
	"updated_at_source" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"processing_status" "ContentProcessingStatus" DEFAULT 'pending' NOT NULL,
	"processing_error" text,
	"processed_at" timestamp,
	"summary" text,
	"key_points" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sentiment" text,
	"embedding_vector" vector(1536),
	"search_text" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "content_items_source_external_unique" UNIQUE("source_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "content_participants" (
	"id" text PRIMARY KEY NOT NULL,
	"content_item_id" text NOT NULL,
	"user_id" text,
	"external_id" text,
	"name" text NOT NULL,
	"email" text,
	"role" "ContentParticipantRole" DEFAULT 'participant' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_relationships" (
	"id" text PRIMARY KEY NOT NULL,
	"source_item_id" text NOT NULL,
	"target_item_id" text NOT NULL,
	"relationship_type" "ContentRelationshipType" NOT NULL,
	"confidence" real DEFAULT 1 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "content_relationships_unique" UNIQUE("source_item_id","target_item_id","relationship_type")
);
--> statement-breakpoint
CREATE TABLE "content_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"type" "ContentSourceType" NOT NULL,
	"name" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"credentials" jsonb,
	"sync_status" "ContentSourceSyncStatus" DEFAULT 'idle' NOT NULL,
	"last_sync_at" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "overage_rates" jsonb;--> statement-breakpoint
ALTER TABLE "usage" ADD COLUMN IF NOT EXISTS "storage_overage" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "usage" ADD COLUMN IF NOT EXISTS "bandwidth_overage" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "usage" ADD COLUMN IF NOT EXISTS "videos_overage" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "usage" ADD COLUMN IF NOT EXISTS "ai_requests_overage" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "usage" ADD COLUMN IF NOT EXISTS "overage_charges" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "usage" ADD COLUMN IF NOT EXISTS "overage_reported_to_stripe" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "content_chunks" ADD CONSTRAINT "content_chunks_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_source_id_content_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."content_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_participants" ADD CONSTRAINT "content_participants_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_participants" ADD CONSTRAINT "content_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_relationships" ADD CONSTRAINT "content_relationships_source_item_id_content_items_id_fk" FOREIGN KEY ("source_item_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_relationships" ADD CONSTRAINT "content_relationships_target_item_id_content_items_id_fk" FOREIGN KEY ("target_item_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_sources" ADD CONSTRAINT "content_sources_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_chunks_item_idx" ON "content_chunks" USING btree ("content_item_id");--> statement-breakpoint
CREATE INDEX "content_items_org_idx" ON "content_items" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "content_items_source_idx" ON "content_items" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "content_items_type_idx" ON "content_items" USING btree ("type");--> statement-breakpoint
CREATE INDEX "content_items_processing_idx" ON "content_items" USING btree ("processing_status");--> statement-breakpoint
CREATE INDEX "content_items_created_at_source_idx" ON "content_items" USING btree ("created_at_source");--> statement-breakpoint
CREATE INDEX "content_items_author_idx" ON "content_items" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "content_participants_item_idx" ON "content_participants" USING btree ("content_item_id");--> statement-breakpoint
CREATE INDEX "content_participants_user_idx" ON "content_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "content_participants_external_idx" ON "content_participants" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "content_relationships_source_idx" ON "content_relationships" USING btree ("source_item_id");--> statement-breakpoint
CREATE INDEX "content_relationships_target_idx" ON "content_relationships" USING btree ("target_item_id");--> statement-breakpoint
CREATE INDEX "content_relationships_type_idx" ON "content_relationships" USING btree ("relationship_type");--> statement-breakpoint
CREATE INDEX "content_sources_org_idx" ON "content_sources" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "content_sources_type_idx" ON "content_sources" USING btree ("type");--> statement-breakpoint
CREATE INDEX "content_sources_sync_status_idx" ON "content_sources" USING btree ("sync_status");
