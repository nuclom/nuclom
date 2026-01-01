import { Effect, Layer } from "effect";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DatabaseLive } from "@/lib/effect/services/database";
import {
  IntegrationRepository,
  IntegrationRepositoryLive,
} from "@/lib/effect/services/integration-repository";
import { Slack, SlackLive } from "@/lib/effect/services/slack";

export const dynamic = "force-dynamic";

const IntegrationRepositoryWithDeps = IntegrationRepositoryLive.pipe(Layer.provide(DatabaseLive));
const CallbackLayer = Layer.mergeAll(SlackLive, IntegrationRepositoryWithDeps, DatabaseLive);

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

  // Handle OAuth errors
  if (error) {
    console.error("[Slack OAuth Error]", error);
    return redirect("/settings/integrations?error=slack_oauth_failed");
  }

  if (!code || !state) {
    return redirect("/settings/integrations?error=slack_invalid_response");
  }

  // Verify state
  const cookieStore = await cookies();
  const storedState = cookieStore.get("slack_oauth_state")?.value;

  if (!storedState || storedState !== state) {
    return redirect("/settings/integrations?error=slack_state_mismatch");
  }

  // Clear the state cookie
  cookieStore.delete("slack_oauth_state");

  // Parse state
  let parsedState: OAuthState;
  try {
    parsedState = JSON.parse(Buffer.from(state, "base64url").toString());
  } catch {
    return redirect("/settings/integrations?error=slack_invalid_state");
  }

  // Verify state is not too old (10 minutes)
  if (Date.now() - parsedState.timestamp > 600000) {
    return redirect("/settings/integrations?error=slack_state_expired");
  }

  const { userId, organizationId } = parsedState;

  // Exchange code for tokens and save integration
  const effect = Effect.gen(function* () {
    const slack = yield* Slack;
    const integrationRepo = yield* IntegrationRepository;

    // Exchange code for tokens
    const tokens = yield* slack.exchangeCodeForToken(code);

    // Check if integration already exists
    const existingIntegration = yield* integrationRepo.getIntegrationByProvider(userId, "slack");

    const metadata = {
      teamId: tokens.team.id,
      teamName: tokens.team.name,
      userId: tokens.authed_user.id,
      botUserId: tokens.bot_user_id,
      webhookUrl: tokens.incoming_webhook?.url,
    };

    if (existingIntegration) {
      // Update existing integration
      yield* integrationRepo.updateIntegration(existingIntegration.id, {
        accessToken: tokens.access_token,
        scope: tokens.scope,
        metadata,
      });
    } else {
      // Create new integration
      yield* integrationRepo.createIntegration({
        userId,
        organizationId,
        provider: "slack",
        accessToken: tokens.access_token,
        scope: tokens.scope,
        metadata,
      });
    }

    return { success: true };
  });

  try {
    await Effect.runPromise(Effect.provide(effect, CallbackLayer));
    return redirect(`/${organizationId}/settings/integrations?success=slack`);
  } catch (err) {
    console.error("[Slack Callback Error]", err);
    return redirect(`/${organizationId}/settings/integrations?error=slack_callback_failed`);
  }
}
