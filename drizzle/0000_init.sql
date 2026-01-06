CREATE EXTENSION IF NOT EXISTS vector;

--> statement-breakpoint
CREATE TYPE "public"."ActionItemPriority" AS ENUM('high', 'medium', 'low');

--> statement-breakpoint
CREATE TYPE "public"."ActionItemStatus" AS ENUM(
	'pending',
	'in_progress',
	'completed',
	'cancelled'
);

--> statement-breakpoint
CREATE TYPE "public"."ActivityType" AS ENUM(
	'video_uploaded',
	'video_processed',
	'video_shared',
	'comment_added',
	'comment_reply',
	'reaction_added',
	'member_joined',
	'member_left',
	'integration_connected',
	'integration_disconnected',
	'video_imported'
);

--> statement-breakpoint
CREATE TYPE "public"."AuditLogCategory" AS ENUM(
	'authentication',
	'authorization',
	'user_management',
	'organization_management',
	'content_management',
	'billing',
	'security',
	'integration',
	'system'
);

--> statement-breakpoint
CREATE TYPE "public"."AuditLogSeverity" AS ENUM('info', 'warning', 'error', 'critical');

--> statement-breakpoint
CREATE TYPE "public"."ClipStatus" AS ENUM('pending', 'processing', 'ready', 'failed');

--> statement-breakpoint
CREATE TYPE "public"."ClipType" AS ENUM('auto', 'manual');

--> statement-breakpoint
CREATE TYPE "public"."CodeLinkType" AS ENUM('pr', 'issue', 'commit', 'file', 'directory');

--> statement-breakpoint
CREATE TYPE "public"."ConsentAction" AS ENUM('granted', 'withdrawn', 'updated');

--> statement-breakpoint
CREATE TYPE "public"."DecisionStatus" AS ENUM('proposed', 'decided', 'revisited', 'superseded');

--> statement-breakpoint
CREATE TYPE "public"."DecisionType" AS ENUM(
	'technical',
	'process',
	'product',
	'team',
	'other'
);

--> statement-breakpoint
CREATE TYPE "public"."HealthCheckService" AS ENUM('database', 'storage', 'ai', 'overall');

--> statement-breakpoint
CREATE TYPE "public"."HealthCheckStatus" AS ENUM(
	'healthy',
	'degraded',
	'unhealthy',
	'not_configured'
);

--> statement-breakpoint
CREATE TYPE "public"."HighlightReelStatus" AS ENUM('draft', 'rendering', 'ready', 'failed');

--> statement-breakpoint
CREATE TYPE "public"."ImportStatus" AS ENUM(
	'pending',
	'downloading',
	'processing',
	'completed',
	'failed'
);

--> statement-breakpoint
CREATE TYPE "public"."IntegrationProvider" AS ENUM(
	'zoom',
	'google_meet',
	'slack',
	'microsoft_teams',
	'github'
);

--> statement-breakpoint
CREATE TYPE "public"."InvoiceStatus" AS ENUM('draft', 'open', 'paid', 'void', 'uncollectible');

--> statement-breakpoint
CREATE TYPE "public"."KnowledgeNodeType" AS ENUM(
	'person',
	'topic',
	'artifact',
	'decision',
	'video'
);

--> statement-breakpoint
CREATE TYPE "public"."LegalDocumentType" AS ENUM('terms_of_service', 'privacy_policy');

--> statement-breakpoint
CREATE TYPE "public"."MomentType" AS ENUM(
	'decision',
	'action_item',
	'question',
	'answer',
	'emphasis',
	'demonstration',
	'conclusion',
	'highlight'
);

--> statement-breakpoint
CREATE TYPE "public"."NotificationType" AS ENUM(
	'comment_reply',
	'comment_mention',
	'new_comment_on_video',
	'video_shared',
	'video_processing_complete',
	'video_processing_failed',
	'invitation_received',
	'trial_ending',
	'subscription_created',
	'subscription_updated',
	'subscription_canceled',
	'payment_failed',
	'payment_succeeded'
);

--> statement-breakpoint
CREATE TYPE "public"."OrganizationRole" AS ENUM('owner', 'member');

--> statement-breakpoint
CREATE TYPE "public"."ParticipantRole" AS ENUM('decider', 'participant', 'mentioned');

--> statement-breakpoint
CREATE TYPE "public"."ProcessingStatus" AS ENUM(
	'pending',
	'transcribing',
	'diarizing',
	'analyzing',
	'completed',
	'failed'
);

--> statement-breakpoint
CREATE TYPE "public"."ReactionType" AS ENUM(
	'like',
	'love',
	'laugh',
	'surprised',
	'sad',
	'angry',
	'thinking',
	'celebrate'
);

--> statement-breakpoint
CREATE TYPE "public"."ReportCategory" AS ENUM(
	'inappropriate',
	'spam',
	'copyright',
	'harassment',
	'other'
);

--> statement-breakpoint
CREATE TYPE "public"."ReportResolution" AS ENUM(
	'content_removed',
	'user_warned',
	'user_suspended',
	'no_action'
);

--> statement-breakpoint
CREATE TYPE "public"."ReportResourceType" AS ENUM('video', 'comment', 'user');

--> statement-breakpoint
CREATE TYPE "public"."ReportStatus" AS ENUM('pending', 'reviewing', 'resolved', 'dismissed');

--> statement-breakpoint
CREATE TYPE "public"."SubscriptionStatus" AS ENUM(
	'active',
	'canceled',
	'past_due',
	'trialing',
	'incomplete',
	'incomplete_expired',
	'unpaid'
);

--> statement-breakpoint
CREATE TYPE "public"."TopicTrend" AS ENUM('rising', 'stable', 'declining');

--> statement-breakpoint
CREATE TYPE "public"."UserRole" AS ENUM('user', 'admin');

--> statement-breakpoint
CREATE TYPE "public"."VideoShareLinkAccess" AS ENUM('view', 'comment', 'download');

--> statement-breakpoint
CREATE TYPE "public"."VideoShareLinkStatus" AS ENUM('active', 'expired', 'revoked');

--> statement-breakpoint
CREATE TYPE "public"."VideoViewSource" AS ENUM('direct', 'share_link', 'embed');

--> statement-breakpoint
CREATE TYPE "public"."WorkflowTemplateType" AS ENUM(
	'onboarding',
	'tutorial',
	'meeting_recap',
	'product_demo',
	'training',
	'marketing',
	'custom'
);

--> statement-breakpoint
CREATE TYPE "public"."ZapierWebhookEvent" AS ENUM(
	'video.uploaded',
	'video.processed',
	'video.shared',
	'comment.created',
	'comment.replied',
	'member.joined',
	'member.left'
);

--> statement-breakpoint
CREATE TABLE "activity_feed" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"actor_id" text,
	"activity_type" "ActivityType" NOT NULL,
	"resource_type" text,
	"resource_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "health_checks" (
	"id" text PRIMARY KEY NOT NULL,
	"service" "HealthCheckService" NOT NULL,
	"status" "HealthCheckStatus" NOT NULL,
	"latency_ms" integer NOT NULL,
	"error" text,
	"metadata" jsonb,
	"checked_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "zapier_webhook_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"webhook_id" text NOT NULL,
	"event" text NOT NULL,
	"payload" jsonb NOT NULL,
	"response_status" integer,
	"response_body" text,
	"success" boolean NOT NULL,
	"attempt_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"delivered_at" timestamp
);

