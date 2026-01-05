-- =====================
-- Rollback: Remove Multi-Region Storage Feature
-- =====================
-- WARNING: This rollback recreates the tables but cannot restore any data that was deleted.
-- If you need to restore data, you must do so from a backup.

-- Recreate the enum type
DO $$ BEGIN
    CREATE TYPE "StorageRegion" AS ENUM (
        'us-east-1', 'us-west-2', 'eu-west-1', 'eu-central-1',
        'ap-southeast-1', 'ap-northeast-1', 'auto'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Recreate Organization Storage Configs table
CREATE TABLE IF NOT EXISTS "organization_storage_configs" (
    "id" text PRIMARY KEY,
    "organization_id" text NOT NULL UNIQUE REFERENCES "organizations"("id") ON DELETE CASCADE,
    "primary_region" "StorageRegion" NOT NULL DEFAULT 'auto',
    "replication_regions" jsonb,
    "data_residency" text,
    "encryption_key_id" text,
    "retention_days" integer DEFAULT 30,
    "created_at" timestamp NOT NULL DEFAULT now(),
    "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "org_storage_configs_org_idx" ON "organization_storage_configs" ("organization_id");

-- Recreate File Region Locations table
CREATE TABLE IF NOT EXISTS "file_region_locations" (
    "id" text PRIMARY KEY,
    "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
    "file_key" text NOT NULL,
    "region" "StorageRegion" NOT NULL,
    "bucket_name" text NOT NULL,
    "is_primary" boolean NOT NULL DEFAULT false,
    "replication_status" text DEFAULT 'pending',
    "last_synced_at" timestamp,
    "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "file_region_locations_file_key_idx" ON "file_region_locations" ("file_key");
CREATE INDEX IF NOT EXISTS "file_region_locations_org_idx" ON "file_region_locations" ("organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "file_region_locations_unique" ON "file_region_locations" ("file_key", "region");
