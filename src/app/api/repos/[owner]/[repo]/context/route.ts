import { Effect } from "effect";
import type { NextRequest } from "next/server";
import { createPublicLayer, handleEffectExit } from "@/lib/api-handler";
import type { CodeLinkType } from "@/lib/db/schema";
import { CodeLinksRepository } from "@/lib/effect";

// =============================================================================
// GET /api/repos/[owner]/[repo]/context - Get all video context for a repository
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ owner: string; repo: string }> }) {
  const { searchParams } = new URL(request.url);
  const limit = Number.parseInt(searchParams.get("limit") || "50", 10);

  const effect = Effect.gen(function* () {
    const { owner, repo } = yield* Effect.promise(() => params);
    const repoFullName = `${owner}/${repo}`;

    const codeLinksRepo = yield* CodeLinksRepository;

    // Get summary statistics
    const summary = yield* codeLinksRepo.getRepoContextSummary(repoFullName);

    // Get code links grouped by type
    const [prs, issues, commits, files] = yield* Effect.all([
      codeLinksRepo.getCodeLinksByRepo(repoFullName, { type: "pr" as CodeLinkType, limit }),
      codeLinksRepo.getCodeLinksByRepo(repoFullName, { type: "issue" as CodeLinkType, limit }),
      codeLinksRepo.getCodeLinksByRepo(repoFullName, { type: "commit" as CodeLinkType, limit }),
      codeLinksRepo.getCodeLinksByRepo(repoFullName, {
        type: "file" as CodeLinkType,
        limit,
      }),
    ]);

    // Get directories separately
    const directories = yield* codeLinksRepo.getCodeLinksByRepo(repoFullName, {
      type: "directory" as CodeLinkType,
      limit,
    });

    return {
      success: true,
      data: {
        repo: repoFullName,
        summary,
        prs,
        issues,
        commits,
        files: [...files, ...directories],
      },
    };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}
