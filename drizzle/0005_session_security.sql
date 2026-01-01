-- Session Security Enhancements
-- Adds fields for session fingerprinting, password change tracking, and concurrent session limits

-- Add fingerprint and fingerprint check timestamp to sessions table
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "fingerprint" text;
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "last_fingerprint_check" timestamp;

-- Add password changed timestamp to users table for session revocation
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_changed_at" timestamp;

-- Add max sessions limit per user (null = use default)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "max_sessions" integer;

-- Create index on fingerprint for faster lookups
CREATE INDEX IF NOT EXISTS "sessions_fingerprint_idx" ON "sessions" ("fingerprint");

-- Create index on userId for session count queries
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions" ("user_id");
