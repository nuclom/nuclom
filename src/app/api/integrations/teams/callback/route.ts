import { Effect, Layer } from "effect";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DatabaseLive } from "@/lib/effect/services/database";
import { IntegrationRepository, IntegrationRepositoryLive } from "@/lib/effect/services/integration-repository";
import { MicrosoftTeams, MicrosoftTeamsLive } from "@/lib/effect/services/microsoft-teams";

export const dynamic = "force-dynamic";

const IntegrationRepositoryWithDeps = IntegrationRepositoryLive.pipe(Layer.provide(DatabaseLive));
const CallbackLayer = Layer.mergeAll(MicrosoftTeamsLive, IntegrationRepositoryWithDeps, DatabaseLive);

interface OAuthState {
  userId: string;
  organizationId: string;
  timestamp: number;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Handle OAuth errors
  if (error) {
    console.error("[Teams OAuth Error]", error, errorDescription);
    return redirect("/settings/integrations?error=teams_oauth_failed");
  }

  if (!code || !state) {
    return redirect("/settings/integrations?error=teams_invalid_response");
  }

  // Verify state
  const cookieStore = await cookies();
  const storedState = cookieStore.get("teams_oauth_state")?.value;

  if (!storedState || storedState !== state) {
    return redirect("/settings/integrations?error=teams_state_mismatch");
  }

  // Clear the state cookie
  cookieStore.delete("teams_oauth_state");

  // Parse state
  let parsedState: OAuthState;
  try {
    parsedState = JSON.parse(Buffer.from(state, "base64url").toString());
  } catch {
    return redirect("/settings/integrations?error=teams_invalid_state");
  }

  // Verify state is not too old (10 minutes)
  if (Date.now() - parsedState.timestamp > 600000) {
    return redirect("/settings/integrations?error=teams_state_expired");
  }

  const { userId, organizationId } = parsedState;

  // Exchange code for tokens and save integration
  const effect = Effect.gen(function* () {
    const teams = yield* MicrosoftTeams;
    const integrationRepo = yield* IntegrationRepository;

    // Exchange code for tokens
    const tokens = yield* teams.exchangeCodeForToken(code);

    // Get user info from Microsoft Graph
    const userInfo = yield* teams.getUserInfo(tokens.access_token);

    // Check if integration already exists
    const existingIntegration = yield* integrationRepo.getIntegrationByProvider(userId, "microsoft_teams");

    const metadata = {
      userId: userInfo.id,
      email: userInfo.mail || userInfo.userPrincipalName,
      displayName: userInfo.displayName,
    };

    if (existingIntegration) {
      // Update existing integration
      yield* integrationRepo.updateIntegration(existingIntegration.id, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scope: tokens.scope,
        metadata,
      });
    } else {
      // Create new integration
      yield* integrationRepo.createIntegration({
        userId,
        organizationId,
        provider: "microsoft_teams",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scope: tokens.scope,
        metadata,
      });
    }

    return { success: true };
  });

  try {
    await Effect.runPromise(Effect.provide(effect, CallbackLayer));
    return redirect(`/${organizationId}/settings/integrations?success=teams`);
  } catch (err) {
    console.error("[Teams Callback Error]", err);
    return redirect(`/${organizationId}/settings/integrations?error=teams_callback_failed`);
  }
}
