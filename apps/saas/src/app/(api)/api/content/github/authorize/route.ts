/**
 * GitHub Content OAuth Authorization
 *
 * GET /api/content/github/authorize - Start OAuth flow for GitHub content integration
 */

import { auth } from '@nuclom/lib/auth';
import { getGitHubAuthUrl } from '@nuclom/lib/effect/services/content';
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

  // Use GitHub content credentials if available, otherwise fall back to auth credentials
  const clientId = env.GITHUB_CONTENT_CLIENT_ID || env.GITHUB_CLIENT_ID;

  if (!clientId) {
    return new Response('GitHub integration not configured', { status: 503 });
  }

  // Create state with user and org info for callback
  const state = Buffer.from(
    JSON.stringify({
      userId: session.user.id,
      organizationId,
      timestamp: Date.now(),
      type: 'content',
    }),
  ).toString('base64url');

  // Store state in a cookie for verification
  const cookieStore = await cookies();
  cookieStore.set('github_content_oauth_state', state, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });

  // Get authorization URL with repo scope for content access
  const redirectUri = `${getAppUrl()}/api/content/github/callback`;
  const authUrl = getGitHubAuthUrl(clientId, redirectUri, state, 'repo,read:user');

  return redirect(authUrl);
}