--> statement-breakpoint
CREATE TABLE "zapier_webhooks" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"target_url" text NOT NULL,
	"events" jsonb NOT NULL,
	"secret" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_triggered_at" timestamp,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "ai_action_items" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"video_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"assignee" text,
	"assignee_user_id" text,
	"status" "ActionItemStatus" DEFAULT 'pending' NOT NULL,
	"priority" "ActionItemPriority" DEFAULT 'medium' NOT NULL,
	"due_date" timestamp,
	"completed_at" timestamp,
	"completed_by_id" text,
	"timestamp_start" integer,
	"timestamp_end" integer,
	"confidence" integer,
	"extracted_from" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "ai_topics" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"description" text,
	"mention_count" integer DEFAULT 1 NOT NULL,
	"video_count" integer DEFAULT 1 NOT NULL,
	"last_mentioned_at" timestamp DEFAULT now() NOT NULL,
	"first_mentioned_at" timestamp DEFAULT now() NOT NULL,
	"trend" "TopicTrend" DEFAULT 'stable' NOT NULL,
	"trend_score" integer DEFAULT 0,
	"keywords" jsonb DEFAULT '[]' :: jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ai_topics_org_name_unique" UNIQUE("organization_id", "normalized_name")
);

--> statement-breakpoint
CREATE TABLE "performance_metrics" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"metric_type" text NOT NULL,
	"metric_name" text NOT NULL,
	"value" integer NOT NULL,
	"metadata" jsonb,
	"user_id" text,
	"video_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "video_analytics_daily" (
	"id" text PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"date" timestamp NOT NULL,
	"view_count" integer DEFAULT 0,
	"unique_viewers" integer DEFAULT 0,
	"total_watch_time" integer DEFAULT 0,
	"avg_completion_percent" integer DEFAULT 0,
	CONSTRAINT "video_analytics_video_date_idx" UNIQUE("video_id", "date")
);

--> statement-breakpoint
CREATE TABLE "video_views" (
	"id" text PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"user_id" text,
	"session_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"watch_duration" integer DEFAULT 0,
	"completion_percent" integer DEFAULT 0,
	"source" "VideoViewSource" DEFAULT 'direct',
	"referrer" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "video_views_session_video_idx" UNIQUE("session_id", "video_id")
);

--> statement-breakpoint
CREATE TABLE "audit_log_exports" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"requested_by" text NOT NULL,
	"format" text DEFAULT 'csv' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"filters" jsonb,
	"download_url" text,
	"expires_at" timestamp,
	"error_message" text,
	"record_count" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);

--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text,
	"actor_email" text,
	"actor_type" text DEFAULT 'user' NOT NULL,
	"organization_id" text,
	"category" "AuditLogCategory" NOT NULL,
	"action" text NOT NULL,
	"description" text,
	"severity" "AuditLogSeverity" DEFAULT 'info' NOT NULL,
	"resource_type" text,
	"resource_id" text,
	"resource_name" text,
	"previous_value" jsonb,
	"new_value" jsonb,
	"ip_address" text,
	"user_agent" text,
	"request_id" text,
	"session_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);

--> statement-breakpoint
CREATE TABLE "apikeys" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"start" text,
	"prefix" text,
	"key" text NOT NULL,
	"user_id" text NOT NULL,
	"refill_interval" integer,
	"refill_amount" integer,
	"last_refill_at" timestamp,
	"enabled" boolean DEFAULT true,
	"rate_limit_enabled" boolean DEFAULT true,
	"rate_limit_time_window" integer DEFAULT 60000,
	"rate_limit_max" integer DEFAULT 100,
	"request_count" integer DEFAULT 0,
	"remaining" integer,
	"last_request" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"permissions" text,
	"metadata" text
);

--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"inviter_id" text NOT NULL
);

--> statement-breakpoint
CREATE TABLE "jwkss" (
	"id" text PRIMARY KEY NOT NULL,
	"public_key" text NOT NULL,
	"private_key" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"expires_at" timestamp
);

--> statement-breakpoint
CREATE TABLE "members" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp NOT NULL
);

--> statement-breakpoint
CREATE TABLE "oauth_access_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text,
	"client_id" text NOT NULL,
	"session_id" text,
	"user_id" text,
	"reference_id" text,
	"refresh_id" text,
	"expires_at" timestamp,
	"created_at" timestamp,
	"scopes" text [] NOT NULL,
	CONSTRAINT "oauth_access_tokens_token_unique" UNIQUE("token")
);

--> statement-breakpoint
CREATE TABLE "oauth_clients" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"client_secret" text,
	"disabled" boolean DEFAULT false,
	"skip_consent" boolean,
	"enable_end_session" boolean,
	"scopes" text [],
	"user_id" text,
	"created_at" timestamp,
	"updated_at" timestamp,
	"name" text,
	"uri" text,
	"icon" text,
	"contacts" text [],
	"tos" text,
	"policy" text,
	"software_id" text,
	"software_version" text,
	"software_statement" text,
	"redirect_uris" text [] NOT NULL,
	"post_logout_redirect_uris" text [],
	"token_endpoint_auth_method" text,
	"grant_types" text [],
	"response_types" text [],
	"public" boolean,
	"type" text,
	"reference_id" text,
	"metadata" jsonb,
	CONSTRAINT "oauth_clients_client_id_unique" UNIQUE("client_id")
);

--> statement-breakpoint
CREATE TABLE "oauth_consents" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"user_id" text,
	"reference_id" text,
	"scopes" text [] NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);

--> statement-breakpoint
CREATE TABLE "oauth_refresh_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"client_id" text NOT NULL,
	"session_id" text,
	"user_id" text NOT NULL,
	"reference_id" text,
	"expires_at" timestamp,
	"created_at" timestamp,
	"revoked" timestamp,
	"scopes" text [] NOT NULL
);

--> statement-breakpoint
CREATE TABLE "organization_roles" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"role" text NOT NULL,
	"permission" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp
);

--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"created_at" timestamp NOT NULL,
	"metadata" text,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);

--> statement-breakpoint
CREATE TABLE "passkeys" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"public_key" text NOT NULL,
	"user_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"counter" integer NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean NOT NULL,
	"transports" text,
	"created_at" timestamp,
	"aaguid" text
);

--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	"active_organization_id" text,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);

--> statement-breakpoint
CREATE TABLE "sso_providers" (
	"id" text PRIMARY KEY NOT NULL,
	"issuer" text NOT NULL,
	"oidc_config" text,
	"saml_config" text,
	"user_id" text,
	"provider_id" text NOT NULL,
	"organization_id" text,
	"domain" text NOT NULL,
	"domain_verified" boolean,
	CONSTRAINT "sso_providers_provider_id_unique" UNIQUE("provider_id")
);

