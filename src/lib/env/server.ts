import process from "node:process";
import { Schema } from "effect";
import { ClientEnv } from "@/lib/env/client";

const NodeEnv = Schema.Literal("development", "test", "production");

export const ServerEnv = Schema.Struct({
  ...ClientEnv.fields,
  APP_URL: Schema.String.pipe(
    Schema.filter((s) => URL.canParse(s)),
    Schema.propertySignature,
    Schema.withConstructorDefault(() => "http://localhost:3000"),
  ),
  DATABASE_URL: Schema.String,
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
  NODE_ENV: Schema.optionalWith(NodeEnv, { default: () => "development" as const }),
  STRIPE_SECRET_KEY: Schema.String,
  STRIPE_WEBHOOK_SECRET: Schema.String,
});

export type ServerEnvType = typeof ServerEnv.Type;

export const env = Schema.decodeUnknownSync(ServerEnv)(process.env);
