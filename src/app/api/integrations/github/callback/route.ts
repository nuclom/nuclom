import { Effect, Layer } from "effect";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { GitHubRepositoryInfo } from "@/lib/db/schema";
import { CodeLinksRepository, CodeLinksRepositoryLive } from "@/lib/effect/services/code-links-repository";
import { DatabaseLive } from "@/lib/effect/services/database";
import { GitHub, GitHubLive } from "@/lib/effect/services/github";

export const dynamic = "force-dynamic";

const CodeLinksRepositoryWithDeps = CodeLinksRepositoryLive.pipe(Layer.provide(DatabaseLive));
const CallbackLayer = Layer.mergeAll(GitHubLive, CodeLinksRepositoryWithDeps, DatabaseLive);

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
    console.error("[GitHub Context OAuth Error]", error, errorDescription);
    return redirect("/settings/integrations?error=github_context_oauth_failed");
  }

  if (!code || !state) {
    return redirect("/settings/integrations?error=github_context_invalid_response");
  }

  // Verify state
  const cookieStore = await cookies();
  const storedState = cookieStore.get("github_context_oauth_state")?.value;

  if (!storedState || storedState !== state) {
    return redirect("/settings/integrations?error=github_context_state_mismatch");
  }

  // Clear the state cookie
  cookieStore.delete("github_context_oauth_state");

  // Parse state
  let parsedState: OAuthState;
  try {
    parsedState = JSON.parse(Buffer.from(state, "base64url").toString());
  } catch {
    return redirect("/settings/integrations?error=github_context_invalid_state");
  }

  // Verify state is not too old (10 minutes)
  if (Date.now() - parsedState.timestamp > 600000) {
    return redirect("/settings/integrations?error=github_context_state_expired");
  }

  const { userId, organizationId } = parsedState;

  // Exchange code for tokens and save GitHub connection
  const effect = Effect.gen(function* () {
    const github = yield* GitHub;
    const codeLinksRepo = yield* CodeLinksRepository;

    // Exchange code for tokens
    const tokens = yield* github.exchangeCodeForToken(code);

    // Get user info from GitHub (used for validation)
    const _userInfo = yield* github.getUserInfo(tokens.access_token);

    // List repositories accessible to the user
    const repos = yield* github.listRepositories(tokens.access_token, {
      type: "all",
      sort: "updated",
      per_page: 100,
    });

    // Map to our repository format
    const repositoryInfo: GitHubRepositoryInfo[] = repos.map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      private: repo.private,
      defaultBranch: repo.default_branch,
      updatedAt: repo.updated_at,
    }));

    // Check if connection already exists
    const existingConnection = yield* codeLinksRepo.getGitHubConnection(organizationId);

    if (existingConnection) {
      // Update existing connection
      yield* codeLinksRepo.updateGitHubConnection(existingConnection.id, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
        repositories: repositoryInfo,
        scopes: tokens.scope,
        lastSyncAt: new Date(),
      });
    } else {
      // Create new connection
      yield* codeLinksRepo.createGitHubConnection({
        organizationId,
        connectedByUserId: userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
        repositories: repositoryInfo,
        scopes: tokens.scope,
      });
    }

    return { success: true, repoCount: repositoryInfo.length };
  });

  try {
    const result = await Effect.runPromise(Effect.provide(effect, CallbackLayer));
    return redirect(`/${organizationId}/settings/integrations?success=github_context&repos=${result.repoCount}`);
  } catch (err) {
    console.error("[GitHub Context Callback Error]", err);
    return redirect(`/${organizationId}/settings/integrations?error=github_context_callback_failed`);
  }
}