--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"plan" text NOT NULL,
	"reference_id" text NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"status" text DEFAULT 'incomplete',
	"period_start" timestamp,
	"period_end" timestamp,
	"trial_start" timestamp,
	"trial_end" timestamp,
	"cancel_at_period_end" boolean DEFAULT false,
	"cancel_at" timestamp,
	"canceled_at" timestamp,
	"ended_at" timestamp,
	"seats" integer
);

--> statement-breakpoint
CREATE TABLE "two_factors" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL
);

--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	"stripe_customer_id" text,
	"two_factor_enabled" boolean DEFAULT false,
	"last_login_method" text,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"stripe_invoice_id" text,
	"stripe_payment_intent_id" text,
	"amount" integer NOT NULL,
	"amount_paid" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"status" "InvoiceStatus" NOT NULL,
	"pdf_url" text,
	"hosted_invoice_url" text,
	"period_start" timestamp,
	"period_end" timestamp,
	"due_date" timestamp,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_stripe_invoice_id_unique" UNIQUE("stripe_invoice_id")
);

--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"stripe_payment_method_id" text NOT NULL,
	"type" text NOT NULL,
	"brand" text,
	"last4" text,
	"exp_month" integer,
	"exp_year" integer,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_methods_stripe_payment_method_id_unique" UNIQUE("stripe_payment_method_id")
);

--> statement-breakpoint
CREATE TABLE "plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"stripe_price_id_monthly" text,
	"stripe_price_id_yearly" text,
	"price_monthly" integer DEFAULT 0 NOT NULL,
	"price_yearly" integer,
	"limits" jsonb NOT NULL,
	"features" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "processed_webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"source" text DEFAULT 'stripe' NOT NULL,
	"processed_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "processed_webhook_events_event_id_unique" UNIQUE("event_id")
);

--> statement-breakpoint
CREATE TABLE "usage" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"storage_used" bigint DEFAULT 0 NOT NULL,
	"videos_uploaded" integer DEFAULT 0 NOT NULL,
	"bandwidth_used" bigint DEFAULT 0 NOT NULL,
	"ai_requests" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "usage_organization_id_period_start_unique" UNIQUE("organization_id", "period_start")
);

--> statement-breakpoint
CREATE TABLE "highlight_reels" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"clip_ids" jsonb DEFAULT '[]' :: jsonb NOT NULL,
	"storage_key" text,
	"thumbnail_url" text,
	"duration" integer,
	"status" "HighlightReelStatus" DEFAULT 'draft' NOT NULL,
	"processing_error" text,
	"config" jsonb,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "quote_cards" (
	"id" text PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"quote_text" text NOT NULL,
	"speaker" text,
	"timestamp_seconds" integer,
	"template" jsonb,
	"image_url" text,
	"storage_key" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "video_clips" (
	"id" text PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"moment_id" text,
	"title" text NOT NULL,
	"description" text,
	"start_time" integer NOT NULL,
	"end_time" integer NOT NULL,
	"clip_type" "ClipType" DEFAULT 'manual' NOT NULL,
	"moment_type" "MomentType",
	"storage_key" text,
	"thumbnail_url" text,
	"status" "ClipStatus" DEFAULT 'pending' NOT NULL,
	"processing_error" text,
	"transcript_excerpt" text,
	"metadata" jsonb,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "video_moments" (
	"id" text PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"start_time" integer NOT NULL,
	"end_time" integer NOT NULL,
	"moment_type" "MomentType" NOT NULL,
	"confidence" integer DEFAULT 0 NOT NULL,
	"transcript_excerpt" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "comment_reactions" (
	"id" text PRIMARY KEY NOT NULL,
	"comment_id" text NOT NULL,
	"user_id" text NOT NULL,
	"reaction_type" "ReactionType" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "comment_reactions_comment_id_user_id_reaction_type_unique" UNIQUE("comment_id", "user_id", "reaction_type")
);

--> statement-breakpoint
CREATE TABLE "comments" (
	"id" text PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"timestamp" text,
	"author_id" text NOT NULL,
	"video_id" text NOT NULL,
	"parent_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "code_links" (
	"id" text PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"link_type" "CodeLinkType" NOT NULL,
	"github_repo" text NOT NULL,
	"github_ref" text NOT NULL,
	"github_url" text,
	"context" text,
	"auto_detected" boolean DEFAULT false NOT NULL,
	"timestamp_start" integer,
	"timestamp_end" integer,
	"created_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "github_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"integration_id" text NOT NULL,
	"installation_id" text,
	"repositories" jsonb,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	"last_sync" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "imported_meetings" (
	"id" text PRIMARY KEY NOT NULL,
	"integration_id" text NOT NULL,
	"video_id" text,
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
CREATE TABLE "integrations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
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
CREATE TABLE "decision_links" (
	"id" text PRIMARY KEY NOT NULL,
	"decision_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"entity_ref" text,
	"link_type" text NOT NULL,
	"url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "decision_links_unique" UNIQUE(
		"decision_id",
		"entity_type",
		"entity_id",
		"link_type"
	)
);

--> statement-breakpoint
CREATE TABLE "decision_participants" (
	"id" text PRIMARY KEY NOT NULL,
	"decision_id" text NOT NULL,
	"user_id" text,
	"role" "ParticipantRole" DEFAULT 'participant' NOT NULL,
	"speaker_name" text,
	"attributed_text" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"video_id" text NOT NULL,
	"timestamp_start" integer,
	"timestamp_end" integer,
	"summary" text NOT NULL,
	"context" text,
	"reasoning" text,
	"status" "DecisionStatus" DEFAULT 'decided' NOT NULL,
	"decision_type" "DecisionType" DEFAULT 'other' NOT NULL,
	"confidence" integer,
	"tags" jsonb DEFAULT '[]' :: jsonb,
	"embedding_vector" vector(1536),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "knowledge_edges" (
	"id" text PRIMARY KEY NOT NULL,
	"source_node_id" text NOT NULL,
	"target_node_id" text NOT NULL,
	"relationship" text NOT NULL,
	"weight" integer DEFAULT 100,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_edges_unique" UNIQUE("source_node_id", "target_node_id", "relationship")
);

--> statement-breakpoint
CREATE TABLE "knowledge_nodes" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"type" "KnowledgeNodeType" NOT NULL,
	"external_id" text,
	"name" text NOT NULL,
	"description" text,
	"embedding_vector" vector(1536),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_nodes_org_external_unique" UNIQUE("organization_id", "external_id")
);

--> statement-breakpoint
CREATE TABLE "consent_audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"action" "ConsentAction" NOT NULL,
	"details" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "data_export_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"download_url" text,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);

--> statement-breakpoint
CREATE TABLE "legal_consents" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"document_type" "LegalDocumentType" NOT NULL,
	"version" text NOT NULL,
	"accepted_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	CONSTRAINT "legal_consents_user_id_document_type_version_unique" UNIQUE("user_id", "document_type", "version")
);

--> statement-breakpoint
CREATE TABLE "reports" (
	"id" text PRIMARY KEY NOT NULL,
	"reporter_id" text,
	"resource_type" "ReportResourceType" NOT NULL,
	"resource_id" text NOT NULL,
	"category" "ReportCategory" NOT NULL,
	"description" text,
	"status" "ReportStatus" DEFAULT 'pending' NOT NULL,
	"resolution" "ReportResolution",
	"resolved_by_id" text,
	"resolved_at" timestamp,
	"resolution_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "NotificationType" NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"resource_type" text,
	"resource_id" text,
	"actor_id" text,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "saved_searches" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"query" text NOT NULL,
	"filters" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "saved_searches_user_name_unique" UNIQUE("user_id", "organization_id", "name")
);

--> statement-breakpoint
CREATE TABLE "search_history" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"query" text NOT NULL,
	"filters" jsonb,
	"results_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "transcript_chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"text" text NOT NULL,
	"token_count" integer,
	"timestamp_start" integer,
	"timestamp_end" integer,
	"speakers" jsonb,
	"embedding" vector(1536),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "transcript_chunks_unique_index" UNIQUE("video_id", "chunk_index")
);

--> statement-breakpoint
CREATE TABLE "video_share_links" (
	"id" text PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"created_by" text NOT NULL,
	"access_level" "VideoShareLinkAccess" DEFAULT 'view' NOT NULL,
	"password" text,
	"expires_at" timestamp,
	"max_views" integer,
	"view_count" integer DEFAULT 0,
	"status" "VideoShareLinkStatus" DEFAULT 'active',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_accessed_at" timestamp
);

--> statement-breakpoint
CREATE TABLE "speaker_analytics" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"speaker_profile_id" text NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"video_count" integer DEFAULT 0 NOT NULL,
	"total_speaking_time" integer DEFAULT 0 NOT NULL,
	"avg_speaking_percentage" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "speaker_analytics_profile_period_unique" UNIQUE("speaker_profile_id", "period_start")
);

--> statement-breakpoint
CREATE TABLE "speaker_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text,
	"display_name" text NOT NULL,
	"voice_embedding" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "speaker_profiles_org_user_unique" UNIQUE("organization_id", "user_id")
);

