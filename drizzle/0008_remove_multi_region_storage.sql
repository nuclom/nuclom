-- =====================
-- Remove Multi-Region Storage Feature
-- =====================
-- This migration removes the incomplete multi-region storage replication feature
-- that was never fully implemented.

-- Drop tables (in reverse order of dependencies)
DROP TABLE IF EXISTS "file_region_locations";
DROP TABLE IF EXISTS "organization_storage_configs";

-- Drop the enum type
DROP TYPE IF EXISTS "StorageRegion";
