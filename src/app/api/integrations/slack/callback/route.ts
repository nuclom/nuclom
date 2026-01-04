import { Effect } from "effect";
import { Slack } from "@/lib/effect/services/slack";
import {
  errorRedirect,
  SlackIntegrationLayer,
  saveIntegration,
  successRedirect,
  validateOAuthCallback,
} from "@/lib/integrations";

export async function GET(request: Request) {
  const validation = await validateOAuthCallback(request, "slack");
  if (!validation.success) {
    return validation.redirect;
  }

  const { code, userId, organizationId } = validation;

  const effect = Effect.gen(function* () {
    const slack = yield* Slack;

    // Exchange code for tokens
    const tokens = yield* slack.exchangeCodeForToken(code);

    // Save integration
    yield* saveIntegration({
      userId,
      organizationId,
      provider: "slack",
      tokens: {
        access_token: tokens.access_token,
        scope: tokens.scope,
      },
      metadata: {
        teamId: tokens.team.id,
        teamName: tokens.team.name,
        userId: tokens.authed_user.id,
        botUserId: tokens.bot_user_id,
        webhookUrl: tokens.incoming_webhook?.url,
      },
    });

    return { success: true };
  });

  try {
    await Effect.runPromise(Effect.provide(effect, SlackIntegrationLayer));
    return successRedirect(organizationId, "slack");
  } catch (err) {
    console.error("[Slack Callback Error]", err);
    return errorRedirect(organizationId, "slack");
  }
}
