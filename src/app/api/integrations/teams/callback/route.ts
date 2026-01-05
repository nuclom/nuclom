import { Effect } from "effect";
import { MicrosoftTeams } from "@/lib/effect/services/microsoft-teams";
import {
  errorRedirect,
  saveIntegration,
  successRedirect,
  TeamsIntegrationLayer,
  validateOAuthCallback,
} from "@/lib/integrations";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  const validation = await validateOAuthCallback(request, "teams");
  if (!validation.success) {
    return validation.redirect;
  }

  const { code, userId, organizationId } = validation;

  const effect = Effect.gen(function* () {
    const teams = yield* MicrosoftTeams;

    // Exchange code for tokens
    const tokens = yield* teams.exchangeCodeForToken(code);

    // Get user info from Microsoft Graph
    const userInfo = yield* teams.getUserInfo(tokens.access_token);

    // Save integration
    yield* saveIntegration({
      userId,
      organizationId,
      provider: "microsoft_teams",
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        scope: tokens.scope,
      },
      metadata: {
        userId: userInfo.id,
        email: userInfo.mail || userInfo.userPrincipalName,
        displayName: userInfo.displayName,
      },
    });

    return { success: true };
  });

  try {
    await Effect.runPromise(Effect.provide(effect, TeamsIntegrationLayer));
    return successRedirect(organizationId, "teams");
  } catch (err) {
    logger.error("[Teams Callback Error]", err instanceof Error ? err : new Error(String(err)));
    return errorRedirect(organizationId, "teams");
  }
}
