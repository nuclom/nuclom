/**
 * Notion Content OAuth Authorization
 *
 * GET /api/content/notion/authorize - Start OAuth flow for Notion content integration
 */

import { auth } from '@nuclom/lib/auth';
import { getNotionAuthUrl } from '@nuclom/lib/effect/services/content';
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

  // Check if Notion integration is configured
  if (!env.NOTION_CLIENT_ID || !env.NOTION_CLIENT_SECRET) {
    return new Response('Notion integration not configured', { status: 503 });
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
  cookieStore.set('notion_content_oauth_state', state, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });

  // Get authorization URL
  const redirectUri = `${getAppUrl()}/api/content/notion/callback`;
  const authUrl = getNotionAuthUrl(env.NOTION_CLIENT_ID, redirectUri, state);

  return redirect(authUrl);
}
