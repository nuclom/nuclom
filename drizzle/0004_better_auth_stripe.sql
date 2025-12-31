-- Better Auth Stripe Integration Migration
-- Adds stripe customer ID to users and updates subscriptions table for Better Auth compatibility

-- Add stripe_customer_id to users table for Better Auth Stripe
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Update subscriptions table for Better Auth Stripe compatibility
-- Add new columns
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS reference_id TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS period_start TIMESTAMP;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS period_end TIMESTAMP;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancel_at TIMESTAMP;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMP;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS seats INTEGER;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Migrate existing data to new schema
UPDATE subscriptions
SET
  plan = COALESCE((SELECT name FROM plans WHERE plans.id = subscriptions.plan_id), 'free'),
  reference_id = organization_id
WHERE plan IS NULL OR reference_id IS NULL;

-- Make required columns NOT NULL after migration
ALTER TABLE subscriptions ALTER COLUMN plan SET NOT NULL;
ALTER TABLE subscriptions ALTER COLUMN reference_id SET NOT NULL;

-- Add indexes for Better Auth Stripe queries
CREATE INDEX IF NOT EXISTS subscriptions_reference_idx ON subscriptions(reference_id);
CREATE INDEX IF NOT EXISTS subscriptions_stripe_subscription_idx ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions(status);

-- Note: Keeping organization_id and plan_id for our custom fields
-- referenceId = organizationId for org-based billing
