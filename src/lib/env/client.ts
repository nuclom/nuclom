import process from "node:process";
import { z } from "zod/v4";

export const ClientEnv = z.object({
  NEXT_PUBLIC_BETTER_AUTH_URL: z.string().url().optional(),
});

export const env = ClientEnv.parse(process.env);
