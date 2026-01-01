-- Enterprise Security: Phase 3 Release Candidate
-- This migration adds SSO/SAML, Advanced RBAC, Comprehensive Audit Logs, and Multi-Region Storage

-- =====================
-- SSO/SAML Configuration
-- =====================

-- SSO Provider Type enum
DO $$ BEGIN
    CREATE TYPE "SSOProviderType" AS ENUM ('saml', 'oidc');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- SSO Configurations table
CREATE TABLE IF NOT EXISTS "sso_configurations" (
    "id" text PRIMARY KEY,
    "organization_id" text NOT NULL UNIQUE REFERENCES "organizations"("id") ON DELETE CASCADE,
    "provider_type" "SSOProviderType" NOT NULL,
    "enabled" boolean NOT NULL DEFAULT false,
    -- SAML specific fields
    "entity_id" text,
    "sso_url" text,
    "slo_url" text,
    "certificate" text,
    -- OIDC specific fields
    "issuer" text,
    "client_id" text,
    "client_secret" text,
    "discovery_url" text,
    -- Common settings
    "auto_provision" boolean NOT NULL DEFAULT true,
    "default_role" "OrganizationRole" NOT NULL DEFAULT 'member',
    "allowed_domains" jsonb,
    "attribute_mapping" jsonb,
    "created_at" timestamp NOT NULL DEFAULT now(),
    "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "sso_configurations_org_idx" ON "sso_configurations" ("organization_id");

-- SSO Sessions table (links auth sessions to SSO sessions)
CREATE TABLE IF NOT EXISTS "sso_sessions" (
    "id" text PRIMARY KEY,
    "session_id" text NOT NULL REFERENCES "sessions"("id") ON DELETE CASCADE,
    "sso_config_id" text NOT NULL REFERENCES "sso_configurations"("id") ON DELETE CASCADE,
    "external_user_id" text NOT NULL,
    "name_id" text,
    "session_index" text,
    "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "sso_sessions_session_idx" ON "sso_sessions" ("session_id");

-- =====================
-- Advanced RBAC
-- =====================

-- Permission Action enum
DO $$ BEGIN
    CREATE TYPE "PermissionAction" AS ENUM (
        'create', 'read', 'update', 'delete', 'share',
        'comment', 'download', 'manage', 'invite', 'admin'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Permission Resource enum
DO $$ BEGIN
    CREATE TYPE "PermissionResource" AS ENUM (
        'video', 'channel', 'collection', 'comment', 'member',
        'settings', 'billing', 'analytics', 'integration', 'audit_log'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Custom Roles table
CREATE TABLE IF NOT EXISTS "custom_roles" (
    "id" text PRIMARY KEY,
    "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
    "name" text NOT NULL,
    "description" text,
    "color" text,
    "is_default" boolean NOT NULL DEFAULT false,
    "is_system_role" boolean NOT NULL DEFAULT false,
    "created_at" timestamp NOT NULL DEFAULT now(),
    "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "custom_roles_org_idx" ON "custom_roles" ("organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "custom_roles_org_name_unique" ON "custom_roles" ("organization_id", "name");

-- Role Permissions table
CREATE TABLE IF NOT EXISTS "role_permissions" (
    "id" text PRIMARY KEY,
    "role_id" text NOT NULL REFERENCES "custom_roles"("id") ON DELETE CASCADE,
    "resource" "PermissionResource" NOT NULL,
    "action" "PermissionAction" NOT NULL,
    "conditions" jsonb,
    "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "role_permissions_role_idx" ON "role_permissions" ("role_id");
CREATE UNIQUE INDEX IF NOT EXISTS "role_permissions_unique" ON "role_permissions" ("role_id", "resource", "action");

-- User Role Assignments table
CREATE TABLE IF NOT EXISTS "user_role_assignments" (
    "id" text PRIMARY KEY,
    "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
    "role_id" text NOT NULL REFERENCES "custom_roles"("id") ON DELETE CASCADE,
    "assigned_by" text REFERENCES "users"("id") ON DELETE SET NULL,
    "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "user_role_assignments_user_org_idx" ON "user_role_assignments" ("user_id", "organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "user_role_assignments_unique" ON "user_role_assignments" ("user_id", "organization_id", "role_id");

-- Resource-level Permissions table
CREATE TABLE IF NOT EXISTS "resource_permissions" (
    "id" text PRIMARY KEY,
    "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
    "resource_type" "PermissionResource" NOT NULL,
    "resource_id" text NOT NULL,
    "user_id" text REFERENCES "users"("id") ON DELETE CASCADE,
    "role_id" text REFERENCES "custom_roles"("id") ON DELETE CASCADE,
    "action" "PermissionAction" NOT NULL,
    "granted_by" text REFERENCES "users"("id") ON DELETE SET NULL,
    "expires_at" timestamp,
    "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "resource_permissions_resource_idx" ON "resource_permissions" ("resource_type", "resource_id");
CREATE INDEX IF NOT EXISTS "resource_permissions_user_idx" ON "resource_permissions" ("user_id");
CREATE INDEX IF NOT EXISTS "resource_permissions_role_idx" ON "resource_permissions" ("role_id");

-- =====================
-- Comprehensive Audit Logs
-- =====================

-- Audit Log Category enum
DO $$ BEGIN
    CREATE TYPE "AuditLogCategory" AS ENUM (
        'authentication', 'authorization', 'user_management',
        'organization_management', 'content_management',
        'billing', 'security', 'integration', 'system'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Audit Log Severity enum
DO $$ BEGIN
    CREATE TYPE "AuditLogSeverity" AS ENUM ('info', 'warning', 'error', 'critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Audit Logs table
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" text PRIMARY KEY,
    -- Who performed the action
    "actor_id" text REFERENCES "users"("id") ON DELETE SET NULL,
    "actor_email" text,
    "actor_type" text NOT NULL DEFAULT 'user',
    -- Organization context
    "organization_id" text REFERENCES "organizations"("id") ON DELETE SET NULL,
    -- What happened
    "category" "AuditLogCategory" NOT NULL,
    "action" text NOT NULL,
    "description" text,
    "severity" "AuditLogSeverity" NOT NULL DEFAULT 'info',
    -- Target resource
    "resource_type" text,
    "resource_id" text,
    "resource_name" text,
    -- Changes (for update operations)
    "previous_value" jsonb,
    "new_value" jsonb,
    -- Request context
    "ip_address" text,
    "user_agent" text,
    "request_id" text,
    "session_id" text,
    -- Additional metadata
    "metadata" jsonb,
    -- Timestamps
    "created_at" timestamp NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS "audit_logs_actor_idx" ON "audit_logs" ("actor_id");
CREATE INDEX IF NOT EXISTS "audit_logs_org_idx" ON "audit_logs" ("organization_id");
CREATE INDEX IF NOT EXISTS "audit_logs_category_idx" ON "audit_logs" ("category");
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs" ("action");
CREATE INDEX IF NOT EXISTS "audit_logs_resource_idx" ON "audit_logs" ("resource_type", "resource_id");
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs" ("created_at");
CREATE INDEX IF NOT EXISTS "audit_logs_org_created_idx" ON "audit_logs" ("organization_id", "created_at");

-- Audit Log Exports table
CREATE TABLE IF NOT EXISTS "audit_log_exports" (
    "id" text PRIMARY KEY,
    "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
    "requested_by" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "format" text NOT NULL DEFAULT 'csv',
    "status" text NOT NULL DEFAULT 'pending',
    "filters" jsonb,
    "download_url" text,
    "expires_at" timestamp,
    "error_message" text,
    "record_count" integer,
    "created_at" timestamp NOT NULL DEFAULT now(),
    "completed_at" timestamp
);

CREATE INDEX IF NOT EXISTS "audit_log_exports_org_idx" ON "audit_log_exports" ("organization_id");
CREATE INDEX IF NOT EXISTS "audit_log_exports_status_idx" ON "audit_log_exports" ("status");

-- =====================
-- Multi-Region Storage
-- =====================

-- Storage Region enum
DO $$ BEGIN
    CREATE TYPE "StorageRegion" AS ENUM (
        'us-east-1', 'us-west-2', 'eu-west-1', 'eu-central-1',
        'ap-southeast-1', 'ap-northeast-1', 'auto'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Organization Storage Configs table
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

-- File Region Locations table
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

-- =====================
-- Seed Default System Roles for Existing Organizations
-- =====================

-- Function to create default roles for an organization
CREATE OR REPLACE FUNCTION create_default_roles(org_id text)
RETURNS void AS $$
DECLARE
    owner_role_id text;
    admin_role_id text;
    editor_role_id text;
    viewer_role_id text;
BEGIN
    -- Create Owner role
    owner_role_id := gen_random_uuid()::text;
    INSERT INTO custom_roles (id, organization_id, name, description, color, is_default, is_system_role)
    VALUES (owner_role_id, org_id, 'Owner', 'Full control over the organization', '#dc2626', false, true)
    ON CONFLICT (organization_id, name) DO NOTHING;

    -- Create Admin role
    admin_role_id := gen_random_uuid()::text;
    INSERT INTO custom_roles (id, organization_id, name, description, color, is_default, is_system_role)
    VALUES (admin_role_id, org_id, 'Admin', 'Administrative access except billing', '#f59e0b', false, true)
    ON CONFLICT (organization_id, name) DO NOTHING;

    -- Create Editor role
    editor_role_id := gen_random_uuid()::text;
    INSERT INTO custom_roles (id, organization_id, name, description, color, is_default, is_system_role)
    VALUES (editor_role_id, org_id, 'Editor', 'Can create and edit content', '#3b82f6', false, true)
    ON CONFLICT (organization_id, name) DO NOTHING;

    -- Create Viewer role (default for new members)
    viewer_role_id := gen_random_uuid()::text;
    INSERT INTO custom_roles (id, organization_id, name, description, color, is_default, is_system_role)
    VALUES (viewer_role_id, org_id, 'Viewer', 'Read-only access', '#6b7280', true, true)
    ON CONFLICT (organization_id, name) DO NOTHING;

    -- Add permissions for Owner role (all permissions)
    INSERT INTO role_permissions (id, role_id, resource, action)
    SELECT gen_random_uuid()::text, r.id, res.r, act.a
    FROM custom_roles r,
         LATERAL (VALUES ('video'), ('channel'), ('collection'), ('comment'), ('member'), ('settings'), ('billing'), ('analytics'), ('integration'), ('audit_log')) AS res(r),
         LATERAL (VALUES ('create'), ('read'), ('update'), ('delete'), ('share'), ('comment'), ('download'), ('manage'), ('invite'), ('admin')) AS act(a)
    WHERE r.organization_id = org_id AND r.name = 'Owner'
    ON CONFLICT DO NOTHING;

    -- Add permissions for Admin role (all except billing admin)
    INSERT INTO role_permissions (id, role_id, resource, action)
    SELECT gen_random_uuid()::text, r.id, res.r:::"PermissionResource", act.a:::"PermissionAction"
    FROM custom_roles r,
         LATERAL (VALUES ('video'), ('channel'), ('collection'), ('comment'), ('member'), ('settings'), ('analytics'), ('integration'), ('audit_log')) AS res(r),
         LATERAL (VALUES ('create'), ('read'), ('update'), ('delete'), ('share'), ('comment'), ('download'), ('manage'), ('invite')) AS act(a)
    WHERE r.organization_id = org_id AND r.name = 'Admin'
    ON CONFLICT DO NOTHING;

    -- Add permissions for Editor role
    INSERT INTO role_permissions (id, role_id, resource, action)
    SELECT gen_random_uuid()::text, r.id, res.r:::"PermissionResource", act.a:::"PermissionAction"
    FROM custom_roles r,
         LATERAL (VALUES ('video'), ('channel'), ('collection'), ('comment')) AS res(r),
         LATERAL (VALUES ('create'), ('read'), ('update'), ('delete'), ('share'), ('comment'), ('download')) AS act(a)
    WHERE r.organization_id = org_id AND r.name = 'Editor'
    ON CONFLICT DO NOTHING;

    -- Add permissions for Viewer role (read-only)
    INSERT INTO role_permissions (id, role_id, resource, action)
    SELECT gen_random_uuid()::text, r.id, res.r:::"PermissionResource", 'read':::"PermissionAction"
    FROM custom_roles r,
         LATERAL (VALUES ('video'), ('channel'), ('collection'), ('comment'), ('analytics')) AS res(r)
    WHERE r.organization_id = org_id AND r.name = 'Viewer'
    ON CONFLICT DO NOTHING;

    -- Also allow viewer to comment
    INSERT INTO role_permissions (id, role_id, resource, action)
    SELECT gen_random_uuid()::text, r.id, 'comment':::"PermissionResource", 'comment':::"PermissionAction"
    FROM custom_roles r
    WHERE r.organization_id = org_id AND r.name = 'Viewer'
    ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Create default roles for all existing organizations
DO $$
DECLARE
    org RECORD;
BEGIN
    FOR org IN SELECT id FROM organizations LOOP
        PERFORM create_default_roles(org.id);
    END LOOP;
END $$;

-- Create trigger to automatically create default roles for new organizations
CREATE OR REPLACE FUNCTION on_organization_created()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM create_default_roles(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS organization_created_trigger ON organizations;
CREATE TRIGGER organization_created_trigger
    AFTER INSERT ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION on_organization_created();
