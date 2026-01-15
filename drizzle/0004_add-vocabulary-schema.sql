CREATE TYPE "public"."CorrectionSuggestionStatus" AS ENUM('pending', 'accepted', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."VocabularyCategory" AS ENUM('product', 'person', 'technical', 'acronym', 'company');--> statement-breakpoint
CREATE TABLE "organization_vocabulary" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"term" text NOT NULL,
	"variations" text[] DEFAULT '{}' NOT NULL,
	"category" "VocabularyCategory" NOT NULL,
	"pronunciation" text,
	"description" text,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "org_vocabulary_org_term_unique" UNIQUE("organization_id","term")
);
--> statement-breakpoint
CREATE TABLE "vocabulary_correction_suggestions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"original_text" text NOT NULL,
	"corrected_text" text NOT NULL,
	"occurrence_count" integer DEFAULT 1 NOT NULL,
	"status" "CorrectionSuggestionStatus" DEFAULT 'pending' NOT NULL,
	"suggested_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vocab_correction_org_text_unique" UNIQUE("organization_id","original_text","corrected_text")
);
--> statement-breakpoint
ALTER TABLE "organization_vocabulary" ADD CONSTRAINT "organization_vocabulary_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_vocabulary" ADD CONSTRAINT "organization_vocabulary_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary_correction_suggestions" ADD CONSTRAINT "vocabulary_correction_suggestions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "org_vocabulary_org_idx" ON "organization_vocabulary" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "org_vocabulary_category_idx" ON "organization_vocabulary" USING btree ("organization_id","category");--> statement-breakpoint
CREATE INDEX "org_vocabulary_term_idx" ON "organization_vocabulary" USING btree ("organization_id","term");--> statement-breakpoint
CREATE INDEX "vocab_correction_org_idx" ON "vocabulary_correction_suggestions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "vocab_correction_status_idx" ON "vocabulary_correction_suggestions" USING btree ("organization_id","status");