--> statement-breakpoint
CREATE TABLE "speaker_segments" (
	"id" text PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"video_speaker_id" text NOT NULL,
	"start_time" integer NOT NULL,
	"end_time" integer NOT NULL,
	"transcript_text" text,
	"confidence" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "video_speakers" (
	"id" text PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"speaker_profile_id" text,
	"speaker_label" text NOT NULL,
	"total_speaking_time" integer DEFAULT 0 NOT NULL,
	"segment_count" integer DEFAULT 0 NOT NULL,
	"speaking_percentage" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "video_speakers_video_label_unique" UNIQUE("video_id", "speaker_label")
);

--> statement-breakpoint
CREATE TABLE "user_extensions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tos_accepted_at" timestamp,
	"tos_version" text,
	"privacy_accepted_at" timestamp,
	"privacy_version" text,
	"marketing_consent_at" timestamp,
	"marketing_consent" boolean DEFAULT false,
	"deletion_requested_at" timestamp,
	"deletion_scheduled_for" timestamp,
	"warned_at" timestamp,
	"warning_reason" text,
	"suspended_until" timestamp,
	"suspension_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_extensions_user_id_unique" UNIQUE("user_id")
);

--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"email_notifications" boolean DEFAULT true NOT NULL,
	"email_comment_replies" boolean DEFAULT true NOT NULL,
	"email_mentions" boolean DEFAULT true NOT NULL,
	"email_video_processing" boolean DEFAULT true NOT NULL,
	"email_weekly_digest" boolean DEFAULT false NOT NULL,
	"email_product_updates" boolean DEFAULT true NOT NULL,
	"push_notifications" boolean DEFAULT true NOT NULL,
	"theme" text DEFAULT 'system' NOT NULL,
	"show_activity_status" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_user_id_unique" UNIQUE("user_id")
);

--> statement-breakpoint
CREATE TABLE "channels" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"organization_id" text NOT NULL,
	"member_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "collections" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"thumbnail_url" text,
	"organization_id" text NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "series_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"series_id" text NOT NULL,
	"last_video_id" text,
	"last_position" integer DEFAULT 0 NOT NULL,
	"completed_video_ids" jsonb DEFAULT '[]' :: jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "series_progress_user_id_series_id_unique" UNIQUE("user_id", "series_id")
);

--> statement-breakpoint
CREATE TABLE "series_videos" (
	"id" text PRIMARY KEY NOT NULL,
	"series_id" text NOT NULL,
	"video_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "series_videos_series_id_video_id_unique" UNIQUE("series_id", "video_id")
);

--> statement-breakpoint
CREATE TABLE "user_presence" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"video_id" text,
	"organization_id" text NOT NULL,
	"status" text DEFAULT 'online' NOT NULL,
	"current_time" integer,
	"last_seen" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb
);

--> statement-breakpoint
CREATE TABLE "video_chapters" (
	"id" text PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"start_time" integer NOT NULL,
	"end_time" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "video_code_snippets" (
	"id" text PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"language" text,
	"code" text NOT NULL,
	"title" text,
	"description" text,
	"timestamp" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "video_progresses" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"video_id" text NOT NULL,
	"current_time" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"last_watched_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "video_progresses_user_id_video_id_unique" UNIQUE("user_id", "video_id")
);

--> statement-breakpoint
CREATE TABLE "videos" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"duration" text NOT NULL,
	"thumbnail_url" text,
	"video_url" text,
	"author_id" text,
	"organization_id" text NOT NULL,
	"channel_id" text,
	"collection_id" text,
	"transcript" text,
	"transcript_segments" jsonb,
	"processing_status" "ProcessingStatus" DEFAULT 'pending' NOT NULL,
	"processing_error" text,
	"ai_summary" text,
	"ai_tags" jsonb,
	"ai_action_items" jsonb,
	"search_vector" "tsvector" GENERATED ALWAYS AS (
		to_tsvector(
			'english',
			coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(transcript, '')
		)
	) STORED,
	"deleted_at" timestamp,
	"retention_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "watch_later" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"video_id" text NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"notes" text,
	CONSTRAINT "watch_later_user_id_video_id_unique" UNIQUE("user_id", "video_id")
);

--> statement-breakpoint
CREATE TABLE "video_workflow_history" (
	"id" text PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"template_id" text,
	"template_name" text NOT NULL,
	"applied_config" jsonb NOT NULL,
	"applied_at" timestamp DEFAULT now() NOT NULL,
	"applied_by_id" text
);

--> statement-breakpoint
CREATE TABLE "workflow_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "WorkflowTemplateType" DEFAULT 'custom' NOT NULL,
	"icon" text,
	"config" jsonb NOT NULL,
	"organization_id" text,
	"created_by_id" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
ALTER TABLE
	"activity_feed"
ADD
	CONSTRAINT "activity_feed_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"activity_feed"
ADD
	CONSTRAINT "activity_feed_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE
set
	null ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"zapier_webhook_deliveries"
ADD
	CONSTRAINT "zapier_webhook_deliveries_webhook_id_zapier_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."zapier_webhooks"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"zapier_webhooks"
ADD
	CONSTRAINT "zapier_webhooks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"zapier_webhooks"
ADD
	CONSTRAINT "zapier_webhooks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"ai_action_items"
