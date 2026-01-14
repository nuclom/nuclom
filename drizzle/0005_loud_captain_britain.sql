CREATE TYPE "public"."ChatMessageRole" AS ENUM('user', 'assistant', 'system', 'tool');--> statement-breakpoint
CREATE TABLE "chat_context" (
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
CREATE TABLE "chat_conversations" (
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
CREATE TABLE "chat_messages" (
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
ALTER TABLE "chat_context" ADD CONSTRAINT "chat_context_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_context_message_idx" ON "chat_context" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "chat_context_source_idx" ON "chat_context" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "chat_conversations_org_idx" ON "chat_conversations" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "chat_conversations_user_idx" ON "chat_conversations" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "chat_messages_conversation_idx" ON "chat_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "chat_messages_role_idx" ON "chat_messages" USING btree ("role");