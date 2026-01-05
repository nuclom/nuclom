ALTER TABLE "transcript_chunks" ALTER COLUMN "embedding" SET DATA TYPE vector(1536);--> statement-breakpoint
ALTER TABLE "videos" ALTER COLUMN "search_vector" SET DATA TYPE "undefined"."tsvector";--> statement-breakpoint
ALTER TABLE "videos" drop column "search_vector";--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(transcript, ''))) STORED;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "embedding_vector" vector(1536);--> statement-breakpoint
ALTER TABLE "knowledge_nodes" ADD COLUMN "embedding_vector" vector(1536);--> statement-breakpoint
ALTER TABLE "decisions" DROP COLUMN "embedding";--> statement-breakpoint
ALTER TABLE "knowledge_nodes" DROP COLUMN "embedding";