ADD
	CONSTRAINT "ai_action_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"ai_action_items"
ADD
	CONSTRAINT "ai_action_items_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"ai_action_items"
ADD
	CONSTRAINT "ai_action_items_assignee_user_id_users_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."users"("id") ON DELETE
set
	null ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"ai_action_items"
ADD
	CONSTRAINT "ai_action_items_completed_by_id_users_id_fk" FOREIGN KEY ("completed_by_id") REFERENCES "public"."users"("id") ON DELETE
set
	null ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"ai_topics"
ADD
	CONSTRAINT "ai_topics_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"performance_metrics"
ADD
	CONSTRAINT "performance_metrics_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"performance_metrics"
ADD
	CONSTRAINT "performance_metrics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE
set
	null ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"performance_metrics"
ADD
	CONSTRAINT "performance_metrics_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE
set
	null ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"video_analytics_daily"
ADD
	CONSTRAINT "video_analytics_daily_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"video_views"
ADD
	CONSTRAINT "video_views_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"video_views"
ADD
	CONSTRAINT "video_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE
set
	null ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"video_views"
ADD
	CONSTRAINT "video_views_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"audit_log_exports"
ADD
	CONSTRAINT "audit_log_exports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"audit_log_exports"
ADD
	CONSTRAINT "audit_log_exports_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"audit_logs"
ADD
	CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE
set
	null ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"audit_logs"
ADD
	CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE
set
	null ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"accounts"
ADD
	CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"apikeys"
ADD
	CONSTRAINT "apikeys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"invitations"
ADD
	CONSTRAINT "invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"invitations"
ADD
	CONSTRAINT "invitations_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"members"
ADD
	CONSTRAINT "members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"members"
ADD
	CONSTRAINT "members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"oauth_access_tokens"
ADD
	CONSTRAINT "oauth_access_tokens_client_id_oauth_clients_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("client_id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"oauth_access_tokens"
ADD
	CONSTRAINT "oauth_access_tokens_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE
set
	null ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"oauth_access_tokens"
ADD
	CONSTRAINT "oauth_access_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"oauth_access_tokens"
ADD
	CONSTRAINT "oauth_access_tokens_refresh_id_oauth_refresh_tokens_id_fk" FOREIGN KEY ("refresh_id") REFERENCES "public"."oauth_refresh_tokens"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"oauth_clients"
ADD
	CONSTRAINT "oauth_clients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"oauth_consents"
ADD
	CONSTRAINT "oauth_consents_client_id_oauth_clients_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("client_id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"oauth_consents"
ADD
	CONSTRAINT "oauth_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"oauth_refresh_tokens"
ADD
	CONSTRAINT "oauth_refresh_tokens_client_id_oauth_clients_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("client_id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"oauth_refresh_tokens"
ADD
	CONSTRAINT "oauth_refresh_tokens_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE
set
	null ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"oauth_refresh_tokens"
ADD
	CONSTRAINT "oauth_refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"organization_roles"
ADD
	CONSTRAINT "organization_roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"passkeys"
ADD
	CONSTRAINT "passkeys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"sessions"
ADD
	CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"sso_providers"
ADD
	CONSTRAINT "sso_providers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"two_factors"
ADD
	CONSTRAINT "two_factors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"invoices"
ADD
	CONSTRAINT "invoices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"payment_methods"
ADD
	CONSTRAINT "payment_methods_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"usage"
ADD
	CONSTRAINT "usage_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"highlight_reels"
ADD
	CONSTRAINT "highlight_reels_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"highlight_reels"
ADD
	CONSTRAINT "highlight_reels_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE
set
	null ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"quote_cards"
ADD
	CONSTRAINT "quote_cards_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"quote_cards"
ADD
	CONSTRAINT "quote_cards_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"quote_cards"
ADD
	CONSTRAINT "quote_cards_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE
set
	null ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"video_clips"
ADD
	CONSTRAINT "video_clips_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"video_clips"
ADD
	CONSTRAINT "video_clips_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"video_clips"
ADD
	CONSTRAINT "video_clips_moment_id_video_moments_id_fk" FOREIGN KEY ("moment_id") REFERENCES "public"."video_moments"("id") ON DELETE
set
	null ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"video_clips"
ADD
	CONSTRAINT "video_clips_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE
set
	null ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"video_moments"
ADD
	CONSTRAINT "video_moments_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"video_moments"
ADD
	CONSTRAINT "video_moments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"comment_reactions"
ADD
	CONSTRAINT "comment_reactions_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"comment_reactions"
ADD
	CONSTRAINT "comment_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"comments"
ADD
	CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"comments"
ADD
	CONSTRAINT "comments_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"code_links"
ADD
	CONSTRAINT "code_links_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"code_links"
ADD
	CONSTRAINT "code_links_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE
set
	null ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"github_connections"
ADD
	CONSTRAINT "github_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"github_connections"
ADD
	CONSTRAINT "github_connections_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"imported_meetings"
ADD
	CONSTRAINT "imported_meetings_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"imported_meetings"
ADD
	CONSTRAINT "imported_meetings_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE
set
	null ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"integrations"
ADD
	CONSTRAINT "integrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"integrations"
ADD
	CONSTRAINT "integrations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"decision_links"
ADD
	CONSTRAINT "decision_links_decision_id_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decisions"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"decision_participants"
ADD
	CONSTRAINT "decision_participants_decision_id_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decisions"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"decision_participants"
ADD
	CONSTRAINT "decision_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE
set
	null ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"decisions"
ADD
	CONSTRAINT "decisions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"decisions"
ADD
	CONSTRAINT "decisions_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"knowledge_edges"
ADD
	CONSTRAINT "knowledge_edges_source_node_id_knowledge_nodes_id_fk" FOREIGN KEY ("source_node_id") REFERENCES "public"."knowledge_nodes"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"knowledge_edges"
ADD
	CONSTRAINT "knowledge_edges_target_node_id_knowledge_nodes_id_fk" FOREIGN KEY ("target_node_id") REFERENCES "public"."knowledge_nodes"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"knowledge_nodes"
ADD
	CONSTRAINT "knowledge_nodes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"consent_audit_log"
ADD
	CONSTRAINT "consent_audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"data_export_requests"
ADD
	CONSTRAINT "data_export_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"legal_consents"
ADD
	CONSTRAINT "legal_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"reports"
ADD
	CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE
set
	null ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"reports"
ADD
	CONSTRAINT "reports_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE
set
	null ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"notifications"
ADD
	CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"notifications"
ADD
	CONSTRAINT "notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE
set
	null ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"saved_searches"
ADD
	CONSTRAINT "saved_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"saved_searches"
ADD
	CONSTRAINT "saved_searches_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"search_history"
ADD
	CONSTRAINT "search_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"search_history"
ADD
	CONSTRAINT "search_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"transcript_chunks"
ADD
	CONSTRAINT "transcript_chunks_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"transcript_chunks"
ADD
	CONSTRAINT "transcript_chunks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"video_share_links"
ADD
	CONSTRAINT "video_share_links_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"video_share_links"
ADD
	CONSTRAINT "video_share_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"speaker_analytics"
