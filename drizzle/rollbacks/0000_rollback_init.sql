-- Rollback: 0000_init.sql
-- Description: Removes all initial tables and types
-- WARNING: This will DELETE ALL DATA. Use only in development or with proper backups.

-- Drop foreign key constraints first (in reverse order of creation)
ALTER TABLE "organization_users" DROP CONSTRAINT IF EXISTS "organization_users_organization_id_organizations_id_fk";
ALTER TABLE "organization_users" DROP CONSTRAINT IF EXISTS "organization_users_user_id_users_id_fk";
ALTER TABLE "videos" DROP CONSTRAINT IF EXISTS "videos_collection_id_collections_id_fk";
ALTER TABLE "videos" DROP CONSTRAINT IF EXISTS "videos_channel_id_channels_id_fk";
ALTER TABLE "videos" DROP CONSTRAINT IF EXISTS "videos_organization_id_organizations_id_fk";
ALTER TABLE "videos" DROP CONSTRAINT IF EXISTS "videos_author_id_users_id_fk";
ALTER TABLE "video_progresses" DROP CONSTRAINT IF EXISTS "video_progresses_video_id_videos_id_fk";
ALTER TABLE "video_progresses" DROP CONSTRAINT IF EXISTS "video_progresses_user_id_users_id_fk";
ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_user_id_users_id_fk";
ALTER TABLE "members" DROP CONSTRAINT IF EXISTS "members_user_id_users_id_fk";
ALTER TABLE "members" DROP CONSTRAINT IF EXISTS "members_organization_id_organizations_id_fk";
ALTER TABLE "invitations" DROP CONSTRAINT IF EXISTS "invitations_inviter_id_users_id_fk";
ALTER TABLE "invitations" DROP CONSTRAINT IF EXISTS "invitations_organization_id_organizations_id_fk";
ALTER TABLE "comments" DROP CONSTRAINT IF EXISTS "comments_video_id_videos_id_fk";
ALTER TABLE "comments" DROP CONSTRAINT IF EXISTS "comments_author_id_users_id_fk";
ALTER TABLE "collections" DROP CONSTRAINT IF EXISTS "collections_organization_id_organizations_id_fk";
ALTER TABLE "channels" DROP CONSTRAINT IF EXISTS "channels_organization_id_organizations_id_fk";
ALTER TABLE "apikeys" DROP CONSTRAINT IF EXISTS "apikeys_user_id_users_id_fk";
ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "accounts_user_id_users_id_fk";

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS "organization_users";
DROP TABLE IF EXISTS "video_progresses";
DROP TABLE IF EXISTS "comments";
DROP TABLE IF EXISTS "videos";
DROP TABLE IF EXISTS "collections";
DROP TABLE IF EXISTS "channels";
DROP TABLE IF EXISTS "members";
DROP TABLE IF EXISTS "invitations";
DROP TABLE IF EXISTS "oauth_consents";
DROP TABLE IF EXISTS "oauth_access_tokens";
DROP TABLE IF EXISTS "oauth_applications";
DROP TABLE IF EXISTS "apikeys";
DROP TABLE IF EXISTS "accounts";
DROP TABLE IF EXISTS "sessions";
DROP TABLE IF EXISTS "verifications";
DROP TABLE IF EXISTS "organizations";
DROP TABLE IF EXISTS "users";

-- Drop enum types
DROP TYPE IF EXISTS "public"."OrganizationRole";
