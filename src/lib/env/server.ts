import { z } from "zod/v4";
import { ClientEnv } from "@/lib/env/client";

export const ServerEnv = z.object({
  ...ClientEnv.shape,
  DATABASE_URL: z.string(),
  VERCEL_OIDC_TOKEN: z.string(),
  RESEND_API_KEY: z.string(),
  GITHUB_CLIENT_ID: z.string(),
  GITHUB_CLIENT_SECRET: z.string(),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  R2_ACCOUNT_ID: z.string(),
  R2_ACCESS_KEY_ID: z.string(),
  R2_SECRET_ACCESS_KEY: z.string(),
  R2_BUCKET_NAME: z.string(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export const env = ServerEnv.parse(process.env);
