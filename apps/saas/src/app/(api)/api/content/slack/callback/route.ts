/**
 * Slack Content OAuth Callback
 *
 * GET /api/content/slack/callback - Handle OAuth callback and create content source
 */

import { createFullLayer } from '@nuclom/lib/api-handler';
import { ContentRepository, exchangeSlackCode } from '@nuclom/lib/effect/services/content';
import { env, getAppUrl } from '@nuclom/lib/env/server';
import { logger } from '@nuclom/lib/logger';
import { Effect } from 'effect';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';

interface OAuthState {
  userId: string;
  organizationId: string;
  timestamp: number;
  type: string;
}

function parseOAuthState(state: string): OAuthState | null {
  try {
    return JSON.parse(Buffer.from(state, 'base64url').toString());
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  await connection();

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Handle OAuth errors from Slack
  if (error) {
    logger.error('[Slack Content OAuth Error]', new Error(`${error}: ${errorDescription}`));
    return redirect('/settings/integrations?error=slack_content_oauth_failed');
  }

  // Validate required parameters
  if (!code || !state) {
    return redirect('/settings/integrations?error=slack_content_invalid_response');
  }

  // Verify state matches stored cookie
  const cookieStore = await cookies();
  const storedState = cookieStore.get('slack_content_oauth_state')?.value;

  if (!storedState || storedState !== state) {
    return redirect('/settings/integrations?error=slack_content_state_mismatch');
  }

  // Clear the state cookie
  cookieStore.delete('slack_content_oauth_state');

  // Parse state
  const parsedState = parseOAuthState(state);
  if (!parsedState || parsedState.type !== 'content') {
    return redirect('/settings/integrations?error=slack_content_invalid_state');
  }

  // Verify state is not expired (10 minutes)
  if (Date.now() - parsedState.timestamp > 600000) {
    return redirect('/settings/integrations?error=slack_content_state_expired');
  }

  const { organizationId } = parsedState;

  // Get credentials
  const clientId = env.SLACK_CONTENT_CLIENT_ID;
  const clientSecret = env.SLACK_CONTENT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return redirect('/settings/integrations?error=slack_content_not_configured');
  }

  const redirectUri = `${getAppUrl()}/api/content/slack/callback`;

  const effect = Effect.gen(function* () {
    const contentRepo = yield* ContentRepository;

    // Exchange code for tokens
    const tokens = yield* Effect.promise(() => exchangeSlackCode(clientId, clientSecret, code, redirectUri));

    // Create or update content source
    const existingSources = yield* contentRepo.getSources({
      organizationId,
      type: 'slack',
    });

    const existingSource = existingSources.items.find((s) => {
      const config = s.config as { settings?: { teamId?: string } } | null;
      return config?.settings?.teamId === tokens.team.id;
    });

    if (existingSource) {
      // Update existing source
      yield* contentRepo.updateSource(existingSource.id, {
        credentials: {
          accessToken: tokens.access_token,
          scope: tokens.scope,
        },
        config: {
          settings: {
            teamId: tokens.team.id,
            teamName: tokens.team.name,
            authedUserId: tokens.authed_user?.id,
          },
        },
      });
    } else {
      // Create new content source
      yield* contentRepo.createSource({
        organizationId,
        type: 'slack',
        name: `Slack - ${tokens.team.name}`,
        credentials: {
          accessToken: tokens.access_token,
          scope: tokens.scope,
        },
        config: {
          settings: {
            teamId: tokens.team.id,
            teamName: tokens.team.name,
            authedUserId: tokens.authed_user?.id,
          },
        },
      });
    }

    return { success: true };
  });

  try {
    await Effect.runPromise(Effect.provide(effect, createFullLayer()));
    return redirect(`/org/${organizationId}/settings/integrations?success=slack_content`);
  } catch (err) {
    logger.error('[Slack Content Callback Error]', err instanceof Error ? err : new Error(String(err)));
    return redirect(`/org/${organizationId}/settings/integrations?error=slack_content_callback_failed`);
  }
}
