/**
 * Effect-based Configuration
 *
 * Uses Effect's Config module for type-safe environment variable handling.
 * This replaces the Zod-based validation with Effect's built-in Config system.
 */

import { Config, ConfigError, Effect, Layer, type Redacted } from "effect";

// =============================================================================
// Configuration Definitions
// =============================================================================

/**
 * Database configuration
 */
export const DatabaseConfig = Config.all({
  url: Config.redacted("DATABASE_URL"),
});

export type DatabaseConfig = typeof DatabaseConfig extends Config.Config<infer A> ? A : never;

/**
 * R2 Storage configuration
 */
export const StorageConfig = Config.all({
  accountId: Config.string("R2_ACCOUNT_ID"),
  accessKeyId: Config.string("R2_ACCESS_KEY_ID"),
  secretAccessKey: Config.redacted("R2_SECRET_ACCESS_KEY"),
  bucketName: Config.string("R2_BUCKET_NAME"),
});

export type StorageConfig = typeof StorageConfig extends Config.Config<infer A> ? A : never;

/**
 * OAuth configuration for GitHub
 */
export const GitHubOAuthConfig = Config.all({
  clientId: Config.string("GITHUB_CLIENT_ID"),
  clientSecret: Config.redacted("GITHUB_CLIENT_SECRET"),
});

export type GitHubOAuthConfig = typeof GitHubOAuthConfig extends Config.Config<infer A> ? A : never;

/**
 * OAuth configuration for Google
 */
export const GoogleOAuthConfig = Config.all({
  clientId: Config.string("GOOGLE_CLIENT_ID"),
  clientSecret: Config.redacted("GOOGLE_CLIENT_SECRET"),
});

export type GoogleOAuthConfig = typeof GoogleOAuthConfig extends Config.Config<infer A> ? A : never;

/**
 * Email service configuration
 */
export const EmailConfig = Config.all({
  resendApiKey: Config.redacted("RESEND_API_KEY"),
});

export type EmailConfig = typeof EmailConfig extends Config.Config<infer A> ? A : never;

/**
 * Application environment configuration
 */
export const AppConfig = Config.all({
  nodeEnv: Config.string("NODE_ENV").pipe(Config.withDefault("development")),
  vercelOidcToken: Config.string("VERCEL_OIDC_TOKEN").pipe(Config.option),
  betterAuthUrl: Config.string("NEXT_PUBLIC_BETTER_AUTH_URL").pipe(Config.withDefault("http://localhost:3000")),
});

/**
 * Stripe configuration
 */
export const StripeConfig = Config.all({
  secretKey: Config.redacted("STRIPE_SECRET_KEY"),
  webhookSecret: Config.redacted("STRIPE_WEBHOOK_SECRET"),
  publishableKey: Config.string("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY").pipe(Config.option),
});

export type StripeConfig = typeof StripeConfig extends Config.Config<infer A> ? A : never;

export type AppConfig = typeof AppConfig extends Config.Config<infer A> ? A : never;

/**
 * Complete server configuration
 */
export const ServerConfig = Config.all({
  database: DatabaseConfig,
  storage: StorageConfig,
  github: GitHubOAuthConfig,
  google: GoogleOAuthConfig,
  email: EmailConfig,
  app: AppConfig,
  stripe: StripeConfig,
});

export type ServerConfig = typeof ServerConfig extends Config.Config<infer A> ? A : never;

// =============================================================================
// Configuration Service
// =============================================================================

import { Context } from "effect";

/**
 * ConfigService provides access to application configuration
 */
export class ConfigService extends Context.Tag("ConfigService")<ConfigService, ServerConfig>() {}

/**
 * Layer that provides the ConfigService
 */
export const ConfigServiceLive = Layer.effect(
  ConfigService,
  Config.unwrap(ServerConfig).pipe(
    Effect.catchAll((error) =>
      Effect.die(new Error(`Configuration error: ${ConfigError.isConfigError(error) ? error.message : String(error)}`)),
    ),
  ),
);

// =============================================================================
// Optional Storage Configuration (for development)
// =============================================================================

/**
 * Storage configuration that allows missing values
 */
export const OptionalStorageConfig = Config.all({
  accountId: Config.string("R2_ACCOUNT_ID").pipe(Config.option),
  accessKeyId: Config.string("R2_ACCESS_KEY_ID").pipe(Config.option),
  secretAccessKey: Config.redacted("R2_SECRET_ACCESS_KEY").pipe(Config.option),
  bucketName: Config.string("R2_BUCKET_NAME").pipe(Config.option),
});

export type OptionalStorageConfig = typeof OptionalStorageConfig extends Config.Config<infer A> ? A : never;

/**
 * Check if storage is fully configured
 */
export const isStorageConfigured = (config: OptionalStorageConfig): boolean => {
  return (
    config.accountId._tag === "Some" &&
    config.accessKeyId._tag === "Some" &&
    config.secretAccessKey._tag === "Some" &&
    config.bucketName._tag === "Some"
  );
};

/**
 * Extract storage config values if fully configured
 */
export const getStorageConfig = (
  config: OptionalStorageConfig,
):
  | {
      accountId: string;
      accessKeyId: string;
      secretAccessKey: Redacted.Redacted<string>;
      bucketName: string;
    }
  | undefined => {
  if (
    config.accountId._tag === "Some" &&
    config.accessKeyId._tag === "Some" &&
    config.secretAccessKey._tag === "Some" &&
    config.bucketName._tag === "Some"
  ) {
    return {
      accountId: config.accountId.value,
      accessKeyId: config.accessKeyId.value,
      secretAccessKey: config.secretAccessKey.value,
      bucketName: config.bucketName.value,
    };
  }
  return undefined;
};
