-- Rollback: 0002_add_integrations.sql
-- Description: Removes integrations and imported meetings tables

-- Drop indexes first
DROP INDEX IF EXISTS "imported_meetings_video_id_idx";
DROP INDEX IF EXISTS "imported_meetings_integration_id_idx";
DROP INDEX IF EXISTS "integrations_organization_id_idx";
DROP INDEX IF EXISTS "integrations_user_id_idx";

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS "imported_meetings";
DROP TABLE IF EXISTS "integrations";

-- Drop enum types
DROP TYPE IF EXISTS "public"."ImportStatus";
DROP TYPE IF EXISTS "public"."IntegrationProvider";
