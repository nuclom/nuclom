import { GoogleMeet } from '@nuclom/lib/effect/services/google-meet';
import {
  errorRedirect,
  GoogleIntegrationLayer,
  saveIntegration,
  successRedirect,
  validateOAuthCallback,
} from '@nuclom/lib/integrations';
import { logger } from '@nuclom/lib/logger';
import { Effect } from 'effect';

export async function GET(request: Request) {
  const validation = await validateOAuthCallback(request, 'google');
  if (!validation.success) {
    return validation.redirect;
  }

  const { code, userId, organizationId } = validation;

  const effect = Effect.gen(function* () {
    const google = yield* GoogleMeet;

    // Exchange code for tokens
    const tokens = yield* google.exchangeCodeForToken(code);

    // Get user info from Google
    const userInfo = yield* google.getUserInfo(tokens.access_token);

    // Save integration
    yield* saveIntegration({
      userId,
      organizationId,
      provider: 'google_meet',
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        scope: tokens.scope,
      },
      metadata: {
        email: userInfo.email,
        scope: tokens.scope,
      },
    });

    return { success: true };
  });

  try {
    await Effect.runPromise(Effect.provide(effect, GoogleIntegrationLayer));
    return successRedirect(organizationId, 'google');
  } catch (err) {
    logger.error('[Google Callback Error]', err instanceof Error ? err : new Error(String(err)));
    return errorRedirect(organizationId, 'google');
  }
}
