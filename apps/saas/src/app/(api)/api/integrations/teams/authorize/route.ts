import { auth } from '@nuclom/lib/auth';
import { MicrosoftTeams, MicrosoftTeamsLive } from '@nuclom/lib/effect/services/microsoft-teams';
import { MicrosoftTeamsClientLive } from '@nuclom/lib/effect/services/microsoft-teams-client';
import { env } from '@nuclom/lib/env/server';
import { Effect, Layer } from 'effect';
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
    }),
  ).toString('base64url');

  // Store state in a cookie for verification
  const cookieStore = await cookies();
  cookieStore.set('teams_oauth_state', state, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });

  // Get authorization URL
  const effect = Effect.gen(function* () {
    const teams = yield* MicrosoftTeams;
    return yield* teams.getAuthorizationUrl(state);
  });

  const teamsLayer = MicrosoftTeamsLive.pipe(Layer.provide(MicrosoftTeamsClientLive));
  const authUrl = await Effect.runPromise(Effect.provide(effect, teamsLayer));

  return redirect(authUrl);
}
