import { Effect, Layer } from "effect";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DatabaseLive } from "@/lib/effect/services/database";
import { GitHub, GitHubLive } from "@/lib/effect/services/github";
import { IntegrationRepository, IntegrationRepositoryLive } from "@/lib/effect/services/integration-repository";

export const dynamic = "force-dynamic";

const IntegrationRepositoryWithDeps = IntegrationRepositoryLive.pipe(Layer.provide(DatabaseLive));
const CallbackLayer = Layer.mergeAll(GitHubLive, IntegrationRepositoryWithDeps, DatabaseLive);

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
    console.error("[GitHub OAuth Error]", error, errorDescription);
    return redirect("/settings/integrations?error=github_oauth_failed");
  }

  if (!code || !state) {
    return redirect("/settings/integrations?error=github_invalid_response");
  }

  // Verify state
  const cookieStore = await cookies();
  const storedState = cookieStore.get("github_oauth_state")?.value;

  if (!storedState || storedState !== state) {
    return redirect("/settings/integrations?error=github_state_mismatch");
  }

  // Clear the state cookie
  cookieStore.delete("github_oauth_state");

  // Parse state
  let parsedState: OAuthState;
  try {
    parsedState = JSON.parse(Buffer.from(state, "base64url").toString());
  } catch {
    return redirect("/settings/integrations?error=github_invalid_state");
  }

  // Verify state is not too old (10 minutes)
  if (Date.now() - parsedState.timestamp > 600000) {
    return redirect("/settings/integrations?error=github_state_expired");
  }

  const { userId, organizationId } = parsedState;

  // Exchange code for tokens and save integration
  const effect = Effect.gen(function* () {
    const github = yield* GitHub;
    const integrationRepo = yield* IntegrationRepository;

    // Exchange code for tokens
    const tokens = yield* github.exchangeCodeForToken(code);

    // Get user info from GitHub
    const userInfo = yield* github.getUserInfo(tokens.access_token);

    // Get initial list of repositories
    const reposResponse = yield* github.listRepositories(tokens.access_token, 1, 100);

    // Check if integration already exists
    const existingIntegration = yield* integrationRepo.getIntegrationByProvider(userId, "github");

    const metadata = {
      login: userInfo.login,
      email: userInfo.email ?? undefined,
      avatarUrl: userInfo.avatar_url,
      repositories: reposResponse.repositories.map((repo) => ({
        id: repo.id,
        fullName: repo.full_name,
        private: repo.private,
      })),
    };

    if (existingIntegration) {
      // Update existing integration
      yield* integrationRepo.updateIntegration(existingIntegration.id, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? existingIntegration.refreshToken ?? undefined,
        expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
        scope: tokens.scope,
        metadata,
      });
    } else {
      // Create new integration
      yield* integrationRepo.createIntegration({
        userId,
        organizationId,
        provider: "github",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
        scope: tokens.scope,
        metadata,
      });
    }

    return { success: true };
  });

  try {
    await Effect.runPromise(Effect.provide(effect, CallbackLayer));
    return redirect(`/${organizationId}/settings/integrations?success=github`);
  } catch (err) {
    console.error("[GitHub Callback Error]", err);
    return redirect(`/${organizationId}/settings/integrations?error=github_callback_failed`);
  }
}
