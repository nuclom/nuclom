/**
 * GitHub Repositories API Routes
 *
 * GET /api/content/sources/[id]/github/repositories - Get available repositories with selection state
 * POST /api/content/sources/[id]/github/repositories - Update selected repositories
 */

import { Auth, createFullLayer, handleEffectExit, resolveParams } from '@nuclom/lib/api-handler';
import { db } from '@nuclom/lib/db';
import { type GitHubRepoSyncRecord, githubRepoSync } from '@nuclom/lib/db/schema';
import { OrganizationRepository } from '@nuclom/lib/effect';
import { getContentSource, updateContentSource } from '@nuclom/lib/effect/services/content';
import { GitHubContentAdapter } from '@nuclom/lib/effect/services/content/github-content-adapter';
import { validateRequestBody } from '@nuclom/lib/validation';
import { eq } from 'drizzle-orm';
import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// Types
// =============================================================================

interface GitHubRepoNode {
  id: number;
  fullName: string;
  name: string;
  owner: string;
  description: string | null;
  isPrivate: boolean;
  defaultBranch: string;
  language: string | null;
  stargazersCount: number;
  updatedAt: string;
  isSelected: boolean;
  syncPRs: boolean;
  syncIssues: boolean;
  syncDiscussions: boolean;
}

// =============================================================================
// Schemas
// =============================================================================

const UpdateSelectionSchema = Schema.Struct({
  selectedRepos: Schema.mutable(Schema.Array(Schema.String)),
  repoSettings: Schema.optional(
    Schema.mutable(
      Schema.Array(
        Schema.Struct({
          fullName: Schema.String,
          syncPRs: Schema.optional(Schema.Boolean),
          syncIssues: Schema.optional(Schema.Boolean),
          syncDiscussions: Schema.optional(Schema.Boolean),
        }),
      ),
    ),
  ),
});

// =============================================================================
// GET - Get Available Repositories
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Resolve params
    const { id } = yield* resolveParams(params);

    // Get content source
    const source = yield* getContentSource(id);

    // Verify user has access to the organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, source.organizationId);

    // Check if this is a GitHub source
    if (source.type !== 'github') {
      return yield* Effect.fail(new Error('Source is not a GitHub source'));
    }

    // Get GitHub adapter and list repositories
    const githubAdapter = yield* GitHubContentAdapter;
    const repos = yield* githubAdapter.listRepositories(source);

    // Get current sync state for all repos
    const syncRecords: GitHubRepoSyncRecord[] = yield* Effect.tryPromise({
      try: () =>
        db.query.githubRepoSync.findMany({
          where: eq(githubRepoSync.sourceId, id),
        }),
      catch: (e) => new Error(`Failed to fetch sync records: ${e}`),
    });

    // Create a map of repo sync states
    const syncMap = new Map<string, GitHubRepoSyncRecord>();
    for (const record of syncRecords) {
      syncMap.set(record.repoFullName, record);
    }

    // Get selected repos from config
    const config = source.config || {};
    const settings = (config.settings || {}) as Record<string, unknown>;
    const configRepos = (settings.repositories as string[]) || [];
    const selectedRepoSet = new Set(configRepos);

    // If no repos are configured, none are selected (require explicit selection)
    // If some repos are configured, those are selected
    const hasExplicitSelection = configRepos.length > 0;

    // Build response with selection state
    const repoNodes: GitHubRepoNode[] = repos.map((repo) => {
      const syncState = syncMap.get(repo.full_name);
      const isSelected = hasExplicitSelection ? selectedRepoSet.has(repo.full_name) : false;

      return {
        id: repo.id,
        fullName: repo.full_name,
        name: repo.name,
        owner: repo.owner.login,
        description: repo.description,
        isPrivate: repo.private,
        defaultBranch: repo.default_branch,
        language: (repo as { language?: string }).language || null,
        stargazersCount: (repo as { stargazers_count?: number }).stargazers_count || 0,
        updatedAt: (repo as { updated_at?: string }).updated_at || new Date().toISOString(),
        isSelected,
        syncPRs: syncState?.syncPRs ?? true,
        syncIssues: syncState?.syncIssues ?? true,
        syncDiscussions: syncState?.syncDiscussions ?? true,
      };
    });

    // Sort by updated date (most recent first), then by name
    repoNodes.sort((a, b) => {
      const dateCompare = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      if (dateCompare !== 0) return dateCompare;
      return a.fullName.localeCompare(b.fullName);
    });

    // Group by owner
    const byOwner: Record<string, GitHubRepoNode[]> = {};
    for (const repo of repoNodes) {
      if (!byOwner[repo.owner]) {
        byOwner[repo.owner] = [];
      }
      byOwner[repo.owner].push(repo);
    }

    return {
      repositories: repoNodes,
      byOwner,
      totalCount: repoNodes.length,
      selectedCount: repoNodes.filter((r) => r.isSelected).length,
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}

// =============================================================================
// POST - Update Selected Repositories
// =============================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Resolve params
    const { id } = yield* resolveParams(params);

    // Validate request body
    const data = yield* validateRequestBody(UpdateSelectionSchema, request);

    // Get content source
    const source = yield* getContentSource(id);

    // Verify user has access to the organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, source.organizationId);

    // Check if this is a GitHub source
    if (source.type !== 'github') {
      return yield* Effect.fail(new Error('Source is not a GitHub source'));
    }

    // Update content source config with selected repositories
    const currentConfig = source.config || {};
    const currentSettings = (currentConfig.settings || {}) as Record<string, unknown>;
    const updatedSettings = {
      ...currentSettings,
      repositories: data.selectedRepos,
    };

    yield* updateContentSource(id, {
      config: {
        ...currentConfig,
        settings: updatedSettings,
      },
    });

    // Update repo-specific sync settings if provided (using parallel execution)
    if (data.repoSettings && data.repoSettings.length > 0) {
      const selectedSettings = data.repoSettings.filter((setting) => data.selectedRepos.includes(setting.fullName));

      yield* Effect.forEach(
        selectedSettings,
        (setting) =>
          Effect.tryPromise({
            try: () =>
              db
                .update(githubRepoSync)
                .set({
                  syncPRs: setting.syncPRs ?? true,
                  syncIssues: setting.syncIssues ?? true,
                  syncDiscussions: setting.syncDiscussions ?? true,
                  updatedAt: new Date(),
                })
                .where(eq(githubRepoSync.repoFullName, setting.fullName)),
            catch: (e) => new Error(`Failed to update repo settings: ${e}`),
          }),
        { concurrency: 'unbounded' },
      );
    }

    return {
      success: true,
      selectedCount: data.selectedRepos.length,
      settings: updatedSettings,
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
