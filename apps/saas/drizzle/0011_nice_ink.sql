ALTER TYPE "public"."ContentRelationshipType" ADD VALUE 'similar_to' BEFORE 'mentions';--> statement-breakpoint
ALTER TYPE "public"."DecisionStatus" ADD VALUE 'implemented' BEFORE 'revisited';--> statement-breakpoint
ALTER TYPE "public"."DecisionType" ADD VALUE 'resource' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."ParticipantRole" ADD VALUE 'proposer' BEFORE 'decider';--> statement-breakpoint
ALTER TYPE "public"."ParticipantRole" ADD VALUE 'approver' BEFORE 'participant';--> statement-breakpoint
ALTER TYPE "public"."ParticipantRole" ADD VALUE 'objector' BEFORE 'participant';--> statement-breakpoint
ALTER TABLE "health_checks" ALTER COLUMN "service" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."HealthCheckService";--> statement-breakpoint
CREATE TYPE "public"."HealthCheckService" AS ENUM('database', 'storage', 'overall');--> statement-breakpoint
ALTER TABLE "health_checks" ALTER COLUMN "service" SET DATA TYPE "public"."HealthCheckService" USING "service"::"public"."HealthCheckService";