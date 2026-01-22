import { auth } from '@nuclom/lib/auth';
import { DatabaseLive } from '@nuclom/lib/effect/services/database';
import { IntegrationRepository, IntegrationRepositoryLive } from '@nuclom/lib/effect/services/integration-repository';
import { MicrosoftTeams, MicrosoftTeamsLive } from '@nuclom/lib/effect/services/microsoft-teams';
import { MicrosoftTeamsClientLive } from '@nuclom/lib/effect/services/microsoft-teams-client';
import { logger } from '@nuclom/lib/logger';
import { Effect, Layer } from 'effect';
import { NextResponse } from 'next/server';

const IntegrationRepositoryWithDeps = IntegrationRepositoryLive.pipe(Layer.provide(DatabaseLive));
const TeamsWithDeps = MicrosoftTeamsLive.pipe(Layer.provide(MicrosoftTeamsClientLive));
const ChannelsLayer = Layer.mergeAll(TeamsWithDeps, IntegrationRepositoryWithDeps, DatabaseLive);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get('teamId');

  // Verify the user is authenticated
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const effect = Effect.gen(function* () {
    const teams = yield* MicrosoftTeams;
    const integrationRepo = yield* IntegrationRepository;

    // Get the user's Microsoft Teams integration
    const integration = yield* integrationRepo.getIntegrationByProvider(session.user.id, 'microsoft_teams');

    if (!integration) {
      return { teams: [], channels: [], connected: false };
    }

    // Check if token needs refresh
    let accessToken = integration.accessToken;
    if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
      if (integration.refreshToken) {
        const newTokens = yield* teams.refreshAccessToken(integration.refreshToken);
        accessToken = newTokens.access_token;

        // Update the integration with new tokens
        yield* integrationRepo.updateIntegration(integration.id, {
          accessToken: newTokens.access_token,
          refreshToken: newTokens.refresh_token,
          expiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
        });
      }
    }

    // If teamId is provided, list channels for that team
    if (teamId) {
      const channelsResponse = yield* teams.listChannels(accessToken, teamId);
      return {
        channels: channelsResponse.value,
        connected: true,
      };
    }

    // Otherwise, list all teams
    const teamsResponse = yield* teams.listTeams(accessToken);

    return {
      teams: teamsResponse.value,
      channels: [],
      connected: true,
      displayName: (integration.metadata as { displayName?: string })?.displayName,
    };
  });

  try {
    const result = await Effect.runPromise(Effect.provide(effect, ChannelsLayer));
    return NextResponse.json(result);
  } catch (err) {
    logger.error('[Teams Channels Error]', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json({ error: 'Failed to fetch Teams data' }, { status: 500 });
  }
}