ADD
	CONSTRAINT "speaker_analytics_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"speaker_analytics"
ADD
	CONSTRAINT "speaker_analytics_speaker_profile_id_speaker_profiles_id_fk" FOREIGN KEY ("speaker_profile_id") REFERENCES "public"."speaker_profiles"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"speaker_profiles"
ADD
	CONSTRAINT "speaker_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"speaker_profiles"
ADD
	CONSTRAINT "speaker_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE
set
	null ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"speaker_segments"
ADD
	CONSTRAINT "speaker_segments_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"speaker_segments"
ADD
	CONSTRAINT "speaker_segments_video_speaker_id_video_speakers_id_fk" FOREIGN KEY ("video_speaker_id") REFERENCES "public"."video_speakers"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"video_speakers"
ADD
	CONSTRAINT "video_speakers_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"video_speakers"
ADD
	CONSTRAINT "video_speakers_speaker_profile_id_speaker_profiles_id_fk" FOREIGN KEY ("speaker_profile_id") REFERENCES "public"."speaker_profiles"("id") ON DELETE
set
	null ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"user_extensions"
ADD
	CONSTRAINT "user_extensions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"user_preferences"
ADD
	CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"channels"
ADD
	CONSTRAINT "channels_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"collections"
ADD
	CONSTRAINT "collections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"collections"
ADD
	CONSTRAINT "collections_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE
set
	null ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"series_progress"
ADD
	CONSTRAINT "series_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"series_progress"
ADD
	CONSTRAINT "series_progress_series_id_collections_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"series_progress"
ADD
	CONSTRAINT "series_progress_last_video_id_videos_id_fk" FOREIGN KEY ("last_video_id") REFERENCES "public"."videos"("id") ON DELETE
set
	null ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"series_videos"
ADD
	CONSTRAINT "series_videos_series_id_collections_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"series_videos"
ADD
	CONSTRAINT "series_videos_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"user_presence"
ADD
	CONSTRAINT "user_presence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"user_presence"
ADD
	CONSTRAINT "user_presence_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"user_presence"
ADD
	CONSTRAINT "user_presence_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"video_chapters"
ADD
	CONSTRAINT "video_chapters_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"video_code_snippets"
ADD
	CONSTRAINT "video_code_snippets_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"video_progresses"
ADD
	CONSTRAINT "video_progresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"video_progresses"
ADD
	CONSTRAINT "video_progresses_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"videos"
ADD
	CONSTRAINT "videos_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE
set
	null ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"videos"
ADD
	CONSTRAINT "videos_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"videos"
ADD
	CONSTRAINT "videos_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE
set
	null ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"videos"
ADD
	CONSTRAINT "videos_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE
set
	null ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"watch_later"
ADD
	CONSTRAINT "watch_later_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"watch_later"
ADD
	CONSTRAINT "watch_later_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"video_workflow_history"
ADD
	CONSTRAINT "video_workflow_history_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"video_workflow_history"
ADD
	CONSTRAINT "video_workflow_history_template_id_workflow_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."workflow_templates"("id") ON DELETE
set
	null ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"video_workflow_history"
ADD
	CONSTRAINT "video_workflow_history_applied_by_id_users_id_fk" FOREIGN KEY ("applied_by_id") REFERENCES "public"."users"("id") ON DELETE
set
	null ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"workflow_templates"
ADD
	CONSTRAINT "workflow_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE
	"workflow_templates"
ADD
	CONSTRAINT "workflow_templates_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE
set
	null ON UPDATE no action;

--> statement-breakpoint
CREATE INDEX "activity_feed_org_created_idx" ON "activity_feed" USING btree ("organization_id", "created_at");

--> statement-breakpoint
CREATE INDEX "activity_feed_actor_idx" ON "activity_feed" USING btree ("actor_id");

--> statement-breakpoint
CREATE INDEX "activity_feed_resource_idx" ON "activity_feed" USING btree ("resource_type", "resource_id");

--> statement-breakpoint
CREATE INDEX "health_checks_service_checked_at_idx" ON "health_checks" USING btree ("service", "checked_at");

--> statement-breakpoint
CREATE INDEX "health_checks_status_idx" ON "health_checks" USING btree ("status");

--> statement-breakpoint
CREATE INDEX "zapier_webhook_deliveries_webhook_idx" ON "zapier_webhook_deliveries" USING btree ("webhook_id");

--> statement-breakpoint
CREATE INDEX "zapier_webhook_deliveries_created_idx" ON "zapier_webhook_deliveries" USING btree ("created_at");

--> statement-breakpoint
CREATE INDEX "zapier_webhooks_org_idx" ON "zapier_webhooks" USING btree ("organization_id");

--> statement-breakpoint
CREATE INDEX "zapier_webhooks_active_idx" ON "zapier_webhooks" USING btree ("is_active");

--> statement-breakpoint
CREATE INDEX "ai_action_items_org_idx" ON "ai_action_items" USING btree ("organization_id", "status");

--> statement-breakpoint
CREATE INDEX "ai_action_items_video_idx" ON "ai_action_items" USING btree ("video_id");

--> statement-breakpoint
CREATE INDEX "ai_action_items_assignee_idx" ON "ai_action_items" USING btree ("assignee_user_id");

--> statement-breakpoint
CREATE INDEX "ai_action_items_status_idx" ON "ai_action_items" USING btree ("status", "priority");

--> statement-breakpoint
CREATE INDEX "ai_action_items_due_date_idx" ON "ai_action_items" USING btree ("due_date");

--> statement-breakpoint
CREATE INDEX "ai_topics_org_idx" ON "ai_topics" USING btree ("organization_id");

--> statement-breakpoint
CREATE INDEX "ai_topics_name_idx" ON "ai_topics" USING btree ("organization_id", "normalized_name");

--> statement-breakpoint
CREATE INDEX "ai_topics_trend_idx" ON "ai_topics" USING btree ("organization_id", "trend");

--> statement-breakpoint
CREATE INDEX "ai_topics_mention_idx" ON "ai_topics" USING btree ("organization_id", "mention_count");

--> statement-breakpoint
CREATE INDEX "performance_metrics_org_type_idx" ON "performance_metrics" USING btree ("organization_id", "metric_type", "created_at");

--> statement-breakpoint
CREATE INDEX "video_views_video_idx" ON "video_views" USING btree ("video_id");

--> statement-breakpoint
CREATE INDEX "video_views_org_date_idx" ON "video_views" USING btree ("organization_id", "created_at");

--> statement-breakpoint
CREATE INDEX "audit_log_exports_org_idx" ON "audit_log_exports" USING btree ("organization_id");

--> statement-breakpoint
CREATE INDEX "audit_log_exports_status_idx" ON "audit_log_exports" USING btree ("status");

--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_id");

--> statement-breakpoint
CREATE INDEX "audit_logs_org_idx" ON "audit_logs" USING btree ("organization_id");

--> statement-breakpoint
CREATE INDEX "audit_logs_category_idx" ON "audit_logs" USING btree ("category");

--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");

--> statement-breakpoint
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs" USING btree ("resource_type", "resource_id");

--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");

