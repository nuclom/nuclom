// biome-ignore-all lint/correctness/noProcessGlobal: "This is a env file"

import { Schema } from 'effect';

const NodeEnv = Schema.Literal('development', 'test', 'production');

export const ClientEnv = Schema.Struct({
  NODE_ENV: Schema.optionalWith(NodeEnv, { default: () => 'development' as const }),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: Schema.optional(Schema.String),
  // Vercel automatic environment variables
  NEXT_PUBLIC_VERCEL_URL: Schema.optional(Schema.String),
  NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: Schema.optional(Schema.String),
  NEXT_PUBLIC_VERCEL_ENV: Schema.optional(Schema.Literal('production', 'preview', 'development')),
});

export type ClientEnvType = typeof ClientEnv.Type;

export const env = Schema.decodeUnknownSync(ClientEnv)({
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_VERCEL_URL: process.env.NEXT_PUBLIC_VERCEL_URL,
  NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
  NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
});

/**
 * Get the application URL, computed from Vercel environment variables.
 * Works in both client and server components.
 * - In production: Uses NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
 * - In preview/staging: Uses NEXT_PUBLIC_VERCEL_URL
 * - In local development: Falls back to http://localhost:5001
 */
export function getAppUrl(): string {
  // Local development should always use localhost
  if (env.NODE_ENV === 'development') {
    return 'http://localhost:3091';
  }

  // Production environment - use the production URL
  if (env.NEXT_PUBLIC_VERCEL_ENV === 'production' && env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  // Preview/staging environment - use the deployment URL
  if (env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${env.NEXT_PUBLIC_VERCEL_URL}`;
  }

  // Local development fallback
  return 'http://localhost:3091';
}
