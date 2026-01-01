import { Effect, Layer } from "effect";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { DatabaseLive } from "@/lib/effect/services/database";
import { IntegrationRepository, IntegrationRepositoryLive } from "@/lib/effect/services/integration-repository";
import { MicrosoftTeams, MicrosoftTeamsLive } from "@/lib/effect/services/microsoft-teams";

const IntegrationRepositoryWithDeps = IntegrationRepositoryLive.pipe(Layer.provide(DatabaseLive));
const ChannelsLayer = Layer.mergeAll(MicrosoftTeamsLive, IntegrationRepositoryWithDeps, DatabaseLive);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("teamId");

  // Verify the user is authenticated
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const effect = Effect.gen(function* () {
    const teams = yield* MicrosoftTeams;
    const integrationRepo = yield* IntegrationRepository;

    // Get the user's Microsoft Teams integration
    const integration = yield* integrationRepo.getIntegrationByProvider(session.user.id, "microsoft_teams");

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
    console.error("[Teams Channels Error]", err);
    return NextResponse.json({ error: "Failed to fetch Teams data" }, { status: 500 });
  }
}