--> statement-breakpoint
CREATE INDEX "audit_logs_org_created_idx" ON "audit_logs" USING btree ("organization_id", "created_at");

--> statement-breakpoint
CREATE INDEX "accounts_userId_idx" ON "accounts" USING btree ("user_id");

--> statement-breakpoint
CREATE INDEX "apikeys_key_idx" ON "apikeys" USING btree ("key");

--> statement-breakpoint
CREATE INDEX "apikeys_userId_idx" ON "apikeys" USING btree ("user_id");

--> statement-breakpoint
CREATE INDEX "invitations_organizationId_idx" ON "invitations" USING btree ("organization_id");

--> statement-breakpoint
CREATE INDEX "invitations_email_idx" ON "invitations" USING btree ("email");

--> statement-breakpoint
CREATE INDEX "members_organizationId_idx" ON "members" USING btree ("organization_id");

--> statement-breakpoint
CREATE INDEX "members_userId_idx" ON "members" USING btree ("user_id");

--> statement-breakpoint
CREATE INDEX "organizationRoles_organizationId_idx" ON "organization_roles" USING btree ("organization_id");

--> statement-breakpoint
CREATE INDEX "organizationRoles_role_idx" ON "organization_roles" USING btree ("role");

--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_uidx" ON "organizations" USING btree ("slug");

--> statement-breakpoint
CREATE INDEX "passkeys_userId_idx" ON "passkeys" USING btree ("user_id");

--> statement-breakpoint
CREATE INDEX "passkeys_credentialID_idx" ON "passkeys" USING btree ("credential_id");

--> statement-breakpoint
CREATE INDEX "sessions_userId_idx" ON "sessions" USING btree ("user_id");

--> statement-breakpoint
CREATE INDEX "twoFactors_secret_idx" ON "two_factors" USING btree ("secret");

--> statement-breakpoint
CREATE INDEX "twoFactors_userId_idx" ON "two_factors" USING btree ("user_id");

--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");

--> statement-breakpoint
CREATE INDEX "invoices_organization_id_idx" ON "invoices" USING btree ("organization_id");

--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");

--> statement-breakpoint
CREATE INDEX "payment_methods_organization_id_idx" ON "payment_methods" USING btree ("organization_id");

--> statement-breakpoint
CREATE INDEX "processed_webhook_events_event_id_idx" ON "processed_webhook_events" USING btree ("event_id");

--> statement-breakpoint
CREATE INDEX "processed_webhook_events_expires_at_idx" ON "processed_webhook_events" USING btree ("expires_at");

--> statement-breakpoint
CREATE INDEX "processed_webhook_events_source_type_idx" ON "processed_webhook_events" USING btree ("source", "event_type");

--> statement-breakpoint
CREATE INDEX "usage_organization_id_idx" ON "usage" USING btree ("organization_id");

--> statement-breakpoint
CREATE INDEX "highlight_reels_org_idx" ON "highlight_reels" USING btree ("organization_id");

--> statement-breakpoint
CREATE INDEX "highlight_reels_status_idx" ON "highlight_reels" USING btree ("status");

--> statement-breakpoint
CREATE INDEX "highlight_reels_created_by_idx" ON "highlight_reels" USING btree ("created_by");

--> statement-breakpoint
CREATE INDEX "quote_cards_video_idx" ON "quote_cards" USING btree ("video_id");

--> statement-breakpoint
CREATE INDEX "quote_cards_org_idx" ON "quote_cards" USING btree ("organization_id");

--> statement-breakpoint
CREATE INDEX "video_clips_video_idx" ON "video_clips" USING btree ("video_id");

--> statement-breakpoint
CREATE INDEX "video_clips_video_created_idx" ON "video_clips" USING btree ("video_id", "created_at");

--> statement-breakpoint
CREATE INDEX "video_clips_status_idx" ON "video_clips" USING btree ("status");

--> statement-breakpoint
CREATE INDEX "video_clips_org_idx" ON "video_clips" USING btree ("organization_id");

--> statement-breakpoint
CREATE INDEX "video_moments_video_idx" ON "video_moments" USING btree ("video_id");

--> statement-breakpoint
CREATE INDEX "video_moments_video_start_idx" ON "video_moments" USING btree ("video_id", "start_time");

--> statement-breakpoint
CREATE INDEX "video_moments_type_idx" ON "video_moments" USING btree ("moment_type");

--> statement-breakpoint
CREATE INDEX "comment_reactions_comment_idx" ON "comment_reactions" USING btree ("comment_id");

--> statement-breakpoint
CREATE INDEX "comments_video_id_idx" ON "comments" USING btree ("video_id");

--> statement-breakpoint
CREATE INDEX "comments_author_id_idx" ON "comments" USING btree ("author_id");

--> statement-breakpoint
CREATE INDEX "comments_parent_id_idx" ON "comments" USING btree ("parent_id");

--> statement-breakpoint
CREATE INDEX "code_links_video_idx" ON "code_links" USING btree ("video_id");

--> statement-breakpoint
CREATE INDEX "code_links_repo_idx" ON "code_links" USING btree ("github_repo");

--> statement-breakpoint
CREATE INDEX "code_links_ref_idx" ON "code_links" USING btree ("github_repo", "link_type", "github_ref");

--> statement-breakpoint
CREATE INDEX "code_links_type_idx" ON "code_links" USING btree ("link_type");

--> statement-breakpoint
CREATE INDEX "github_connections_org_idx" ON "github_connections" USING btree ("organization_id");

--> statement-breakpoint
CREATE INDEX "github_connections_integration_idx" ON "github_connections" USING btree ("integration_id");

--> statement-breakpoint
CREATE INDEX "imported_meetings_integration_id_idx" ON "imported_meetings" USING btree ("integration_id");

--> statement-breakpoint
CREATE INDEX "imported_meetings_video_id_idx" ON "imported_meetings" USING btree ("video_id");

--> statement-breakpoint
CREATE INDEX "imported_meetings_import_status_idx" ON "imported_meetings" USING btree ("import_status");

--> statement-breakpoint
CREATE INDEX "integrations_user_id_idx" ON "integrations" USING btree ("user_id");

--> statement-breakpoint
CREATE INDEX "integrations_organization_id_idx" ON "integrations" USING btree ("organization_id");

--> statement-breakpoint
CREATE INDEX "decision_links_decision_idx" ON "decision_links" USING btree ("decision_id");

--> statement-breakpoint
CREATE INDEX "decision_links_entity_idx" ON "decision_links" USING btree ("entity_type", "entity_id");

--> statement-breakpoint
CREATE INDEX "decision_participants_decision_idx" ON "decision_participants" USING btree ("decision_id");

--> statement-breakpoint
CREATE INDEX "decision_participants_user_idx" ON "decision_participants" USING btree ("user_id");

--> statement-breakpoint
CREATE INDEX "decisions_org_idx" ON "decisions" USING btree ("organization_id", "created_at");

--> statement-breakpoint
CREATE INDEX "decisions_video_idx" ON "decisions" USING btree ("video_id");

--> statement-breakpoint
CREATE INDEX "decisions_status_idx" ON "decisions" USING btree ("status");

