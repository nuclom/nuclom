CREATE TABLE "github_file_cache" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"repo_full_name" text NOT NULL,
	"path" text NOT NULL,
	"ref" text NOT NULL,
	"content" text,
	"language" text,
	"size" integer,
	"sha" text,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "github_file_cache_source_path_ref_unique" UNIQUE("source_id","repo_full_name","path","ref")
);
--> statement-breakpoint
CREATE TABLE "github_repo_sync" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"repo_full_name" text NOT NULL,
	"repo_id" bigint NOT NULL,
	"default_branch" text DEFAULT 'main',
	"is_private" boolean DEFAULT false NOT NULL,
	"sync_prs" boolean DEFAULT true NOT NULL,
	"sync_issues" boolean DEFAULT true NOT NULL,
	"sync_discussions" boolean DEFAULT true NOT NULL,
	"sync_commits" boolean DEFAULT false NOT NULL,
	"label_filters" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"exclude_labels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_pr_cursor" text,
	"last_issue_cursor" text,
	"last_discussion_cursor" text,
	"last_commit_sha" text,
	"last_sync_at" timestamp,
	"pr_count" integer DEFAULT 0 NOT NULL,
	"issue_count" integer DEFAULT 0 NOT NULL,
	"discussion_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "github_repo_sync_source_repo_unique" UNIQUE("source_id","repo_full_name")
);
--> statement-breakpoint
CREATE TABLE "github_users" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"github_user_id" bigint NOT NULL,
	"github_login" text NOT NULL,
	"user_id" text,
	"name" text,
	"email" text,
	"avatar_url" text,
	"type" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "github_users_source_github_user_unique" UNIQUE("source_id","github_user_id")
);
--> statement-breakpoint
CREATE TABLE "decision_evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"decision_id" text NOT NULL,
	"content_item_id" text NOT NULL,
	"evidence_type" text NOT NULL,
	"stage" text NOT NULL,
	"excerpt" text,
	"timestamp_in_source" timestamp,
	"confidence" real DEFAULT 1 NOT NULL,
	"detected_by" text DEFAULT 'ai' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "decision_evidence_decision_content_unique" UNIQUE("decision_id","content_item_id","evidence_type")
);
--> statement-breakpoint
CREATE TABLE "topic_cluster_members" (
	"id" text PRIMARY KEY NOT NULL,
	"cluster_id" text NOT NULL,
	"content_item_id" text NOT NULL,
	"similarity_score" real NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "topic_cluster_members_cluster_content_unique" UNIQUE("cluster_id","content_item_id")
);
--> statement-breakpoint
CREATE TABLE "topic_clusters" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"embedding_centroid" vector(1536),
	"content_count" integer DEFAULT 0 NOT NULL,
	"source_breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"participant_count" integer DEFAULT 0 NOT NULL,
	"last_activity_at" timestamp,
	"trending_score" real DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topic_expertise" (
	"id" text PRIMARY KEY NOT NULL,
	"cluster_id" text NOT NULL,
	"user_id" text,
	"external_id" text,
	"name" text NOT NULL,
	"contribution_count" integer DEFAULT 1 NOT NULL,
	"first_contribution_at" timestamp,
	"last_contribution_at" timestamp,
	"expertise_score" real DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notion_database_schemas" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"database_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"schema" jsonb NOT NULL,
	"property_count" integer,
	"entry_count" integer,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notion_database_schemas_source_database_unique" UNIQUE("source_id","database_id")
);
--> statement-breakpoint
CREATE TABLE "notion_page_hierarchy" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"page_id" text NOT NULL,
	"parent_id" text,
	"parent_type" text NOT NULL,
	"depth" integer DEFAULT 0 NOT NULL,
	"path" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"title_path" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_database" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"last_edited_time" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notion_page_hierarchy_source_page_unique" UNIQUE("source_id","page_id")
);
--> statement-breakpoint
CREATE TABLE "notion_users" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"notion_user_id" text NOT NULL,
	"user_id" text,
	"name" text,
	"avatar_url" text,
	"email" text,
	"type" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notion_users_source_notion_user_unique" UNIQUE("source_id","notion_user_id")
);
--> statement-breakpoint
CREATE TABLE "slack_channel_sync" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"channel_name" text NOT NULL,
	"channel_type" text NOT NULL,
	"is_member" boolean DEFAULT true NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"is_syncing" boolean DEFAULT false NOT NULL,
	"sync_enabled" boolean DEFAULT true NOT NULL,
	"last_message_ts" text,
	"oldest_message_ts" text,
	"last_sync_at" timestamp,
	"message_count" integer DEFAULT 0 NOT NULL,
	"member_count" integer,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "slack_channel_sync_source_channel_unique" UNIQUE("source_id","channel_id")
);
--> statement-breakpoint
CREATE TABLE "slack_users" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"slack_user_id" text NOT NULL,
	"user_id" text,
	"display_name" text NOT NULL,
	"real_name" text,
	"email" text,
	"avatar_url" text,
	"is_bot" boolean DEFAULT false NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"timezone" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "slack_users_source_slack_user_unique" UNIQUE("source_id","slack_user_id")
);
--> statement-breakpoint
ALTER TABLE "github_file_cache" ADD CONSTRAINT "github_file_cache_source_id_content_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."content_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_repo_sync" ADD CONSTRAINT "github_repo_sync_source_id_content_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."content_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_users" ADD CONSTRAINT "github_users_source_id_content_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."content_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_users" ADD CONSTRAINT "github_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_evidence" ADD CONSTRAINT "decision_evidence_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_evidence" ADD CONSTRAINT "decision_evidence_decision_id_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_evidence" ADD CONSTRAINT "decision_evidence_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_cluster_members" ADD CONSTRAINT "topic_cluster_members_cluster_id_topic_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."topic_clusters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_cluster_members" ADD CONSTRAINT "topic_cluster_members_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_clusters" ADD CONSTRAINT "topic_clusters_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_expertise" ADD CONSTRAINT "topic_expertise_cluster_id_topic_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."topic_clusters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_expertise" ADD CONSTRAINT "topic_expertise_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notion_database_schemas" ADD CONSTRAINT "notion_database_schemas_source_id_content_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."content_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notion_page_hierarchy" ADD CONSTRAINT "notion_page_hierarchy_source_id_content_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."content_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notion_users" ADD CONSTRAINT "notion_users_source_id_content_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."content_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notion_users" ADD CONSTRAINT "notion_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_channel_sync" ADD CONSTRAINT "slack_channel_sync_source_id_content_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."content_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_users" ADD CONSTRAINT "slack_users_source_id_content_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."content_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_users" ADD CONSTRAINT "slack_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "github_file_cache_source_idx" ON "github_file_cache" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "github_file_cache_expires_idx" ON "github_file_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "github_repo_sync_source_idx" ON "github_repo_sync" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "github_repo_sync_repo_full_name_idx" ON "github_repo_sync" USING btree ("repo_full_name");--> statement-breakpoint
CREATE INDEX "github_users_source_idx" ON "github_users" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "github_users_github_user_id_idx" ON "github_users" USING btree ("github_user_id");--> statement-breakpoint
CREATE INDEX "github_users_github_login_idx" ON "github_users" USING btree ("github_login");--> statement-breakpoint
CREATE INDEX "decision_evidence_decision_idx" ON "decision_evidence" USING btree ("decision_id");--> statement-breakpoint
CREATE INDEX "decision_evidence_content_idx" ON "decision_evidence" USING btree ("content_item_id");--> statement-breakpoint
CREATE INDEX "decision_evidence_org_idx" ON "decision_evidence" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "topic_cluster_members_cluster_idx" ON "topic_cluster_members" USING btree ("cluster_id");--> statement-breakpoint
CREATE INDEX "topic_cluster_members_content_idx" ON "topic_cluster_members" USING btree ("content_item_id");--> statement-breakpoint
CREATE INDEX "topic_clusters_org_idx" ON "topic_clusters" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "topic_clusters_trending_idx" ON "topic_clusters" USING btree ("trending_score");--> statement-breakpoint
CREATE INDEX "topic_expertise_cluster_idx" ON "topic_expertise" USING btree ("cluster_id");--> statement-breakpoint
CREATE INDEX "topic_expertise_user_idx" ON "topic_expertise" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "topic_expertise_external_idx" ON "topic_expertise" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "topic_expertise_score_idx" ON "topic_expertise" USING btree ("expertise_score");--> statement-breakpoint
CREATE INDEX "notion_database_schemas_source_idx" ON "notion_database_schemas" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "notion_database_schemas_database_id_idx" ON "notion_database_schemas" USING btree ("database_id");--> statement-breakpoint
CREATE INDEX "notion_page_hierarchy_source_idx" ON "notion_page_hierarchy" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "notion_page_hierarchy_page_id_idx" ON "notion_page_hierarchy" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "notion_page_hierarchy_parent_idx" ON "notion_page_hierarchy" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "notion_users_source_idx" ON "notion_users" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "notion_users_notion_user_id_idx" ON "notion_users" USING btree ("notion_user_id");--> statement-breakpoint
CREATE INDEX "slack_channel_sync_source_idx" ON "slack_channel_sync" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "slack_channel_sync_channel_id_idx" ON "slack_channel_sync" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "slack_users_source_idx" ON "slack_users" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "slack_users_slack_user_id_idx" ON "slack_users" USING btree ("slack_user_id");--> statement-breakpoint
CREATE INDEX "slack_users_email_idx" ON "slack_users" USING btree ("email");