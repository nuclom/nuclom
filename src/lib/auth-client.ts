"use client";

import { createAuthClient } from "better-auth/react";
import { organizationClient, adminClient, apiKeyClient } from "better-auth/client/plugins";
import { env } from "@/lib/env/client";

export const authClient = createAuthClient({
  baseURL: env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3000",
  plugins: [organizationClient(), adminClient(), apiKeyClient()],
});
