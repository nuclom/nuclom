import { Effect, Layer } from "effect";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DatabaseLive } from "@/lib/effect/services/database";
import { IntegrationRepository, IntegrationRepositoryLive } from "@/lib/effect/services/integration-repository";
import { Zoom, ZoomLive } from "@/lib/effect/services/zoom";

export const dynamic = "force-dynamic";

const IntegrationRepositoryWithDeps = IntegrationRepositoryLive.pipe(Layer.provide(DatabaseLive));
const CallbackLayer = Layer.mergeAll(ZoomLive, IntegrationRepositoryWithDeps, DatabaseLive);

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
    console.error("[Zoom OAuth Error]", error);
    return redirect("/settings/integrations?error=zoom_oauth_failed");
  }

  if (!code || !state) {
    return redirect("/settings/integrations?error=zoom_invalid_response");
  }

  // Verify state
  const cookieStore = await cookies();
  const storedState = cookieStore.get("zoom_oauth_state")?.value;

  if (!storedState || storedState !== state) {
    return redirect("/settings/integrations?error=zoom_state_mismatch");
  }

  // Clear the state cookie
  cookieStore.delete("zoom_oauth_state");

  // Parse state
  let parsedState: OAuthState;
  try {
    parsedState = JSON.parse(Buffer.from(state, "base64url").toString());
  } catch {
    return redirect("/settings/integrations?error=zoom_invalid_state");
  }

  // Verify state is not too old (10 minutes)
  if (Date.now() - parsedState.timestamp > 600000) {
    return redirect("/settings/integrations?error=zoom_state_expired");
  }

  const { userId, organizationId } = parsedState;

  // Exchange code for tokens and save integration
  const effect = Effect.gen(function* () {
    const zoom = yield* Zoom;
    const integrationRepo = yield* IntegrationRepository;

    // Exchange code for tokens
    const tokens = yield* zoom.exchangeCodeForToken(code);

    // Get user info from Zoom
    const userInfo = yield* zoom.getUserInfo(tokens.access_token);

    // Check if integration already exists
    const existingIntegration = yield* integrationRepo.getIntegrationByProvider(userId, "zoom");

    if (existingIntegration) {
      // Update existing integration
      yield* integrationRepo.updateIntegration(existingIntegration.id, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scope: tokens.scope,
        metadata: {
          accountId: userInfo.account_id,
          email: userInfo.email,
        },
      });
    } else {
      // Create new integration
      yield* integrationRepo.createIntegration({
        userId,
        organizationId,
        provider: "zoom",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scope: tokens.scope,
        metadata: {
          accountId: userInfo.account_id,
          email: userInfo.email,
        },
      });
    }

    return { success: true };
  });

  try {
    await Effect.runPromise(Effect.provide(effect, CallbackLayer));
    return redirect(`/${organizationId}/settings/integrations?success=zoom`);
  } catch (err) {
    console.error("[Zoom Callback Error]", err);
    return redirect(`/${organizationId}/settings/integrations?error=zoom_callback_failed`);
  }
}
