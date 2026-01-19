import { auth } from '@nuclom/lib/auth';
import { DatabaseLive } from '@nuclom/lib/effect/services/database';
import { IntegrationRepository, IntegrationRepositoryLive } from '@nuclom/lib/effect/services/integration-repository';
import { Slack, SlackLive } from '@nuclom/lib/effect/services/slack';
import { logger } from '@nuclom/lib/logger';
import { Effect, Layer } from 'effect';
import { NextResponse } from 'next/server';

const IntegrationRepositoryWithDeps = IntegrationRepositoryLive.pipe(Layer.provide(DatabaseLive));
const ChannelsLayer = Layer.mergeAll(SlackLive, IntegrationRepositoryWithDeps, DatabaseLive);

export async function GET(request: Request) {
  // Verify the user is authenticated
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const effect = Effect.gen(function* () {
    const slack = yield* Slack;
    const integrationRepo = yield* IntegrationRepository;

    // Get the user's Slack integration
    const integration = yield* integrationRepo.getIntegrationByProvider(session.user.id, 'slack');

    if (!integration) {
      return { channels: [], connected: false };
    }

    // List channels
    const channelsResponse = yield* slack.listChannels(integration.accessToken);

    return {
      channels: channelsResponse.channels,
      connected: true,
      teamName: (integration.metadata as { teamName?: string })?.teamName,
    };
  });

  try {
    const result = await Effect.runPromise(Effect.provide(effect, ChannelsLayer));
    return NextResponse.json(result);
  } catch (err) {
    logger.error('[Slack Channels Error]', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json({ error: 'Failed to fetch Slack channels' }, { status: 500 });
  }
}
