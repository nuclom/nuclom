// biome-ignore-all lint/correctness/noProcessGlobal: "This is a env file"
import 'server-only';

import { Schema } from 'effect';
import { ClientEnv } from './client';

export const ServerEnv = Schema.Struct({
  ...ClientEnv.fields,
  // Auth secret - required for production security
  BETTER_AUTH_SECRET: Schema.String.pipe(
    Schema.filter((s) => s.length >= 32, {
      message: () => 'BETTER_AUTH_SECRET must be at least 32 characters for security',
    }),
  ),
  DATABASE_URL: Schema.String,
  DATABASE_REPLICA_URL: Schema.optional(Schema.String),
  REPLICATE_API_TOKEN: Schema.optional(Schema.String),
  VERCEL_OIDC_TOKEN: Schema.optional(Schema.String),
  RESEND_API_KEY: Schema.String,
  RESEND_FROM_EMAIL: Schema.optional(Schema.String),
  GITHUB_CLIENT_ID: Schema.String,
  GITHUB_CLIENT_SECRET: Schema.String,
  GOOGLE_CLIENT_ID: Schema.String,
  GOOGLE_CLIENT_SECRET: Schema.String,
  ZOOM_CLIENT_ID: Schema.optional(Schema.String),
  ZOOM_CLIENT_SECRET: Schema.optional(Schema.String),
  R2_ACCOUNT_ID: Schema.String,
  R2_ACCESS_KEY_ID: Schema.String,
  R2_SECRET_ACCESS_KEY: Schema.String,
  R2_BUCKET_NAME: Schema.String,
  STRIPE_SECRET_KEY: Schema.String,
  STRIPE_WEBHOOK_SECRET: Schema.String,
  STRIPE_PRICE_ID_SCALE_MONTHLY: Schema.optional(Schema.String),
  STRIPE_PRICE_ID_SCALE_YEARLY: Schema.optional(Schema.String),
  STRIPE_PRICE_ID_PRO_MONTHLY: Schema.optional(Schema.String),
  STRIPE_PRICE_ID_PRO_YEARLY: Schema.optional(Schema.String),
  // Upstash Redis (for rate limiting)
  UPSTASH_REDIS_REST_URL: Schema.optional(Schema.String.pipe(Schema.filter((s) => URL.canParse(s)))),
  UPSTASH_REDIS_REST_TOKEN: Schema.optional(Schema.String),
  // Zoom webhook
  ZOOM_WEBHOOK_SECRET: Schema.optional(Schema.String),
  // AssemblyAI for speaker diarization
  ASSEMBLYAI_API_KEY: Schema.optional(Schema.String),
  // Cron job authentication
  CRON_SECRET: Schema.optional(Schema.String),
  // Logging configuration
  LOG_LEVEL: Schema.optional(Schema.Literal('debug', 'info', 'warn', 'error')),
  // Slack monitoring webhooks (different channels for different event types)
  SLACK_MONITORING_WEBHOOK_URL: Schema.optional(Schema.String.pipe(Schema.filter((s) => URL.canParse(s)))),
  SLACK_MONITORING_WEBHOOK_ACCOUNTS: Schema.optional(Schema.String.pipe(Schema.filter((s) => URL.canParse(s)))),
  SLACK_MONITORING_WEBHOOK_BILLING: Schema.optional(Schema.String.pipe(Schema.filter((s) => URL.canParse(s)))),
  SLACK_MONITORING_WEBHOOK_USAGE: Schema.optional(Schema.String.pipe(Schema.filter((s) => URL.canParse(s)))),
  SLACK_MONITORING_WEBHOOK_ERRORS: Schema.optional(Schema.String.pipe(Schema.filter((s) => URL.canParse(s)))),
  // Signup control (for staging deployments)
  DISABLE_SIGNUPS: Schema.optionalWith(
    Schema.transform(Schema.String, Schema.Boolean, {
      decode: (s) => s === 'true' || s === '1',
      encode: (b) => (b ? 'true' : 'false'),
    }),
    { default: () => false },
  ),
  // Admin user IDs (comma-separated list of user IDs with admin privileges)
  ADMIN_USER_IDS: Schema.optional(Schema.String),
  // Vercel auto-provided environment variables (server-side only)
  VERCEL_URL: Schema.optional(Schema.String),
  VERCEL_BRANCH_URL: Schema.optional(Schema.String),
  VERCEL_PROJECT_PRODUCTION_URL: Schema.optional(Schema.String),
  VERCEL_ENV: Schema.optional(Schema.Literal('production', 'preview', 'development')),
  VERCEL_GIT_COMMIT_SHA: Schema.optional(Schema.String),
  VERCEL_TARGET_ENV: Schema.optional(Schema.Literal('production', 'staging', 'development', 'preview')),
});

export type ServerEnvType = typeof ServerEnv.Type;

export const env = Schema.decodeUnknownSync(ServerEnv)(process.env);

/**
 * Get the application URL, computed from Vercel environment variables.
 * - In production: Uses VERCEL_PROJECT_PRODUCTION_URL
 * - In preview/staging: Uses VERCEL_URL
 * - In local development: Falls back to http://localhost:5001
 */
export function getAppUrl(): string {
  // Local development should always use localhost
  if (env.NODE_ENV === 'development') {
    return 'http://localhost:3091';
  }

  // Production environment - use the production URL
  if (env.VERCEL_ENV === 'production' && env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  // Preview/staging environment - use the deployment URL
  if (env.VERCEL_URL) {
    return `https://${env.VERCEL_URL}`;
  }

  // Local development fallback
  return 'http://localhost:3091';
}
