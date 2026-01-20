/**
 * Slack Content OAuth Authorization
 *
 * GET /api/content/slack/authorize - Start OAuth flow for Slack content integration
 */

import { auth } from '@nuclom/lib/auth';
import { getSlackContentAuthUrl } from '@nuclom/lib/effect/services/content';
import { env, getAppUrl } from '@nuclom/lib/env/server';
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

  // Check if Slack content integration is configured
  if (!env.SLACK_CONTENT_CLIENT_ID || !env.SLACK_CONTENT_CLIENT_SECRET) {
    return new Response('Slack content integration not configured', { status: 503 });
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
  const redirectUri = `${getAppUrl()}/api/content/slack/callback`;
  const authUrl = getSlackContentAuthUrl(env.SLACK_CONTENT_CLIENT_ID, redirectUri, state);

  return redirect(authUrl);
}