--> statement-breakpoint
CREATE INDEX "decisions_type_idx" ON "decisions" USING btree ("decision_type");

--> statement-breakpoint
CREATE INDEX "knowledge_edges_source_idx" ON "knowledge_edges" USING btree ("source_node_id");

--> statement-breakpoint
CREATE INDEX "knowledge_edges_target_idx" ON "knowledge_edges" USING btree ("target_node_id");

--> statement-breakpoint
CREATE INDEX "knowledge_edges_relationship_idx" ON "knowledge_edges" USING btree ("relationship");

--> statement-breakpoint
CREATE INDEX "knowledge_nodes_org_idx" ON "knowledge_nodes" USING btree ("organization_id");

--> statement-breakpoint
CREATE INDEX "knowledge_nodes_type_idx" ON "knowledge_nodes" USING btree ("type");

--> statement-breakpoint
CREATE INDEX "knowledge_nodes_external_idx" ON "knowledge_nodes" USING btree ("external_id");

--> statement-breakpoint
CREATE INDEX "consent_audit_log_user_idx" ON "consent_audit_log" USING btree ("user_id", "created_at");

--> statement-breakpoint
CREATE INDEX "data_export_requests_user_idx" ON "data_export_requests" USING btree ("user_id", "created_at");

--> statement-breakpoint
CREATE INDEX "legal_consents_user_doc_idx" ON "legal_consents" USING btree ("user_id", "document_type");

--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status", "created_at");

--> statement-breakpoint
CREATE INDEX "reports_resource_idx" ON "reports" USING btree ("resource_type", "resource_id");

--> statement-breakpoint
CREATE INDEX "reports_reporter_idx" ON "reports" USING btree ("reporter_id");

--> statement-breakpoint
CREATE INDEX "notifications_user_id_idx" ON "notifications" USING btree ("user_id");

--> statement-breakpoint
CREATE INDEX "notifications_user_read_idx" ON "notifications" USING btree ("user_id", "read");

--> statement-breakpoint
CREATE INDEX "notifications_actor_id_idx" ON "notifications" USING btree ("actor_id");

--> statement-breakpoint
CREATE INDEX "saved_searches_user_org_idx" ON "saved_searches" USING btree ("user_id", "organization_id");

--> statement-breakpoint
CREATE INDEX "search_history_user_org_idx" ON "search_history" USING btree ("user_id", "organization_id", "created_at");

--> statement-breakpoint
CREATE INDEX "transcript_chunks_video_idx" ON "transcript_chunks" USING btree ("video_id");

--> statement-breakpoint
CREATE INDEX "transcript_chunks_org_idx" ON "transcript_chunks" USING btree ("organization_id");

--> statement-breakpoint
CREATE INDEX "video_share_links_video_idx" ON "video_share_links" USING btree ("video_id");

--> statement-breakpoint
CREATE INDEX "video_share_links_status_idx" ON "video_share_links" USING btree ("status");

--> statement-breakpoint
CREATE INDEX "speaker_analytics_org_period_idx" ON "speaker_analytics" USING btree ("organization_id", "period_start");

--> statement-breakpoint
CREATE INDEX "speaker_analytics_profile_idx" ON "speaker_analytics" USING btree ("speaker_profile_id");

--> statement-breakpoint
CREATE INDEX "speaker_profiles_org_idx" ON "speaker_profiles" USING btree ("organization_id");

--> statement-breakpoint
CREATE INDEX "speaker_profiles_user_idx" ON "speaker_profiles" USING btree ("user_id");

--> statement-breakpoint
CREATE INDEX "speaker_segments_video_idx" ON "speaker_segments" USING btree ("video_id");

--> statement-breakpoint
CREATE INDEX "speaker_segments_speaker_idx" ON "speaker_segments" USING btree ("video_speaker_id");

--> statement-breakpoint
CREATE INDEX "speaker_segments_time_idx" ON "speaker_segments" USING btree ("video_id", "start_time");

--> statement-breakpoint
CREATE INDEX "video_speakers_video_idx" ON "video_speakers" USING btree ("video_id");

--> statement-breakpoint
CREATE INDEX "video_speakers_profile_idx" ON "video_speakers" USING btree ("speaker_profile_id");

--> statement-breakpoint
CREATE INDEX "user_extensions_user_id_idx" ON "user_extensions" USING btree ("user_id");

--> statement-breakpoint
CREATE INDEX "channels_organization_id_idx" ON "channels" USING btree ("organization_id");

--> statement-breakpoint
CREATE INDEX "collections_organization_id_idx" ON "collections" USING btree ("organization_id");

--> statement-breakpoint
CREATE INDEX "collections_created_by_id_idx" ON "collections" USING btree ("created_by_id");

--> statement-breakpoint
CREATE INDEX "series_progress_user_id_idx" ON "series_progress" USING btree ("user_id");

--> statement-breakpoint
CREATE INDEX "series_progress_series_id_idx" ON "series_progress" USING btree ("series_id");

--> statement-breakpoint
CREATE INDEX "series_videos_series_id_idx" ON "series_videos" USING btree ("series_id");

--> statement-breakpoint
CREATE INDEX "series_videos_video_id_idx" ON "series_videos" USING btree ("video_id");

--> statement-breakpoint
CREATE INDEX "user_presence_user_idx" ON "user_presence" USING btree ("user_id");

--> statement-breakpoint
CREATE INDEX "user_presence_video_idx" ON "user_presence" USING btree ("video_id");

--> statement-breakpoint
CREATE INDEX "user_presence_last_seen_idx" ON "user_presence" USING btree ("last_seen");

--> statement-breakpoint
CREATE INDEX "video_chapters_video_id_idx" ON "video_chapters" USING btree ("video_id");

--> statement-breakpoint
CREATE INDEX "video_code_snippets_video_id_idx" ON "video_code_snippets" USING btree ("video_id");

--> statement-breakpoint
CREATE INDEX "video_progresses_user_id_idx" ON "video_progresses" USING btree ("user_id");

--> statement-breakpoint
CREATE INDEX "video_progresses_video_id_idx" ON "video_progresses" USING btree ("video_id");

--> statement-breakpoint
CREATE INDEX "videos_organization_created_idx" ON "videos" USING btree ("organization_id", "created_at");

--> statement-breakpoint
CREATE INDEX "videos_author_id_idx" ON "videos" USING btree ("author_id");

--> statement-breakpoint
CREATE INDEX "videos_channel_id_idx" ON "videos" USING btree ("channel_id");

--> statement-breakpoint
CREATE INDEX "videos_collection_id_idx" ON "videos" USING btree ("collection_id");

--> statement-breakpoint
CREATE INDEX "videos_processing_status_idx" ON "videos" USING btree ("processing_status");

--> statement-breakpoint
CREATE INDEX "watch_later_user_idx" ON "watch_later" USING btree ("user_id", "added_at");

--> statement-breakpoint
CREATE INDEX "video_workflow_history_video_idx" ON "video_workflow_history" USING btree ("video_id");

--> statement-breakpoint
CREATE INDEX "video_workflow_history_template_idx" ON "video_workflow_history" USING btree ("template_id");