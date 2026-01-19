/**
 * Slack Content OAuth Authorization
 *
 * GET /api/content/slack/authorize - Start OAuth flow for Slack content integration
 */

import { auth } from '@nuclom/lib/auth';
import { SlackContentAdapter, SlackContentAdapterLive, getSlackOAuthUrl } from '@nuclom/lib/effect/services/content';
import { env } from '@nuclom/lib/env/server';
import { Effect } from 'effect';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');

  if (!organizationId) {
    return new Response('Missing organizationId', { status: 400 });
  }

  // Verify the user is authenticated
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return redirect('/login');
  }

  // Create state with user and org info for callback
  const state = Buffer.from(
    JSON.stringify({
      userId: session.user.id,
      organizationId,
      timestamp: Date.now(),
      type: 'content', // Distinguish from notification integration
    }),
  ).toString('base64url');

  // Store state in a cookie for verification
  const cookieStore = await cookies();
  cookieStore.set('slack_content_oauth_state', state, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });

  // Get authorization URL
  const effect = Effect.gen(function* () {
    const slackAdapter = yield* SlackContentAdapter;
    return yield* getSlackOAuthUrl(state);
  });

  const authUrl = await Effect.runPromise(Effect.provide(effect, SlackContentAdapterLive));

  return redirect(authUrl);
}
