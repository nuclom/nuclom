import { Zoom } from '@nuclom/lib/effect/services/zoom';
import { ZoomIntegrationLayer } from '@nuclom/lib/integrations/layer-builders';
import {
  errorRedirect,
  saveIntegration,
  successRedirect,
  validateOAuthCallback,
} from '@nuclom/lib/integrations/oauth-handler';
import { logger } from '@nuclom/lib/logger';
import { Effect } from 'effect';

export async function GET(request: Request) {
  const validation = await validateOAuthCallback(request, 'zoom');
  if (!validation.success) {
    return validation.redirect;
  }

  const { code, userId, organizationId } = validation;

  const effect = Effect.gen(function* () {
    const zoom = yield* Zoom;

    // Exchange code for tokens
    const tokens = yield* zoom.exchangeCodeForToken(code);

    // Get user info from Zoom
    const userInfo = yield* zoom.getUserInfo(tokens);

    // Save integration
    yield* saveIntegration({
      userId,
      organizationId,
      provider: 'zoom',
      tokens: {
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_in: Math.max(0, Math.floor((Date.parse(tokens.expirationTimeIso) - Date.now()) / 1000)),
        scope: tokens.scopes.join(' '),
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
    return successRedirect(organizationId, 'zoom');
  } catch (err) {
    logger.error('[Zoom Callback Error]', err instanceof Error ? err : new Error(String(err)));
    return errorRedirect(organizationId, 'zoom');
  }
}
