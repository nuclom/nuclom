/**
 * GitHub Content OAuth Callback
 *
 * GET /api/content/github/callback - Handle OAuth callback and create content source
 */

import { Effect } from 'effect';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { createFullLayer } from '@nuclom/lib/api-handler';
import { ContentRepository, exchangeGitHubCode } from '@nuclom/lib/effect/services/content';
import { env, getAppUrl } from '@nuclom/lib/env/server';
import { logger } from '@nuclom/lib/logger';

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

  // Handle OAuth errors from GitHub
  if (error) {
    logger.error('[GitHub Content OAuth Error]', new Error(`${error}: ${errorDescription}`));
    return redirect('/settings/integrations?error=github_content_oauth_failed');
  }

  // Validate required parameters
  if (!code || !state) {
    return redirect('/settings/integrations?error=github_content_invalid_response');
  }

  // Verify state matches stored cookie
  const cookieStore = await cookies();
  const storedState = cookieStore.get('github_content_oauth_state')?.value;

  if (!storedState || storedState !== state) {
    return redirect('/settings/integrations?error=github_content_state_mismatch');
  }

  // Clear the state cookie
  cookieStore.delete('github_content_oauth_state');

  // Parse state
  const parsedState = parseOAuthState(state);
  if (!parsedState || parsedState.type !== 'content') {
    return redirect('/settings/integrations?error=github_content_invalid_state');
  }

  // Verify state is not expired (10 minutes)
  if (Date.now() - parsedState.timestamp > 600000) {
    return redirect('/settings/integrations?error=github_content_state_expired');
  }

  const { organizationId } = parsedState;

  // Get credentials
  const clientId = env.GITHUB_CONTENT_CLIENT_ID || env.GITHUB_CLIENT_ID;
  const clientSecret = env.GITHUB_CONTENT_CLIENT_SECRET || env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return redirect('/settings/integrations?error=github_content_not_configured');
  }

  const effect = Effect.gen(function* () {
    const contentRepo = yield* ContentRepository;

    // Exchange code for tokens
    const tokens = yield* Effect.promise(() => exchangeGitHubCode(clientId, clientSecret, code));

    // Get user info to identify the account
    const userResponse = yield* Effect.tryPromise({
      try: () =>
        fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }).then((res) => res.json()),
      catch: (e) => new Error(`Failed to get GitHub user: ${e}`),
    });

    const githubUser = userResponse as { id: number; login: string; name?: string };

    // Create or update content source
    const existingSources = yield* contentRepo.getSources({
      organizationId,
      type: 'github',
    });

    const existingSource = existingSources.items.find((s) => {
      const config = s.config as { settings?: { userId?: number } } | null;
      return config?.settings?.userId === githubUser.id;
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
            userId: githubUser.id,
            username: githubUser.login,
            displayName: githubUser.name,
          },
        },
      });
    } else {
      // Create new content source
      yield* contentRepo.createSource({
        organizationId,
        type: 'github',
        name: `GitHub - ${githubUser.login}`,
        credentials: {
          accessToken: tokens.access_token,
          scope: tokens.scope,
        },
        config: {
          settings: {
            userId: githubUser.id,
            username: githubUser.login,
            displayName: githubUser.name,
          },
        },
      });
    }

    return { success: true };
  });

  try {
    await Effect.runPromise(Effect.provide(effect, createFullLayer()));
    return redirect(`/org/${organizationId}/settings/integrations?success=github_content`);
  } catch (err) {
    logger.error('[GitHub Content Callback Error]', err instanceof Error ? err : new Error(String(err)));
    return redirect(`/org/${organizationId}/settings/integrations?error=github_content_callback_failed`);
  }
}
