import { Effect, Layer } from "effect";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { DatabaseLive } from "@/lib/effect/services/database";
import { IntegrationRepository, IntegrationRepositoryLive } from "@/lib/effect/services/integration-repository";
import { Slack, SlackLive } from "@/lib/effect/services/slack";
import { logger } from "@/lib/logger";

const IntegrationRepositoryWithDeps = IntegrationRepositoryLive.pipe(Layer.provide(DatabaseLive));
const ChannelsLayer = Layer.mergeAll(SlackLive, IntegrationRepositoryWithDeps, DatabaseLive);

export async function GET(request: Request) {
  // Verify the user is authenticated
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const effect = Effect.gen(function* () {
    const slack = yield* Slack;
    const integrationRepo = yield* IntegrationRepository;

    // Get the user's Slack integration
    const integration = yield* integrationRepo.getIntegrationByProvider(session.user.id, "slack");

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
    logger.error("[Slack Channels Error]", err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json({ error: "Failed to fetch Slack channels" }, { status: 500 });
  }
}
