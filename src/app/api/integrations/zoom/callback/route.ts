import { Effect } from "effect";
import { Zoom } from "@/lib/effect/services/zoom";
import {
  errorRedirect,
  saveIntegration,
  successRedirect,
  validateOAuthCallback,
  ZoomIntegrationLayer,
} from "@/lib/integrations";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  const validation = await validateOAuthCallback(request, "zoom");
  if (!validation.success) {
    return validation.redirect;
  }

  const { code, userId, organizationId } = validation;

  const effect = Effect.gen(function* () {
    const zoom = yield* Zoom;

    // Exchange code for tokens
    const tokens = yield* zoom.exchangeCodeForToken(code);

    // Get user info from Zoom
    const userInfo = yield* zoom.getUserInfo(tokens.access_token);

    // Save integration
    yield* saveIntegration({
      userId,
      organizationId,
      provider: "zoom",
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        scope: tokens.scope,
      },
      metadata: {
        accountId: userInfo.account_id,
        email: userInfo.email,
      },
    });

    return { success: true };
  });

  try {
    await Effect.runPromise(Effect.provide(effect, ZoomIntegrationLayer));
    return successRedirect(organizationId, "zoom");
  } catch (err) {
    logger.error("[Zoom Callback Error]", err instanceof Error ? err : new Error(String(err)));
    return errorRedirect(organizationId, "zoom");
  }
}
