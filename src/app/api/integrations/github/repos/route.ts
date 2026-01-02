import { Effect, Layer } from "effect";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { GitHubRepositoryInfo } from "@/lib/db/schema";
import { CodeLinksRepository, CodeLinksRepositoryLive } from "@/lib/effect/services/code-links-repository";
import { DatabaseLive } from "@/lib/effect/services/database";
import { GitHub, GitHubLive } from "@/lib/effect/services/github";

export const dynamic = "force-dynamic";

const CodeLinksRepositoryWithDeps = CodeLinksRepositoryLive.pipe(Layer.provide(DatabaseLive));
const ReposLayer = Layer.mergeAll(GitHubLive, CodeLinksRepositoryWithDeps, DatabaseLive);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get("organizationId");
  const refresh = searchParams.get("refresh") === "true";

  if (!organizationId) {
    return NextResponse.json({ error: "Missing organizationId" }, { status: 400 });
  }

  // Verify the user is authenticated
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const effect = Effect.gen(function* () {
    const github = yield* GitHub;
    const codeLinksRepo = yield* CodeLinksRepository;

    // Get the GitHub connection for this organization
    const connection = yield* codeLinksRepo.getGitHubConnection(organizationId);

    if (!connection) {
      return { connected: false, repositories: [] };
    }

    let repositories = connection.repositories || [];

    // Refresh repositories if requested or if cache is stale (older than 1 hour)
    const cacheAge = connection.lastSyncAt ? Date.now() - connection.lastSyncAt.getTime() : Number.POSITIVE_INFINITY;
    const shouldRefresh = refresh || cacheAge > 3600000; // 1 hour

    if (shouldRefresh) {
      try {
        // Fetch fresh repository list from GitHub
        const repos = yield* github.listRepositories(connection.accessToken, {
          type: "all",
          sort: "updated",
          per_page: 100,
        });

        // Map to our repository format
        repositories = repos.map((repo) => ({
          id: repo.id,
          name: repo.name,
          fullName: repo.full_name,
          private: repo.private,
          defaultBranch: repo.default_branch,
          updatedAt: repo.updated_at,
        }));

        // Update the cached repositories
        yield* codeLinksRepo.syncRepositories(organizationId, repositories);
      } catch (error) {
        // If refresh fails, return cached data
        console.error("[GitHub Repos Refresh Error]", error);
      }
    }

    return {
      connected: true,
      repositories,
      connectedAt: connection.connectedAt,
      lastSyncAt: connection.lastSyncAt,
      connectedBy: connection.connectedByUser,
    };
  });

  try {
    const result = await Effect.runPromise(Effect.provide(effect, ReposLayer));
    return NextResponse.json(result);
  } catch (err) {
    console.error("[GitHub Repos Error]", err);
    return NextResponse.json({ error: "Failed to fetch repositories" }, { status: 500 });
  }
}

// Sync repositories (POST request to force refresh)
export async function POST(request: Request) {
  const body = await request.json();
  const { organizationId } = body;

  if (!organizationId) {
    return NextResponse.json({ error: "Missing organizationId" }, { status: 400 });
  }

  // Verify the user is authenticated
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const effect = Effect.gen(function* () {
    const github = yield* GitHub;
    const codeLinksRepo = yield* CodeLinksRepository;

    // Get the GitHub connection for this organization
    const connection = yield* codeLinksRepo.getGitHubConnection(organizationId);

    if (!connection) {
      return { error: "GitHub not connected" };
    }

    // Fetch fresh repository list from GitHub
    const repos = yield* github.listRepositories(connection.accessToken, {
      type: "all",
      sort: "updated",
      per_page: 100,
    });

    // Map to our repository format
    const repositories: GitHubRepositoryInfo[] = repos.map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      private: repo.private,
      defaultBranch: repo.default_branch,
      updatedAt: repo.updated_at,
    }));

    // Update the cached repositories
    yield* codeLinksRepo.syncRepositories(organizationId, repositories);

    return {
      success: true,
      repositories,
      syncedAt: new Date(),
    };
  });

  try {
    const result = await Effect.runPromise(Effect.provide(effect, ReposLayer));
    if ("error" in result) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("[GitHub Repos Sync Error]", err);
    return NextResponse.json({ error: "Failed to sync repositories" }, { status: 500 });
  }
}

// Disconnect GitHub integration
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get("organizationId");

  if (!organizationId) {
    return NextResponse.json({ error: "Missing organizationId" }, { status: 400 });
  }

  // Verify the user is authenticated
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const effect = Effect.gen(function* () {
    const codeLinksRepo = yield* CodeLinksRepository;

    // Delete the GitHub connection
    yield* codeLinksRepo.deleteGitHubConnection(organizationId);

    return { success: true };
  });

  try {
    await Effect.runPromise(Effect.provide(effect, ReposLayer));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[GitHub Disconnect Error]", err);
    return NextResponse.json({ error: "Failed to disconnect GitHub" }, { status: 500 });
  }
}
