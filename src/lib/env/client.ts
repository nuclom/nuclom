import process from "node:process";
import { Schema } from "effect";

export const ClientEnv = Schema.Struct({
  NEXT_PUBLIC_BETTER_AUTH_URL: Schema.optional(Schema.String.pipe(Schema.filter((s) => URL.canParse(s)))),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: Schema.optional(Schema.String),
  NEXT_PUBLIC_APP_URL: Schema.optional(Schema.String.pipe(Schema.filter((s) => URL.canParse(s)))),
});

export type ClientEnvType = typeof ClientEnv.Type;

export const env = Schema.decodeUnknownSync(ClientEnv)(
  // biome-ignore lint/nursery/noProcessGlobal: needed for env vars
  {
    NEXT_PUBLIC_BETTER_AUTH_URL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
);
