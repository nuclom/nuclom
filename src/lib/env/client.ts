import process from "node:process";
import { z } from "zod/v4";

export const ClientEnv = z.object({
  NEXT_PUBLIC_BETTER_AUTH_URL: z.string().url().optional(),
});

export const env = ClientEnv.parse(
  // biome-ignore lint/nursery/noProcessGlobal: needed for env vars
  { NEXT_PUBLIC_BETTER_AUTH_URL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL },
);
