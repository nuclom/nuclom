import { Effect } from "effect";
import { GitHub } from "@/lib/effect/services/github";
import {
  errorRedirect,
  GitHubIntegrationLayer,
  saveIntegration,
  successRedirect,
  validateOAuthCallback,
} from "@/lib/integrations";

export async function GET(request: Request) {
  const validation = await validateOAuthCallback(request, "github");
  if (!validation.success) {
    return validation.redirect;
  }

  const { code, userId, organizationId } = validation;

  const effect = Effect.gen(function* () {
    const github = yield* GitHub;

    // Exchange code for tokens
    const tokens = yield* github.exchangeCodeForToken(code);

    // Get user info from GitHub
    const userInfo = yield* github.getUserInfo(tokens.access_token);

    // Get initial list of repositories
    const reposResponse = yield* github.listRepositories(tokens.access_token, 1, 100);

    // Save integration
    yield* saveIntegration({
      userId,
      organizationId,
      provider: "github",
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        scope: tokens.scope,
      },
      metadata: {
        login: userInfo.login,
        email: userInfo.email ?? undefined,
        avatarUrl: userInfo.avatar_url,
        repositories: reposResponse.repositories.map((repo) => ({
          id: repo.id,
          fullName: repo.full_name,
          private: repo.private,
        })),
      },
    });

    return { success: true };
  });

  try {
    await Effect.runPromise(Effect.provide(effect, GitHubIntegrationLayer));
    return successRedirect(organizationId, "github");
  } catch (err) {
    console.error("[GitHub Callback Error]", err);
    return errorRedirect(organizationId, "github");
  }
}
