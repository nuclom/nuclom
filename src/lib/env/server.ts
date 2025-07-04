import { z } from "zod/v4";
import "server-only";
import { ClientEnv } from "@/lib/env/client";

export const ServerEnv = ClientEnv.merge(z.object({
  DATABASE_URL: z.string().url(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().default("nuclom-videos"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
}));

export const env = ServerEnv.parse(process.env);
