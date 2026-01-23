import { Slack } from '@nuclom/lib/effect/services/slack';
import { SlackIntegrationLayer } from '@nuclom/lib/integrations/layer-builders';
import {
  errorRedirect,
  saveIntegration,
  successRedirect,
  validateOAuthCallback,
} from '@nuclom/lib/integrations/oauth-handler';
import { logger } from '@nuclom/lib/logger';
import { Effect } from 'effect';

export async function GET(request: Request) {
  const validation = await validateOAuthCallback(request, 'slack');
  if (!validation.success) {
    return validation.redirect;
  }

  const { code, userId, organizationId } = validation;

  const effect = Effect.gen(function* () {
    const slack = yield* Slack;

    // Exchange code for tokens
    const tokens = yield* slack.exchangeCodeForToken(code);
    if (!tokens.access_token || !tokens.team?.id || !tokens.team?.name || !tokens.authed_user?.id) {
      return yield* Effect.fail(new Error('Slack OAuth response missing team or user info'));
    }
    const accessToken = tokens.access_token;
    const teamId = tokens.team.id;
    const teamName = tokens.team.name;
    const authedUserId = tokens.authed_user.id;
    const scope = tokens.scope ?? '';

    // Save integration
    yield* saveIntegration({
      userId,
      organizationId,
      provider: 'slack',
      tokens: {
        access_token: accessToken,
        scope,
      },
      metadata: {
        teamId,
        teamName,
        userId: authedUserId,
        botUserId: tokens.bot_user_id,
        webhookUrl: tokens.incoming_webhook?.url,
      },
    });

    return { success: true };
  });

  try {
    await Effect.runPromise(Effect.provide(effect, SlackIntegrationLayer));
    return successRedirect(organizationId, 'slack');
  } catch (err) {
    logger.error('[Slack Callback Error]', err instanceof Error ? err : new Error(String(err)));
    return errorRedirect(organizationId, 'slack');
  }
}
